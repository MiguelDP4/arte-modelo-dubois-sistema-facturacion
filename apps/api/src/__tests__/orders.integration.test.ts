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

describe('Orders Engine API integration (Phase 4)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function seedCatalogAndCustomers() {
    const admin = await createAndLoginUser({
      email: 'admin@artemodelo.gt',
      fullName: 'Admin Dubois',
      role: 'ADMIN',
    });
    const emp = await createAndLoginUser({
      email: 'emp@artemodelo.gt',
      fullName: 'Empleado Bodega',
      role: 'EMPLOYEE',
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

    const custHnRes = await request(app)
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
    const custHn = custHnRes.body.customer;

    const custUser = await createAndLoginUser({
      email: 'cliente@elquetzal.gt',
      fullName: 'Cliente Quetzal',
      role: 'CUSTOMER',
      customerId: custGt.id,
    });
    const unlinkedCustUser = await createAndLoginUser({
      email: 'sinvincular@cliente.gt',
      fullName: 'Cliente Sin Vincular',
      role: 'CUSTOMER',
    });

    const p1Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Marco Clásico Azul',
        codes: [{ code: 'AMD-MC-01', label: 'Interno', isPrimary: true }],
        priceGTQ: 200,
        priceHNL: 650,
        initialStock: 10,
        lowStockThreshold: 3,
      });
    const prod1 = p1Res.body.product;

    const p2Res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Moldura Dorada',
        codes: [{ code: 'AMD-MD-02', label: 'Interno', isPrimary: true }],
        priceGTQ: 150,
        priceHNL: 490,
        initialStock: 8,
        lowStockThreshold: 2,
      });
    const prod2 = p2Res.body.product;

    return { admin, emp, custGt, custHn, custUser, unlinkedCustUser, prod1, prod2 };
  }

  it('enforces RBAC, customer portal flow (PENDING_CONFIRMATION + masked prices), staff confirmation & last-price immutability', async () => {
    const {
      admin,
      emp,
      custGt,
      custHn,
      custUser,
      unlinkedCustUser,
      prod1,
      prod2,
    } = await seedCatalogAndCustomers();

    // Unauthenticated rejected
    expect((await request(app).get('/api/orders')).status).toBe(401);

    // Unlinked CUSTOMER cannot create order
    const unlinkedCreate = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${unlinkedCustUser.token}`)
      .send({ items: [{ productId: prod1.id, quantityOrdered: 2 }] });
    expect(unlinkedCreate.status).toBe(400);

    // CUSTOMER blocked from /last-price
    const lpBlocked = await request(app)
      .get(`/api/orders/last-price?customerId=${custGt.id}&productId=${prod1.id}`)
      .set('Authorization', `Bearer ${custUser.token}`);
    expect(lpBlocked.status).toBe(403);

    // Initial last-price lookup shows no history + catalog price
    const lpInitial = await request(app)
      .get(`/api/orders/last-price?customerId=${custGt.id}&productId=${prod1.id}`)
      .set('Authorization', `Bearer ${emp.token}`);
    expect(lpInitial.status).toBe(200);
    expect(lpInitial.body.hasHistory).toBe(false);
    expect(lpInitial.body.catalogPrice).toBe(200);
    expect(lpInitial.body.currency).toBe('GTQ');

    // CUSTOMER creates order: lands in PENDING_CONFIRMATION, prices masked, ignores attempted custom price/shipping/type
    const custCreateRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${custUser.token}`)
      .send({
        customerId: custHn.id,
        type: 'CONSIGNMENT',
        shippingCost: 99,
        notes: 'Por favor revisar existencia',
        items: [{ productId: prod1.id, quantityOrdered: 3, unitPrice: 1 }],
      });
    expect(custCreateRes.status).toBe(201);
    const pendingOrder = custCreateRes.body.order;
    expect(pendingOrder.customerId).toBe(custGt.id);
    expect(pendingOrder.type).toBe('REGULAR');
    expect(pendingOrder.approvalStatus).toBe('PENDING_CONFIRMATION');
    expect(pendingOrder.fulfillmentStatus).toBe('PENDING_PACKING');
    expect(pendingOrder.paymentStatus).toBe('PENDING_PAYMENT');
    expect(pendingOrder.pricesVisible).toBe(false);
    expect(pendingOrder.totalAmount).toBeNull();
    expect(pendingOrder.items[0].unitPrice).toBeNull();

    // CUSTOMER cannot edit, confirm, pack, dispatch or cancel orders
    expect(
      (
        await request(app)
          .patch(`/api/orders/${pendingOrder.id}`)
          .set('Authorization', `Bearer ${custUser.token}`)
          .send({ notes: 'hack' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/orders/${pendingOrder.id}/confirm`)
          .set('Authorization', `Bearer ${custUser.token}`)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/orders/${pendingOrder.id}/pack`)
          .set('Authorization', `Bearer ${custUser.token}`)
          .send({ items: [{ orderItemId: pendingOrder.items[0].id, quantityPacked: 1 }] })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/orders/${pendingOrder.id}/cancel`)
          .set('Authorization', `Bearer ${custUser.token}`)
          .send({ cancelReason: 'No autorizado' })
      ).status,
    ).toBe(403);

    // Staff sees real prices & confirms order with negotiated price (175 instead of 200) and shipping
    const confirmRes = await request(app)
      .post(`/api/orders/${pendingOrder.id}/confirm`)
      .set('Authorization', `Bearer ${emp.token}`)
      .send({
        shippingCost: 40,
        shippingDiscount: 10,
        items: [
          {
            productId: prod1.id,
            quantityOrdered: 3,
            unitPrice: 175,
            discountType: 'FIXED',
            discountValue: 25,
          },
          {
            productId: prod2.id,
            quantityOrdered: 2,
            unitPrice: 150,
            discountType: 'PERCENT',
            discountValue: 10,
          },
        ],
      });
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.order.approvalStatus).toBe('CONFIRMED');
    // Line 1: 3*175 - 25 = 500; Line 2: 2*150 - 30 = 270; shipping = 40 - 10 = 30 -> total 800
    expect(confirmRes.body.order.subtotal).toBe(825);
    expect(confirmRes.body.order.itemsDiscountTotal).toBe(55);
    expect(confirmRes.body.order.totalAmount).toBe(800);

    // Now CUSTOMER can see confirmed frozen prices
    const custViewConfirmed = await request(app)
      .get(`/api/orders/${pendingOrder.id}`)
      .set('Authorization', `Bearer ${custUser.token}`);
    expect(custViewConfirmed.status).toBe(200);
    expect(custViewConfirmed.body.order.pricesVisible).toBe(true);
    expect(custViewConfirmed.body.order.totalAmount).toBe(800);

    // Updating catalog price does NOT mutate confirmed order, and /last-price returns Q 175
    await request(app)
      .patch(`/api/products/${prod1.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ priceGTQ: 260 });

    const orderAfterCatalogChange = await request(app)
      .get(`/api/orders/${pendingOrder.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(orderAfterCatalogChange.body.order.items[0].unitPrice).toBe(175);

    const lpHistory = await request(app)
      .get(`/api/orders/last-price?customerId=${custGt.id}&productId=${prod1.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(lpHistory.status).toBe(200);
    expect(lpHistory.body.hasHistory).toBe(true);
    expect(lpHistory.body.lastPrice).toBe(175);
    expect(lpHistory.body.catalogPrice).toBe(260);
    expect(lpHistory.body.lastOrderNumber).toBe(pendingOrder.orderNumber);

    // Staff creates a CONSIGNMENT order for HN customer and checks cross-customer isolation + pagination
    const hnOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        customerId: custHn.id,
        type: 'CONSIGNMENT',
        consignmentDueDate: '2026-12-30',
        items: [{ productId: prod1.id, quantityOrdered: 2, unitPrice: 640 }],
      });
    expect(hnOrderRes.status).toBe(201);
    const hnOrder = hnOrderRes.body.order;

    // GT customer blocked from viewing HN order
    expect(
      (
        await request(app)
          .get(`/api/orders/${hnOrder.id}`)
          .set('Authorization', `Bearer ${custUser.token}`)
      ).status,
    ).toBe(403);

    // Pagination & pageSize=0 on /api/orders + customer detail order history + archive guard
    const paged1 = await request(app)
      .get('/api/orders?page=1&pageSize=1')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(paged1.status).toBe(200);
    expect(paged1.body.orders).toHaveLength(1);
    expect(paged1.body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
      hasPrev: false,
      hasNext: true,
    });

    const allOrders = await request(app)
      .get('/api/orders?pageSize=0&type=CONSIGNMENT')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(allOrders.status).toBe(200);
    expect(allOrders.body.orders).toHaveLength(1);
    expect(allOrders.body.pagination.pageSize).toBe(0);

    const custDetail = await request(app)
      .get(`/api/customers/${custHn.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(custDetail.body.orders).toHaveLength(1);

    const archiveWithOrder = await request(app)
      .delete(`/api/customers/${custHn.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(archiveWithOrder.status).toBe(409);
  });

  it('handles delta packing (ORDER_PACK / ORDER_REVERT), partial & full dispatches, decoupled paymentStatus, and logical cancellation', async () => {
    const { admin, custGt, prod1, prod2 } = await seedCatalogAndCustomers();

    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        customerId: custGt.id,
        type: 'REGULAR',
        items: [
          { productId: prod1.id, quantityOrdered: 5, unitPrice: 200 },
          { productId: prod2.id, quantityOrdered: 4, unitPrice: 150 },
        ],
      });
    expect(createRes.status).toBe(201);
    const order = createRes.body.order;
    const item1 = order.items[0];
    const item2 = order.items[1];

    // Exceeding stock fails atomically
    const overStockPack = await request(app)
      .post(`/api/orders/${order.id}/pack`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        items: [{ orderItemId: item1.id, quantityPacked: 5 }],
      });
    expect(overStockPack.status).toBe(200); // stock 10 >= 5

    // Adjust back down from 5 -> 3 (reverts +2 via ORDER_REVERT) -> stock goes 5 -> 7
    const adjustDown = await request(app)
      .post(`/api/orders/${order.id}/pack`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        items: [{ orderItemId: item1.id, quantityPacked: 3 }],
        notes: 'Ajuste conteo',
      });
    expect(adjustDown.status).toBe(200);
    expect(adjustDown.body.order.fulfillmentStatus).toBe('PACKING');

    const prod1Mid = await request(app)
      .get(`/api/products/${prod1.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(prod1Mid.body.product.stock).toBe(7);

    // Staff edits order to update shipping and pack remaining of item1 + item2 -> READY_TO_DISPATCH
    const editRes = await request(app)
      .patch(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ shippingCost: 50 });
    expect(editRes.status).toBe(200);
    expect(editRes.body.order.totalAmount).toBe(5 * 200 + 4 * 150 + 50);

    // Cannot dispatch unpacked units
    const badDispatch = await request(app)
      .post(`/api/orders/${order.id}/dispatches`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ items: [{ orderItemId: item1.id, quantityToDispatch: 4 }] });
    expect(badDispatch.status).toBe(400);

    // Partial dispatch of 2 units from item1
    const dispatch1 = await request(app)
      .post(`/api/orders/${order.id}/dispatches`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        carrier: 'Cargo Expreso',
        notes: 'Entrega parcial #1',
        items: [{ orderItemId: item1.id, quantityToDispatch: 2 }],
      });
    expect(dispatch1.status).toBe(201);
    expect(dispatch1.body.order.fulfillmentStatus).toBe('PARTIALLY_DISPATCHED');
    expect(dispatch1.body.order.paymentStatus).toBe('PENDING_PAYMENT');
    expect(dispatch1.body.order.dispatches[0].items[0]).toMatchObject({
      quantityDispatched: 2,
      cumulativeDispatched: 2,
      remainingPending: 3,
    });

    // Cannot pack below already dispatched (2)
    const packBelowDispatched = await request(app)
      .post(`/api/orders/${order.id}/pack`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ items: [{ orderItemId: item1.id, quantityPacked: 1 }] });
    expect(packBelowDispatched.status).toBe(400);

    // Cannot cancel order once units have been dispatched
    const cancelBlocked = await request(app)
      .post(`/api/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ cancelReason: 'Intentando cancelar ya despachado' });
    expect(cancelBlocked.status).toBe(400);

    // Pack all remaining units -> full dispatch -> COMPLETED (while paymentStatus stays PENDING_PAYMENT!)
    await request(app)
      .post(`/api/orders/${order.id}/pack`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        items: [
          { orderItemId: item1.id, quantityPacked: 5 },
          { orderItemId: item2.id, quantityPacked: 4 },
        ],
      });

    const dispatch2 = await request(app)
      .post(`/api/orders/${order.id}/dispatches`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        carrier: 'Entrega Final',
        items: [
          { orderItemId: item1.id, quantityToDispatch: 3 },
          { orderItemId: item2.id, quantityToDispatch: 4 },
        ],
      });
    expect(dispatch2.status).toBe(201);
    expect(dispatch2.body.order.fulfillmentStatus).toBe('COMPLETED');
    expect(dispatch2.body.order.paymentStatus).toBe('PENDING_PAYMENT');
    expect(dispatch2.body.order.dispatches).toHaveLength(2);

    // Second order: pack 4 units then logical cancel -> reverts stock cleanly & creates ORDER_REVERT
    const orderCancelRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        customerId: custGt.id,
        items: [{ productId: prod1.id, quantityOrdered: 4, unitPrice: 200 }],
      });
    const order2 = orderCancelRes.body.order;

    await request(app)
      .post(`/api/orders/${order2.id}/pack`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ items: [{ orderItemId: order2.items[0].id, quantityPacked: 4 }] });

    const stockBeforeCancel = (
      await request(app)
        .get(`/api/products/${prod1.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
    ).body.product.stock;
    expect(stockBeforeCancel).toBe(1);

    const cancelOk = await request(app)
      .post(`/api/orders/${order2.id}/cancel`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ cancelReason: 'Cliente cambió especificaciones' });
    expect(cancelOk.status).toBe(200);
    expect(cancelOk.body.order.approvalStatus).toBe('CANCELLED');

    const stockAfterCancel = (
      await request(app)
        .get(`/api/products/${prod1.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
    ).body.product.stock;
    expect(stockAfterCancel).toBe(5);
  });
});
