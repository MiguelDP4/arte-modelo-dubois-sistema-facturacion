import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/crypto';
import { resetDatabase } from './setup';

const app = createApp();

async function createAndLogin(params: {
  email: string;
  fullName: string;
  role: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
}) {
  const passwordHash = await hashPassword('Password123');
  const user = await prisma.user.create({
    data: {
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      passwordHash,
      isActive: true,
      isVerified: true,
    },
  });

  const login = await request(app).post('/api/auth/login').send({
    email: params.email,
    password: 'Password123',
  });

  return { user, token: login.body.accessToken as string };
}

describe('Regional Customers & Account Linking API integration', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('requires authentication and customers permissions on all /api/customers routes', async () => {
    const customerRole = await createAndLogin({
      email: 'cliente@artemodelo.gt',
      fullName: 'Cliente Uno',
      role: 'CUSTOMER',
    });

    expect((await request(app).get('/api/customers')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/customers')
          .set('Authorization', `Bearer ${customerRole.token}`)
      ).status,
    ).toBe(403);
  });

  it('supports regional CRUD, automatic currency/tax labels, filtering, and user linking/unlinking', async () => {
    const admin = await createAndLogin({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin',
      role: 'ADMIN',
    });
    const custUser = await createAndLogin({
      email: 'comprador@hn.com',
      fullName: 'Maritza Banegas',
      role: 'CUSTOMER',
    });
    const staffUser = await createAndLogin({
      email: 'bodega@artemodelo.gt',
      fullName: 'Operador',
      role: 'EMPLOYEE',
    });

    // Create customer in Honduras -> HNL & RTN automatically
    const createHn = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        companyName: 'Galería Sula Hogar',
        managerName: 'Maritza Banegas',
        phone: '+504 2550-8820',
        email: 'pedidos@sulahogar.hn',
        country: 'HN',
        address: 'San Pedro Sula',
        taxId: '05019012345678',
      });
    expect(createHn.status).toBe(201);
    expect(createHn.body.customer.currency).toBe('HNL');
    expect(createHn.body.customer.taxLabel).toBe('RTN');
    const hnId = createHn.body.customer.id as string;

    // Duplicate email rejected
    const dup = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        companyName: 'Otra Galería',
        managerName: 'Otro',
        phone: '+504 9999-0000',
        email: 'pedidos@sulahogar.hn',
        country: 'HN',
        address: 'Tegucigalpa',
        taxId: '0801199012345',
      });
    expect(dup.status).toBe(409);

    // Create customer in Nicaragua -> NIO & RUC
    const createNi = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        companyName: 'Muebles Managua',
        managerName: 'Ernesto',
        phone: '+505 2278-3340',
        email: 'info@managua.ni',
        country: 'NI',
        address: 'Km 5.5 Carretera Masaya',
        taxId: 'J0310000123456',
      });
    expect(createNi.status).toBe(201);
    expect(createNi.body.customer.currency).toBe('NIO');
    expect(createNi.body.customer.taxLabel).toBe('RUC');

    // Filter by country & search
    const hnFilter = await request(app)
      .get('/api/customers?country=HN&search=05019012345678')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(hnFilter.status).toBe(200);
    expect(hnFilter.body.customers).toHaveLength(1);
    expect(hnFilter.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });

    // API pagination across 2 active customers
    const page1 = await request(app)
      .get('/api/customers?page=1&pageSize=1')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.customers).toHaveLength(1);
    expect(page1.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      hasPrev: false,
      hasNext: true,
    });

    const page2 = await request(app)
      .get('/api/customers?page=2&pageSize=1')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(page2.status).toBe(200);
    expect(page2.body.customers).toHaveLength(1);
    expect(page2.body.pagination.hasPrev).toBe(true);
    expect(page2.body.pagination.hasNext).toBe(false);

    // Update customer country to GT -> updates currency to GTQ & taxLabel to NIT
    const updated = await request(app)
      .patch(`/api/customers/${hnId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ country: 'GT', taxId: '987654-3' });
    expect(updated.status).toBe(200);
    expect(updated.body.customer.currency).toBe('GTQ');
    expect(updated.body.customer.taxLabel).toBe('NIT');

    // List unlinked CUSTOMER users
    const unlinkedBefore = await request(app)
      .get('/api/customers/unlinked-users')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(unlinkedBefore.status).toBe(200);
    expect(unlinkedBefore.body.users.map((u: { id: string }) => u.id)).toContain(
      custUser.user.id,
    );

    // Linking EMPLOYEE fails (only CUSTOMER accounts allowed)
    const linkStaff = await request(app)
      .post(`/api/customers/${hnId}/users`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ userId: staffUser.user.id });
    expect(linkStaff.status).toBe(400);

    // Link CUSTOMER account successfully
    const linkOk = await request(app)
      .post(`/api/customers/${hnId}/users`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ userId: custUser.user.id });
    expect(linkOk.status).toBe(200);
    expect(linkOk.body.customer.users).toHaveLength(1);

    // Cannot archive customer while users are still linked
    const blockedArchive = await request(app)
      .delete(`/api/customers/${hnId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(blockedArchive.status).toBe(409);

    // Unlink then archive successfully
    const unlinkRes = await request(app)
      .delete(`/api/customers/${hnId}/users/${custUser.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(unlinkRes.status).toBe(200);
    expect(unlinkRes.body.customer.users).toHaveLength(0);

    const archiveOk = await request(app)
      .delete(`/api/customers/${hnId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(archiveOk.status).toBe(200);

    expect(
      (
        await request(app)
          .get('/api/customers')
          .set('Authorization', `Bearer ${admin.token}`)
      ).body.customers,
    ).toHaveLength(1);
  });
});
