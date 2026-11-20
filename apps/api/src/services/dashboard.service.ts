import { CURRENCIES, type Currency } from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';

export async function getDashboardSummary(actor: AuthenticatedUser) {
  if (actor.role === 'CUSTOMER') {
    if (!actor.customerId) {
      return {
        role: 'CUSTOMER' as const,
        linked: false,
        customerCounts: {
          pendingConfirmation: 0,
          inProgress: 0,
          delivered: 0,
        },
        recentOrders: [],
      };
    }

    const orders = await prisma.order.findMany({
      where: {
        customerId: actor.customerId,
        approvalStatus: { not: 'CANCELLED' },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        orderNumber: true,
        type: true,
        approvalStatus: true,
        fulfillmentStatus: true,
        paymentStatus: true,
        currency: true,
        totalAmount: true,
        amountPending: true,
        consignmentDueDate: true,
        createdAt: true,
      },
    });

    const pendingConfirmation = orders.filter(
      (o) => o.approvalStatus === 'PENDING_CONFIRMATION',
    ).length;
    const inProgress = orders.filter(
      (o) =>
        o.approvalStatus === 'CONFIRMED' && o.fulfillmentStatus !== 'COMPLETED',
    ).length;
    const delivered = orders.filter(
      (o) =>
        o.approvalStatus === 'CONFIRMED' && o.fulfillmentStatus === 'COMPLETED',
    ).length;

    return {
      role: 'CUSTOMER' as const,
      linked: true,
      customerCounts: {
        pendingConfirmation,
        inProgress,
        delivered,
      },
      recentOrders: orders.slice(0, 8).map((o) => {
        const hidePrices = o.approvalStatus === 'PENDING_CONFIRMATION';
        return {
          id: o.id,
          orderNumber: o.orderNumber,
          type: o.type,
          approvalStatus: o.approvalStatus,
          fulfillmentStatus: o.fulfillmentStatus,
          paymentStatus: o.paymentStatus,
          currency: o.currency as Currency,
          pricesVisible: !hidePrices,
          totalAmount: hidePrices ? null : o.totalAmount,
          amountPending: hidePrices ? null : o.amountPending,
          consignmentDueDate: o.consignmentDueDate,
          createdAt: o.createdAt,
        };
      }),
    };
  }

  const activeOrders = await prisma.order.findMany({
    where: { approvalStatus: { not: 'CANCELLED' } },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      customer: {
        select: { id: true, companyName: true, country: true, currency: true },
      },
    },
  });

  const pendingConfirmationCount = activeOrders.filter(
    (o) => o.approvalStatus === 'PENDING_CONFIRMATION',
  ).length;
  const pendingPackingCount = activeOrders.filter(
    (o) =>
      o.approvalStatus === 'CONFIRMED' &&
      (o.fulfillmentStatus === 'PENDING_PACKING' ||
        o.fulfillmentStatus === 'PACKING'),
  ).length;
  const readyToDispatchCount = activeOrders.filter(
    (o) =>
      o.approvalStatus === 'CONFIRMED' &&
      o.fulfillmentStatus === 'READY_TO_DISPATCH',
  ).length;
  const partiallyDispatchedCount = activeOrders.filter(
    (o) =>
      o.approvalStatus === 'CONFIRMED' &&
      o.fulfillmentStatus === 'PARTIALLY_DISPATCHED',
  ).length;

  const receivableByCurrency = CURRENCIES.map((curr) => {
    const confirmedCurr = activeOrders.filter(
      (o) => o.approvalStatus === 'CONFIRMED' && o.currency === curr,
    );
    const pendingCurr = confirmedCurr.filter((o) => o.amountPending > 0);
    return {
      currency: curr,
      ordersWithBalance: pendingCurr.length,
      totalBilled:
        Math.round(
          confirmedCurr.reduce((acc, o) => acc + o.totalAmount, 0) * 100,
        ) / 100,
      totalPaid:
        Math.round(
          confirmedCurr.reduce((acc, o) => acc + o.amountPaid, 0) * 100,
        ) / 100,
      totalPending:
        Math.round(
          pendingCurr.reduce((acc, o) => acc + o.amountPending, 0) * 100,
        ) / 100,
    };
  });

  const nowMs = Date.now();
  const upcomingConsignments = activeOrders
    .filter(
      (o) =>
        o.type === 'CONSIGNMENT' &&
        o.approvalStatus === 'CONFIRMED' &&
        (o.amountPending > 0 || o.fulfillmentStatus !== 'COMPLETED'),
    )
    .sort((a, b) => {
      const ta = a.consignmentDueDate
        ? a.consignmentDueDate.getTime()
        : Number.MAX_SAFE_INTEGER;
      const tb = b.consignmentDueDate
        ? b.consignmentDueDate.getTime()
        : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    })
    .slice(0, 6)
    .map((o) => {
      const daysRemaining = o.consignmentDueDate
        ? Math.ceil((o.consignmentDueDate.getTime() - nowMs) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId,
        customerName: o.customer.companyName,
        currency: o.currency as Currency,
        amountPending: o.amountPending,
        fulfillmentStatus: o.fulfillmentStatus,
        consignmentDueDate: o.consignmentDueDate,
        daysRemaining,
        isOverdue: daysRemaining !== null && daysRemaining < 0,
      };
    });

  const activeProducts = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      stock: true,
      lowStockThreshold: true,
      codes: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        take: 1,
        select: { code: true },
      },
    },
  });

  const lowStockProducts = activeProducts
    .filter((p) => p.stock <= p.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      primaryCode: p.codes[0]?.code ?? '',
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
    }));

  const recentOrders = activeOrders.slice(0, 6).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customer.companyName,
    type: o.type,
    approvalStatus: o.approvalStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    paymentStatus: o.paymentStatus,
    currency: o.currency as Currency,
    totalAmount: o.totalAmount,
    amountPending: o.amountPending,
    createdAt: o.createdAt,
  }));

  return {
    role: actor.role,
    staffCounts: {
      pendingConfirmationCount,
      pendingPackingCount,
      readyToDispatchCount,
      partiallyDispatchedCount,
    },
    receivableByCurrency,
    upcomingConsignments,
    lowStockProducts,
    recentOrders,
  };
}
