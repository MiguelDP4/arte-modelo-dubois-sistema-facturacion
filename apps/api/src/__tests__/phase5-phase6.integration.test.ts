import ExcelJS from 'exceljs';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/crypto';
import { clearMockOutbox, getMockOutbox } from '../services/email.service';
import { resetDatabase } from './setup';

const app = createApp();

async function createAndLoginUser(params: {
  email: string;
  fullName: string;
  role: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
  customerId?: string | null;
}) {
  const passwordHash = await hashPassword('Password123');
  const user = await prisma.user.create({
    data: {
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      customerId: params.customerId ?? null,
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

function binaryParser(
  res: { on: (ev: string, cb: (chunk: Buffer) => void) => void },
  callback: (err: Error | null, data: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Phase 5 & Phase 6 API Integration (Payments, Consignment, Excel, Emails, Dashboard)', () => {
  beforeEach(async () => {
    await resetDatabase();
    clearMockOutbox();
  });

  async function seedBaseScenario() {
    const admin = await createAndLoginUser({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin Dubois',
      role: 'ADMIN',
    });

    const custGtRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        companyName: 'Decoraciones El Quetzal, S.A.',
        managerName: 'Carlos Méndez',
        phone: '+502 2360-4411',
        email: 'compras@elquetzal.gt',
        country: 'GT',
        address: 'Zona 10, Guatemala',
        taxId: '4589123-4',
      });
    const custGt = custGtRes.body.customer;

    const custNiRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        companyName: 'Muebles Managua',
        managerName: 'Ernesto Solórzano',
        phone: '+505 2278-3340',
        email: 'gerencia@marcosmanagua.ni',
        country: 'NI',
        address: 'Carretera Masaya',
        taxId: 'J0310000123456',
      });
    const custNi = custNiRes.body.customer;

    const custUser = await createAndLoginUser({
      email: 'cliente@elquetzal.gt',
      fullName: 'Cliente Quetzal',
      role: 'CUSTOMER',
      customerId: custGt.id,
    });
    const otherCustUser = await createAndLoginUser({
      email: 'otro@managua.ni',
      fullName: 'Otro Cliente',
      role: 'CUSTOMER',
      customerId: custNi.id,
    });

    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Marco Clásico Nogal',
        codes: [{ code: 'AMD-NOG-01', label: 'Interno', isPrimary: true }],
        priceGTQ: 200,
        priceNIO: 900,
        initialStock: 20,
        lowStockThreshold: 25,
      });
    const product = prodRes.body.product;

    return { admin, custGt, custNi, custUser, otherCustUser, product };
  }

  it('handles payments, receipt upload, voiding recalculation, and triggers automated event emails', async () => {
    const { admin, custGt, custUser, otherCustUser, product } =
      await seedBaseScenario();

    // 1. Customer creates pending order -> staff email queued in outbox
    const custCreateRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${custUser.token}`)
      .send({
        notes: 'Urgente Zona 10',
        items: [{ productId: product.id, quantityOrdered: 5 }],
      });
    expect(custCreateRes.status).toBe(201);
    const orderId = custCreateRes.body.order.id as string;

    expect(
      getMockOutbox().some(
        (m) =>
          m.to === 'admin@artemodelo.gt' &&
          m.meta?.type === 'order_pending_staff',
      ),
    ).toBe(true);

    // 2. Customer downloads Excel of PENDING_CONFIRMATION order (prices hidden) & other customer blocked
    const otherExcel = await request(app)
      .get(`/api/orders/${orderId}/excel?type=invoice`)
      .set('Authorization', `Bearer ${otherCustUser.token}`);
    expect(otherExcel.status).toBe(403);

    // 3. Cannot register payment while PENDING_CONFIRMATION
    const payPendingRes = await request(app)
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        amount: 100,
        method: 'CASH',
        paymentDate: '2026-11-20',
      });
    expect(payPendingRes.status).toBe(400);

    // 4. Staff confirms order -> email sent to customer
    clearMockOutbox();
    const confirmRes = await request(app)
      .post(`/api/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ shippingCost: 50 });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.order.totalAmount).toBe(1050);

    expect(
      getMockOutbox().some(
        (m) => m.to === custGt.email && m.meta?.type === 'order_confirmed',
      ),
    ).toBe(true);

    // 5. Upload payment receipt image & register partial payment (TRANSFER)
    const uploadRes = await request(app)
      .post('/api/uploads/payment-receipt')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        fileName: 'boleta-banco.png',
        mimeType: 'image/png',
        dataBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      });
    expect(uploadRes.status).toBe(201);

    // Customer blocked from registering payments
    const custPayBlocked = await request(app)
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${custUser.token}`)
      .send({
        amount: 200,
        method: 'CASH',
        paymentDate: '2026-11-20',
      });
    expect(custPayBlocked.status).toBe(403);

    // Reject overpayment
    const overPay = await request(app)
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        amount: 5000,
        method: 'TRANSFER',
        paymentDate: '2026-11-20',
      });
    expect(overPay.status).toBe(400);

    clearMockOutbox();
    const pay1Res = await request(app)
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        amount: 400,
        method: 'TRANSFER',
        paymentDate: '2026-11-20',
        reference: 'BOL-1001',
        receiptImageUrl: uploadRes.body.url,
        notes: 'Primer abono',
      });
    expect(pay1Res.status).toBe(201);
    expect(pay1Res.body.order.amountPaid).toBe(400);
    expect(pay1Res.body.order.amountPending).toBe(650);
    expect(pay1Res.body.order.paymentStatus).toBe('PARTIALLY_PAID');

    expect(
      getMockOutbox().some(
        (m) => m.to === custGt.email && m.meta?.type === 'payment_registered',
      ),
    ).toBe(true);

    const payment1Id = pay1Res.body.order.payments[0].id as string;

    // 6. Register 2nd payment settling order, then void the 1st payment to check recalculation
    const pay2Res = await request(app)
      .post(`/api/orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        amount: 650,
        method: 'CHECK',
        paymentDate: '2026-11-20',
        reference: 'CHQ-22',
      });
    expect(pay2Res.status).toBe(201);
    expect(pay2Res.body.order.paymentStatus).toBe('PAID');
    expect(pay2Res.body.order.amountPending).toBe(0);

    const voidRes = await request(app)
      .post(`/api/orders/${orderId}/payments/${payment1Id}/void`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ voidReason: 'Transferencia revertida por banco' });
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.order.amountPaid).toBe(650);
    expect(voidRes.body.order.amountPending).toBe(400);
    expect(voidRes.body.order.paymentStatus).toBe('PARTIALLY_PAID');

    // Re-voiding fails cleanly
    const reVoidRes = await request(app)
      .post(`/api/orders/${orderId}/payments/${payment1Id}/void`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ voidReason: 'Duplicado' });
    expect(reVoidRes.status).toBe(400);

    const listPayRes = await request(app)
      .get(`/api/orders/${orderId}/payments?pageSize=1&page=1`)
      .set('Authorization', `Bearer ${custUser.token}`);
    expect(listPayRes.status).toBe(200);
    expect(listPayRes.body.payments).toHaveLength(1);
    expect(listPayRes.body.pagination.total).toBe(2);
  });

  it('handles consignment returns, Excel (.xlsx) exports, /consignments overview, and Dashboard KPIs', async () => {
    const { admin, custNi, custUser, product } = await seedBaseScenario();

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        customerId: custNi.id,
        type: 'CONSIGNMENT',
        shippingCost: 100,
        consignmentDueDate: '2026-12-01',
        items: [{ productId: product.id, quantityOrdered: 6, unitPrice: 900 }],
      });
    expect(orderRes.status).toBe(201);
    const order = orderRes.body.order;
    const itemId = order.items[0].id as string;

    // Pack 6 and Dispatch 4 (partial) -> email triggered
    await request(app)
      .post(`/api/orders/${order.id}/pack`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ items: [{ orderItemId: itemId, quantityPacked: 6 }] });

    clearMockOutbox();
    const dispRes = await request(app)
      .post(`/api/orders/${order.id}/dispatches`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        carrier: 'TicaBus',
        items: [{ orderItemId: itemId, quantityToDispatch: 4 }],
      });
    expect(dispRes.status).toBe(201);
    expect(
      getMockOutbox().some(
        (m) => m.to === custNi.email && m.meta?.type === 'order_dispatched',
      ),
    ).toBe(true);

    // Over-return (> 4 dispatched) blocked
    const overRet = await request(app)
      .post(`/api/orders/${order.id}/consignment-returns`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ items: [{ orderItemId: itemId, quantityReturned: 5 }] });
    expect(overRet.status).toBe(400);

    // Valid consignment return of 2 units -> stock increases 14 -> 16, returnedTotal = 1800, totalAmount = 5500 - 1800 = 3700
    const retRes = await request(app)
      .post(`/api/orders/${order.id}/consignment-returns`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        notes: 'Devolución sala Masaya',
        items: [{ orderItemId: itemId, quantityReturned: 2 }],
      });
    expect(retRes.status).toBe(201);
    expect(retRes.body.order.returnedTotal).toBe(1800);
    expect(retRes.body.order.totalAmount).toBe(3700);
    expect(retRes.body.order.amountPending).toBe(3700);

    const updatedProd = await prisma.product.findUnique({
      where: { id: product.id },
    });
    expect(updatedProd?.stock).toBe(16);

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: product.id, type: 'CONSIGNMENT_RETURN' },
    });
    expect(movement?.quantityDelta).toBe(2);

    // Consignments overview report
    const consignList = await request(app)
      .get('/api/orders/consignments?search=Managua&pageSize=0')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(consignList.status).toBe(200);
    expect(consignList.body.orders).toHaveLength(1);
    expect(consignList.body.byCustomer[0]).toMatchObject({
      companyName: 'Muebles Managua',
      unitsDispatched: 4,
      unitsReturned: 2,
      unitsNetInStore: 2,
      returnedCredit: 1800,
    });

    // Generate & inspect Excel files (invoice, consignment, delivery)
    for (const type of ['invoice', 'consignment', 'delivery'] as const) {
      const excelRes = await request(app)
        .get(`/api/orders/${order.id}/excel?type=${type}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .buffer(true)
        .parse(binaryParser);
      expect(excelRes.status).toBe(200);
      expect(excelRes.headers['content-type']).toContain('spreadsheetml.sheet');

      const wb = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(excelRes.body as any);
      const ws = wb.worksheets[0];
      expect(ws).toBeDefined();
      expect(ws.getCell('C1').value).toBe('Arte Modelo Dubois');
      expect(ws.getImages().length).toBeGreaterThanOrEqual(1);

      const allText = ws
        .getSheetValues()
        .flat()
        .filter(Boolean)
        .map(String)
        .join(' ');
      expect(allText).toContain('Muebles Managua');
      if (type === 'delivery') {
        expect(allText).toContain('Pendiente por entregar');
        expect(allText).toContain('TicaBus');
      }
    }

    // Dashboard KPIs for Staff & Customer
    const staffDash = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(staffDash.status).toBe(200);
    expect(staffDash.body.role).toBe('ADMIN');
    expect(staffDash.body.lowStockProducts[0].primaryCode).toBe('AMD-NOG-01');
    const nioRec = staffDash.body.receivableByCurrency.find(
      (r: { currency: string }) => r.currency === 'NIO',
    );
    expect(nioRec.totalPending).toBe(3700);
    expect(staffDash.body.upcomingConsignments).toHaveLength(1);

    const custDash = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${custUser.token}`);
    expect(custDash.status).toBe(200);
    expect(custDash.body.role).toBe('CUSTOMER');
    expect(custDash.body.linked).toBe(true);
  });
});
