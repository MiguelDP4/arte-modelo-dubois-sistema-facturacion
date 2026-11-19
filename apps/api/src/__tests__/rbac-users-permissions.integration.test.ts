import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/crypto';
import { resetDatabase } from './setup';

const app = createApp();

async function createAndLoginUser(params: {
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

  const res = await request(app).post('/api/auth/login').send({
    email: params.email,
    password: 'Password123',
  });

  return { user, token: res.body.accessToken as string };
}

describe('RBAC, Users and Permissions API integration', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('enforces RBAC on /api/users and /api/permissions and supports live permission updates', async () => {
    const admin = await createAndLoginUser({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin Principal',
      role: 'ADMIN',
    });
    const employee = await createAndLoginUser({
      email: 'emp@artemodelo.gt',
      fullName: 'Empleado Uno',
      role: 'EMPLOYEE',
    });
    const customer = await createAndLoginUser({
      email: 'cust@artemodelo.gt',
      fullName: 'Cliente Uno',
      role: 'CUSTOMER',
    });

    // Unauthenticated blocked
    expect((await request(app).get('/api/users')).status).toBe(401);
    expect((await request(app).get('/api/permissions')).status).toBe(401);

    // Employee and customer cannot read users or manage permissions by default
    expect(
      (await request(app).get('/api/users').set('Authorization', `Bearer ${employee.token}`))
        .status,
    ).toBe(403);
    expect(
      (await request(app).get('/api/users').set('Authorization', `Bearer ${customer.token}`))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get('/api/permissions')
          .set('Authorization', `Bearer ${employee.token}`)
      ).status,
    ).toBe(403);

    // Admin reads permission matrix (supports pageSize=0 default and explicit pagination)
    const matrix = await request(app)
      .get('/api/permissions')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(matrix.status).toBe(200);
    expect(matrix.body.permissions.length).toBeGreaterThan(10);
    expect(matrix.body.pagination.pageSize).toBe(0);

    const matrixPaged = await request(app)
      .get('/api/permissions?page=1&pageSize=5')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(matrixPaged.status).toBe(200);
    expect(matrixPaged.body.permissions).toHaveLength(5);
    expect(matrixPaged.body.pagination.pageSize).toBe(5);
    expect(matrixPaged.body.pagination.hasNext).toBe(true);

    // Admin cannot revoke locked ADMIN permissions
    const lockAttempt = await request(app)
      .put('/api/permissions/role/ADMIN')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        permissions: [{ code: 'permissions.manage', granted: false }],
      });
    expect(lockAttempt.status).toBe(400);

    // Invalid role fails
    const badRole = await request(app)
      .put('/api/permissions/role/SUPERUSER')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        permissions: [{ code: 'users.read', granted: true }],
      });
    expect(badRole.status).toBe(400);

    // Admin grants users.read to EMPLOYEE -> Employee immediately gains access
    const grantRes = await request(app)
      .put('/api/permissions/role/EMPLOYEE')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        permissions: [{ code: 'users.read', granted: true }],
      });
    expect(grantRes.status).toBe(200);

    const empList = await request(app)
      .get('/api/users?page=1&pageSize=2')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(empList.status).toBe(200);
    expect(empList.body.users).toHaveLength(2);
    expect(empList.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
      hasPrev: false,
      hasNext: true,
    });

    const empPage2 = await request(app)
      .get('/api/users?page=2&pageSize=2')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(empPage2.status).toBe(200);
    expect(empPage2.body.users).toHaveLength(1);
    expect(empPage2.body.pagination.hasPrev).toBe(true);
    expect(empPage2.body.pagination.hasNext).toBe(false);

    const empAll = await request(app)
      .get('/api/users?pageSize=0')
      .set('Authorization', `Bearer ${employee.token}`);
    expect(empAll.status).toBe(200);
    expect(empAll.body.users).toHaveLength(3);
    expect(empAll.body.pagination.pageSize).toBe(0);

    // Admin revokes users.read from EMPLOYEE -> blocked again
    await request(app)
      .put('/api/permissions/role/EMPLOYEE')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        permissions: [{ code: 'users.read', granted: false }],
      });

    expect(
      (await request(app).get('/api/users').set('Authorization', `Bearer ${employee.token}`))
        .status,
    ).toBe(403);
  });

  it('supports user listing filters, editing, resend invitation, deactivation and last-admin protection', async () => {
    const admin = await createAndLoginUser({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin Principal',
      role: 'ADMIN',
    });
    const emp = await createAndLoginUser({
      email: 'emp@artemodelo.gt',
      fullName: 'Pedro Bodega',
      role: 'EMPLOYEE',
    });

    // Admin invites a pending user via /api/users/invite
    const invited = await request(app)
      .post('/api/users/invite')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        fullName: 'Laura Invitada',
        email: 'laura@artemodelo.gt',
        role: 'CUSTOMER',
      });
    expect(invited.status).toBe(201);
    const pendingId = invited.body.user.id as string;

    // Resend invitation works for pending user and fails for verified user
    const resendOk = await request(app)
      .post(`/api/users/${pendingId}/resend-invitation`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(resendOk.status).toBe(200);

    const resendVerified = await request(app)
      .post(`/api/users/${emp.user.id}/resend-invitation`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(resendVerified.status).toBe(400);

    // Search & filter users
    const bySearch = await request(app)
      .get('/api/users?search=pedro&role=EMPLOYEE&status=active')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(bySearch.status).toBe(200);
    expect(bySearch.body.users).toHaveLength(1);

    const pendingFilter = await request(app)
      .get('/api/users?status=pending')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(pendingFilter.body.users).toHaveLength(1);

    // Admin cannot deactivate self or change own role
    expect(
      (
        await request(app)
          .patch(`/api/users/${admin.user.id}`)
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ isActive: false })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch(`/api/users/${admin.user.id}`)
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ role: 'EMPLOYEE' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .delete(`/api/users/${admin.user.id}`)
          .set('Authorization', `Bearer ${admin.token}`)
      ).status,
    ).toBe(400);

    // Update employee details and deactivate
    const updatedEmp = await request(app)
      .patch(`/api/users/${emp.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ fullName: 'Pedro Actualizado', isActive: false });
    expect(updatedEmp.status).toBe(200);
    expect(updatedEmp.body.user.isActive).toBe(false);

    // Inactive filter finds Pedro
    const inactiveFilter = await request(app)
      .get('/api/users?status=inactive')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(inactiveFilter.body.users).toHaveLength(1);

    // Delete (soft deactivate) pending user
    const deleted = await request(app)
      .delete(`/api/users/${pendingId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleted.status).toBe(200);

    // Nonexistent user returns 404
    expect(
      (
        await request(app)
          .patch('/api/users/nonexistent-id')
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ fullName: 'Nope' })
      ).status,
    ).toBe(404);
  });
});
