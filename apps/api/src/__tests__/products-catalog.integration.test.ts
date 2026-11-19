import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/crypto';
import { getLocalUploadsDir } from '../services/storage.service';
import { resetDatabase } from './setup';

const app = createApp();
const createdFiles: string[] = [];

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

describe('Products, Multiple Codes, Public Catalog Privacy, Uploads & Kardex API', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(() => {
    const dir = getLocalUploadsDir();
    for (const fileName of createdFiles) {
      const target = path.join(dir, fileName);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }
  });

  it('keeps GET /api/catalog public and strictly strips prices and stock while blocking CUSTOMER from /api/products', async () => {
    const admin = await createAndLogin({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin',
      role: 'ADMIN',
    });
    const customer = await createAndLogin({
      email: 'cliente@artemodelo.gt',
      fullName: 'Cliente',
      role: 'CUSTOMER',
    });

    const createRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Marco Dorado Imperial',
        description: 'Acabado fino en oro envejecido',
        codes: [
          { code: 'amd-001', label: 'Interno', isPrimary: true },
          { code: 'prov-7788', label: 'Proveedor', isPrimary: false },
          { code: 'cli-tienda-5', label: 'Cliente / Tienda', isPrimary: false },
        ],
        priceGTQ: 220,
        priceHNL: 720,
        priceNIO: 1050,
        priceUSD: 28.5,
        initialStock: 15,
        lowStockThreshold: 5,
        images: [{ url: '/seed/marco-clasico.svg', altText: 'Vista frontal' }],
      });

    expect(createRes.status).toBe(201);
    const productId = createRes.body.product.id as string;
    expect(createRes.body.product.codes).toHaveLength(3);
    expect(createRes.body.product.priceGTQ).toBe(220);
    expect(createRes.body.product).not.toHaveProperty('category');

    // Public catalog works without token and strictly excludes prices, stock & categories
    const catalogList = await request(app).get('/api/catalog?search=PROV-7788');
    expect(catalogList.status).toBe(200);
    expect(catalogList.body).not.toHaveProperty('categories');
    expect(catalogList.body.products).toHaveLength(1);
    expect(catalogList.body.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });

    const publicItem = catalogList.body.products[0];
    expect(publicItem.name).toBe('Marco Dorado Imperial');
    expect(publicItem).not.toHaveProperty('category');
    expect(publicItem.codes.map((c: { code: string }) => c.code)).toContain('PROV-7788');
    expect(publicItem).not.toHaveProperty('priceGTQ');
    expect(publicItem).not.toHaveProperty('priceHNL');
    expect(publicItem).not.toHaveProperty('priceNIO');
    expect(publicItem).not.toHaveProperty('priceUSD');
    expect(publicItem).not.toHaveProperty('stock');
    expect(publicItem).not.toHaveProperty('lowStockThreshold');

    const catalogDetail = await request(app).get(`/api/catalog/${productId}`);
    expect(catalogDetail.status).toBe(200);
    expect(catalogDetail.body.product).not.toHaveProperty('priceGTQ');
    expect(catalogDetail.body.product).not.toHaveProperty('stock');

    // CUSTOMER blocked on private /api/products endpoints
    const custProducts = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${customer.token}`);
    expect(custProducts.status).toBe(403);

    // Staff with products.read but without products.read_prices gets product metadata WITHOUT prices or stock
    await request(app)
      .put('/api/permissions/role/CUSTOMER')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        permissions: [{ code: 'products.read', granted: true }],
      });

    const restrictedRead = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${customer.token}`);
    expect(restrictedRead.status).toBe(200);
    expect(restrictedRead.body.products[0]).not.toHaveProperty('priceGTQ');
    expect(restrictedRead.body.products[0]).not.toHaveProperty('stock');
  });

  it('handles product updates, duplicate code conflicts, archiving/restoring and Kardex stock movements', async () => {
    const admin = await createAndLogin({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin',
      role: 'ADMIN',
    });

    const p1 = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Espejo Biselado',
        codes: [{ code: 'ESP-100', label: 'Interno', isPrimary: true }],
        priceGTQ: 350,
        initialStock: 10,
        lowStockThreshold: 8,
      });
    expect(p1.status).toBe(201);
    const id1 = p1.body.product.id as string;

    // Conflict on duplicate global code across products
    const dupCode = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Otro Espejo',
        codes: [{ code: 'esp-100', label: 'Interno', isPrimary: true }],
        initialStock: 2,
      });
    expect(dupCode.status).toBe(409);

    // Duplicate inside same payload rejected
    const dupInside = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Producto Inválido',
        codes: [
          { code: 'AAA-1', label: 'Interno', isPrimary: true },
          { code: 'aaa-1', label: 'Proveedor', isPrimary: false },
        ],
      });
    expect(dupInside.status).toBe(400);

    // Update product codes & prices
    const updated = await request(app)
      .patch(`/api/products/${id1}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Espejo Biselado Grande',
        priceUSD: 46,
        codes: [
          { code: 'ESP-100', label: 'Interno', isPrimary: true },
          { code: 'PROV-ESP-100', label: 'Proveedor', isPrimary: false },
        ],
      });
    expect(updated.status).toBe(200);
    expect(updated.body.product.codes).toHaveLength(2);
    expect(updated.body.product.priceUSD).toBe(46);

    // Kardex: MANUAL_IN (+5 -> 15), MANUAL_OUT (-10 -> 5), reject over-out, MANUAL_ADJUST (=12 -> +7)
    const inRes = await request(app)
      .post(`/api/products/${id1}/stock-movements`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        type: 'MANUAL_IN',
        quantity: 5,
        reason: 'Ingreso lote nuevo',
        reference: 'DOC-01',
      });
    expect(inRes.status).toBe(201);
    expect(inRes.body.product.stock).toBe(15);

    const outRes = await request(app)
      .post(`/api/products/${id1}/stock-movements`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        type: 'MANUAL_OUT',
        quantity: 10,
        reason: 'Baja por daño en bodega',
      });
    expect(outRes.status).toBe(201);
    expect(outRes.body.product.stock).toBe(5);
    expect(outRes.body.product.isLowStock).toBe(true);

    // Insufficient stock fails cleanly
    const tooMuchOut = await request(app)
      .post(`/api/products/${id1}/stock-movements`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        type: 'MANUAL_OUT',
        quantity: 99,
        reason: 'Salida imposible',
      });
    expect(tooMuchOut.status).toBe(400);

    // Adjust to exact count
    const adjRes = await request(app)
      .post(`/api/products/${id1}/stock-movements`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        type: 'MANUAL_ADJUST',
        quantity: 12,
        reason: 'Conteo físico mensual',
      });
    expect(adjRes.status).toBe(201);
    expect(adjRes.body.product.stock).toBe(12);
    expect(adjRes.body.movement.quantityDelta).toBe(7);

    // Kardex history shows INITIAL + 3 movements = 4 entries, and supports pagination
    const history = await request(app)
      .get(`/api/products/${id1}/stock-movements?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(history.status).toBe(200);
    expect(history.body.movements).toHaveLength(2);
    expect(history.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasPrev: false,
      hasNext: true,
    });

    const historyAll = await request(app)
      .get(`/api/products/${id1}/stock-movements?pageSize=0`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(historyAll.status).toBe(200);
    expect(historyAll.body.movements).toHaveLength(4);
    expect(historyAll.body.pagination.pageSize).toBe(0);

    // Soft-delete hides from public catalog & active products, restore brings it back
    const archRes = await request(app)
      .delete(`/api/products/${id1}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(archRes.status).toBe(200);

    expect((await request(app).get('/api/catalog')).body.products).toHaveLength(0);
    expect((await request(app).get(`/api/catalog/${id1}`)).status).toBe(404);

    const archivedList = await request(app)
      .get('/api/products?includeArchived=true')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(archivedList.body.products).toHaveLength(1);

    const restoreRes = await request(app)
      .post(`/api/products/${id1}/restore`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(restoreRes.status).toBe(200);
    expect((await request(app).get('/api/catalog')).body.products).toHaveLength(1);
  });

  it('paginates /api/catalog and /api/products including lowStockOnly filtering', async () => {
    const admin = await createAndLogin({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin',
      role: 'ADMIN',
    });

    for (let i = 1; i <= 4; i++) {
      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          name: `Producto Paginado ${String(i).padStart(2, '0')}`,
          codes: [{ code: `PAG-${i}`, label: 'Interno', isPrimary: true }],
          priceGTQ: 100 + i,
          initialStock: i <= 2 ? 3 : 25,
          lowStockThreshold: 5,
        });
    }

    const page1 = await request(app).get('/api/catalog?page=1&pageSize=2');
    expect(page1.status).toBe(200);
    expect(page1.body.products).toHaveLength(2);
    expect(page1.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasPrev: false,
      hasNext: true,
    });

    const page2 = await request(app).get('/api/catalog?page=2&pageSize=2');
    expect(page2.status).toBe(200);
    expect(page2.body.products).toHaveLength(2);
    expect(page2.body.pagination.hasPrev).toBe(true);
    expect(page2.body.pagination.hasNext).toBe(false);

    // Oversized page clamps to totalPages, and lowStockOnly filters in pagination
    const lowStockPage = await request(app)
      .get('/api/products?lowStockOnly=true&page=9&pageSize=1')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(lowStockPage.status).toBe(200);
    expect(lowStockPage.body.products).toHaveLength(1);
    expect(lowStockPage.body.pagination).toEqual({
      page: 2,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      hasPrev: true,
      hasNext: false,
    });

    // pageSize=0 returns all matching items without slicing
    const catalogAll = await request(app).get('/api/catalog?pageSize=0');
    expect(catalogAll.status).toBe(200);
    expect(catalogAll.body.products).toHaveLength(4);
    expect(catalogAll.body.pagination).toEqual({
      page: 1,
      pageSize: 0,
      total: 4,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });

    const lowStockAll = await request(app)
      .get('/api/products?lowStockOnly=true&pageSize=0')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(lowStockAll.status).toBe(200);
    expect(lowStockAll.body.products).toHaveLength(2);
    expect(lowStockAll.body.pagination.pageSize).toBe(0);
  });

  it('uploads product image to local fallback storage and serves it safely', async () => {
    const admin = await createAndLogin({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin',
      role: 'ADMIN',
    });

    // 1x1 tiny transparent PNG base64
    const tinyPngBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const uploadRes = await request(app)
      .post('/api/uploads/product-image')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        fileName: 'muestra producto.png',
        mimeType: 'image/png',
        dataBase64: tinyPngBase64,
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.provider).toBe('local-storage');
    expect(uploadRes.body.fileName).toContain('.png');
    createdFiles.push(uploadRes.body.fileName as string);

    const fetchRes = await request(app).get(
      `/api/uploads/products/${uploadRes.body.fileName}`,
    );
    expect(fetchRes.status).toBe(200);

    const missingFile = await request(app).get(
      '/api/uploads/products/no-existe.png',
    );
    expect(missingFile.status).toBe(404);

    const badMime = await request(app)
      .post('/api/uploads/product-image')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        fileName: 'script.exe',
        mimeType: 'application/octet-stream',
        dataBase64: tinyPngBase64,
      });
    expect(badMime.status).toBe(400);
  });
});
