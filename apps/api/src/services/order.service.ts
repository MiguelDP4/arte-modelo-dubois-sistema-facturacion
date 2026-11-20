import {
  buildPaginationMeta,
  calculateOrderLine,
  calculateOrderTotals,
  COUNTRIES,
  COUNTRY_LABELS,
  deriveFulfillmentStatus,
  derivePaymentStatus,
  formatCurrency,
  PAYMENT_METHOD_LABELS,
  roundMoney,
  type ApprovalStatus,
  type CancelOrderInput,
  type ConfirmOrderInput,
  type CountryCode,
  type CreateConsignmentReturnInput,
  type CreateDispatchInput,
  type CreateOrderInput,
  type CreatePaymentInput,
  type Currency,
  type DiscountType,
  type OrderItemInput,
  type PackOrderInput,
  type PaymentMethod,
  type UpdateOrderInput,
  type VoidPaymentInput,
} from '@arte-modelo/shared';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { badRequest, forbidden, notFound } from '../lib/errors';
import {
  containsFilter,
  parsePaginationQuery,
  prismaPaginationArgs,
} from '../lib/pagination';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import {
  sendCustomerOrderPendingStaffEmail,
  sendOrderConfirmedCustomerEmail,
  sendOrderDispatchedCustomerEmail,
  sendPaymentRegisteredCustomerEmail,
} from './email.service';

const orderDetailInclude = {
  customer: {
    select: {
      id: true,
      companyName: true,
      managerName: true,
      phone: true,
      email: true,
      country: true,
      currency: true,
      address: true,
      taxId: true,
    },
  },
  items: {
    orderBy: [{ createdAt: 'asc' as const }, { productName: 'asc' as const }],
    include: {
      product: {
        select: {
          id: true,
          stock: true,
          images: {
            orderBy: { sortOrder: 'asc' as const },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  },
  dispatches: {
    orderBy: [{ dispatchNumber: 'asc' as const }],
    include: {
      dispatchedBy: {
        select: { id: true, fullName: true },
      },
      items: {
        include: {
          orderItem: {
            select: {
              id: true,
              productName: true,
              productPrimaryCode: true,
              quantityOrdered: true,
            },
          },
        },
      },
    },
  },
  payments: {
    orderBy: [{ paymentDate: 'desc' as const }, { createdAt: 'desc' as const }],
    include: {
      registeredBy: { select: { id: true, fullName: true } },
      voidedBy: { select: { id: true, fullName: true } },
    },
  },
  consignmentReturns: {
    orderBy: [{ returnNumber: 'asc' as const }],
    include: {
      receivedBy: { select: { id: true, fullName: true } },
      items: {
        include: {
          orderItem: {
            select: {
              id: true,
              productName: true,
              productPrimaryCode: true,
            },
          },
        },
      },
    },
  },
  createdBy: { select: { id: true, fullName: true } },
  confirmedBy: { select: { id: true, fullName: true } },
  cancelledBy: { select: { id: true, fullName: true } },
};

const orderListInclude = {
  customer: orderDetailInclude.customer,
  items: orderDetailInclude.items,
  _count: {
    select: {
      dispatches: true,
      payments: true,
      consignmentReturns: true,
    },
  },
  createdBy: { select: { id: true, fullName: true } },
  confirmedBy: { select: { id: true, fullName: true } },
  cancelledBy: { select: { id: true, fullName: true } },
};

function getCatalogPriceForCurrency(
  product: {
    priceGTQ: number | null;
    priceHNL: number | null;
    priceNIO: number | null;
    priceUSD: number | null;
  },
  currency: Currency,
): number | null {
  switch (currency) {
    case 'GTQ':
      return product.priceGTQ;
    case 'HNL':
      return product.priceHNL;
    case 'NIO':
      return product.priceNIO;
    case 'USD':
      return product.priceUSD;
  }
}

function parseDueDate(raw: string | null | undefined): Date | null {
  if (!raw || !raw.trim()) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest('La fecha sugerida de consignación no es válida.');
  }
  return parsed;
}

function serializeOrder(
  order: {
    id: string;
    orderNumber: string;
    customerId: string;
    type: string;
    approvalStatus: string;
    fulfillmentStatus: string;
    paymentStatus: string;
    currency: string;
    subtotal: number;
    itemsDiscountTotal: number;
    shippingCost: number;
    shippingDiscount: number;
    returnedTotal: number;
    totalAmount: number;
    amountPaid: number;
    amountPending: number;
    consignmentDueDate: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
    customer: {
      id: string;
      companyName: string;
      managerName: string;
      phone: string;
      email: string;
      country: string;
      currency: string;
      address: string;
      taxId: string;
    };
    items: Array<{
      id: string;
      orderId: string;
      productId: string;
      productName: string;
      productPrimaryCode: string;
      quantityOrdered: number;
      quantityPacked: number;
      quantityDispatched: number;
      quantityReturned: number;
      unitPrice: number;
      discountType: string;
      discountValue: number;
      discountAmount: number;
      lineTotal: number;
      product?: {
        id: string;
        stock: number;
        images?: Array<{ url: string }>;
      } | null;
    }>;
    dispatches?: Array<{
      id: string;
      dispatchNumber: number;
      dispatchedAt: Date;
      carrier: string | null;
      notes: string | null;
      dispatchedBy: { id: string; fullName: string } | null;
      items: Array<{
        id: string;
        orderItemId: string;
        quantityDispatched: number;
        cumulativeDispatched: number;
        remainingPending: number;
        orderItem: {
          id: string;
          productName: string;
          productPrimaryCode: string;
          quantityOrdered: number;
        };
      }>;
    }>;
    payments?: Array<{
      id: string;
      orderId: string;
      amount: number;
      method: string;
      paymentDate: Date;
      reference: string | null;
      receiptImageUrl: string | null;
      notes: string | null;
      status: string;
      voidReason: string | null;
      voidedAt: Date | null;
      registeredBy: { id: string; fullName: string } | null;
      voidedBy: { id: string; fullName: string } | null;
      createdAt: Date;
    }>;
    consignmentReturns?: Array<{
      id: string;
      orderId: string;
      returnNumber: number;
      returnedAt: Date;
      notes: string | null;
      totalCredit: number;
      receivedBy: { id: string; fullName: string } | null;
      items: Array<{
        id: string;
        orderItemId: string;
        quantityReturned: number;
        unitCredit: number;
        lineCredit: number;
        orderItem: {
          id: string;
          productName: string;
          productPrimaryCode: string;
        };
      }>;
    }>;
    _count?: {
      dispatches: number;
      payments?: number;
      consignmentReturns?: number;
    };
    createdBy?: { id: string; fullName: string } | null;
    confirmedBy?: { id: string; fullName: string } | null;
    cancelledBy?: { id: string; fullName: string } | null;
  },
  actor: AuthenticatedUser,
) {
  const hidePrices =
    actor.role === 'CUSTOMER' &&
    (order.approvalStatus as ApprovalStatus) === 'PENDING_CONFIRMATION';
  const country = (
    (COUNTRIES as readonly string[]).includes(order.customer.country)
      ? order.customer.country
      : 'OTHER'
  ) as CountryCode;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customer: {
      ...order.customer,
      country,
      countryLabel: COUNTRY_LABELS[country],
    },
    type: order.type,
    approvalStatus: order.approvalStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentStatus: order.paymentStatus,
    currency: order.currency as Currency,
    pricesVisible: !hidePrices,
    subtotal: hidePrices ? null : order.subtotal,
    itemsDiscountTotal: hidePrices ? null : order.itemsDiscountTotal,
    shippingCost: hidePrices ? null : order.shippingCost,
    shippingDiscount: hidePrices ? null : order.shippingDiscount,
    returnedTotal: hidePrices ? null : order.returnedTotal,
    totalAmount: hidePrices ? null : order.totalAmount,
    amountPaid: hidePrices ? null : order.amountPaid,
    amountPending: hidePrices ? null : order.amountPending,
    consignmentDueDate: order.consignmentDueDate,
    notes: order.notes,
    createdBy: order.createdBy ?? null,
    confirmedBy: order.confirmedBy ?? null,
    confirmedAt: order.confirmedAt,
    cancelledBy: order.cancelledBy ?? null,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    itemsCount: order.items.length,
    dispatchesCount:
      order.dispatches?.length ?? order._count?.dispatches ?? 0,
    paymentsCount: order.payments?.length ?? order._count?.payments ?? 0,
    consignmentReturnsCount:
      order.consignmentReturns?.length ?? order._count?.consignmentReturns ?? 0,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      productPrimaryCode: item.productPrimaryCode,
      quantityOrdered: item.quantityOrdered,
      quantityPacked: item.quantityPacked,
      quantityDispatched: item.quantityDispatched,
      quantityReturned: item.quantityReturned,
      quantityPendingDispatch: Math.max(
        0,
        item.quantityOrdered - item.quantityDispatched,
      ),
      quantityNetConsigned: Math.max(
        0,
        item.quantityDispatched - item.quantityReturned,
      ),
      quantityAvailableToReturn: Math.max(
        0,
        item.quantityDispatched - item.quantityReturned,
      ),
      currentStock:
        actor.role !== 'CUSTOMER' ? (item.product?.stock ?? null) : null,
      productImageUrl: item.product?.images?.[0]?.url ?? null,
      unitPrice: hidePrices ? null : item.unitPrice,
      discountType: item.discountType as DiscountType,
      discountValue: hidePrices ? null : item.discountValue,
      discountAmount: hidePrices ? null : item.discountAmount,
      lineTotal: hidePrices ? null : item.lineTotal,
    })),
    ...(order.dispatches ? { dispatches: order.dispatches } : {}),
    ...(order.payments
      ? {
          payments: order.payments.map((p) => ({
            ...p,
            amount: hidePrices ? null : p.amount,
          })),
        }
      : {}),
    ...(order.consignmentReturns
      ? {
          consignmentReturns: order.consignmentReturns.map((r) => ({
            ...r,
            totalCredit: hidePrices ? null : r.totalCredit,
            items: r.items.map((ri) => ({
              ...ri,
              unitCredit: hidePrices ? null : ri.unitCredit,
              lineCredit: hidePrices ? null : ri.lineCredit,
            })),
          })),
        }
      : {}),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function generateNextOrderNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
  const year = new Date().getFullYear();
  const prefix = `PED-${year}-`;
  const latest = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: [{ orderNumber: 'desc' }],
    select: { orderNumber: true },
  });

  const lastSeq = latest
    ? Number(latest.orderNumber.slice(prefix.length)) || 0
    : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

async function resolveOrderItemsForPersistence(params: {
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  customerId: string;
  currency: Currency;
  rawItems: OrderItemInput[];
  allowCustomPrice: boolean;
  existingItemsByProductId?: Map<
    string,
    { quantityPacked: number; quantityDispatched: number }
  >;
}) {
  const seen = new Set<string>();
  for (const item of params.rawItems) {
    if (seen.has(item.productId)) {
      throw badRequest(
        'No repitas el mismo producto en líneas separadas; ajusta la cantidad en la línea existente.',
      );
    }
    seen.add(item.productId);
  }

  const productIds = params.rawItems.map((i) => i.productId);
  const products = await params.tx.product.findMany({
    where: { id: { in: productIds }, isActive: true, deletedAt: null },
    include: {
      codes: {
        orderBy: [{ isPrimary: 'desc' }, { code: 'asc' }],
      },
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const built: Array<{
    productId: string;
    productName: string;
    productPrimaryCode: string;
    quantityOrdered: number;
    quantityPacked: number;
    quantityDispatched: number;
    unitPrice: number;
    discountType: DiscountType;
    discountValue: number;
    discountAmount: number;
    lineTotal: number;
    gross: number;
  }> = [];

  for (const inputItem of params.rawItems) {
    const product = productMap.get(inputItem.productId);
    if (!product) {
      throw badRequest(
        'Uno de los productos seleccionados no existe o se encuentra archivado.',
      );
    }

    const existingCounters = params.existingItemsByProductId?.get(
      inputItem.productId,
    );
    const quantityPacked = existingCounters?.quantityPacked ?? 0;
    const quantityDispatched = existingCounters?.quantityDispatched ?? 0;

    if (inputItem.quantityOrdered < quantityPacked) {
      throw badRequest(
        `No puedes reducir "${product.name}" por debajo de ${quantityPacked} unidades ya empacadas.`,
      );
    }

    let unitPrice: number;
    if (params.allowCustomPrice && inputItem.unitPrice !== undefined) {
      unitPrice = roundMoney(inputItem.unitPrice);
    } else {
      const lastItem = await params.tx.orderItem.findFirst({
        where: {
          productId: product.id,
          order: { customerId: params.customerId, approvalStatus: { not: 'CANCELLED' } },
        },
        orderBy: [{ order: { createdAt: 'desc' } }, { createdAt: 'desc' }],
        select: { unitPrice: true },
      });
      const catalogPrice = getCatalogPriceForCurrency(product, params.currency);
      unitPrice = roundMoney(lastItem?.unitPrice ?? catalogPrice ?? 0);
    }

    const discountType: DiscountType = params.allowCustomPrice
      ? (inputItem.discountType ?? 'FIXED')
      : 'FIXED';
    const discountValue = params.allowCustomPrice
      ? roundMoney(inputItem.discountValue ?? 0)
      : 0;

    const line = calculateOrderLine({
      quantityOrdered: inputItem.quantityOrdered,
      unitPrice,
      discountType,
      discountValue,
    });

    const primaryCode = product.codes[0]?.code ?? product.id.slice(0, 8);

    built.push({
      productId: product.id,
      productName: product.name,
      productPrimaryCode: primaryCode,
      quantityOrdered: inputItem.quantityOrdered,
      quantityPacked,
      quantityDispatched,
      unitPrice,
      discountType,
      discountValue,
      discountAmount: line.discountAmount,
      lineTotal: line.lineTotal,
      gross: line.gross,
    });
  }

  return built;
}

export async function listOrders(
  query: {
    search?: string;
    approvalStatus?: string;
    fulfillmentStatus?: string;
    paymentStatus?: string;
    type?: string;
    customerId?: string;
    page?: unknown;
    pageSize?: unknown;
  },
  actor: AuthenticatedUser,
) {
  const { page, pageSize } = parsePaginationQuery(query);
  const where: Record<string, unknown> = {};

  if (actor.role === 'CUSTOMER') {
    where.customerId = actor.customerId ?? '__UNLINKED__';
  } else if (query.customerId && query.customerId !== 'ALL') {
    where.customerId = query.customerId;
  }

  if (query.approvalStatus && query.approvalStatus !== 'ALL') {
    where.approvalStatus = query.approvalStatus;
  }
  if (query.fulfillmentStatus && query.fulfillmentStatus !== 'ALL') {
    where.fulfillmentStatus = query.fulfillmentStatus;
  }
  if (query.paymentStatus && query.paymentStatus !== 'ALL') {
    where.paymentStatus = query.paymentStatus;
  }
  if (query.type && query.type !== 'ALL') {
    where.type = query.type;
  }

  const term = query.search?.trim();
  if (term) {
    where.OR = [
      { orderNumber: containsFilter(term) },
      { customer: { companyName: containsFilter(term) } },
      { customer: { taxId: containsFilter(term) } },
      { items: { some: { productName: containsFilter(term) } } },
      { items: { some: { productPrimaryCode: { contains: term.toUpperCase() } } } },
    ];
  }

  const total = await prisma.order.count({ where });
  const pagination = buildPaginationMeta(total, page, pageSize);

  const orders = await prisma.order.findMany({
    where,
    include: orderListInclude,
    orderBy: [{ createdAt: 'desc' }],
    ...prismaPaginationArgs(pagination),
  });

  return {
    orders: orders.map((order) => serializeOrder(order, actor)),
    pagination,
  };
}

export async function getLastPriceForCustomerProduct(
  query: { customerId?: string; productId?: string },
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden('Solo el personal autorizado puede consultar precios por cliente.');
  }

  const customerId = query.customerId?.trim();
  const productId = query.productId?.trim();
  if (!customerId || !productId) {
    throw badRequest('Debes indicar customerId y productId.');
  }

  const [customer, product] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);

  if (!customer) throw notFound('Cliente no encontrado.');
  if (!product) throw notFound('Producto no encontrado.');

  const mostRecent = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { customerId, approvalStatus: { not: 'CANCELLED' } },
    },
    orderBy: [{ order: { createdAt: 'desc' } }, { createdAt: 'desc' }],
    include: {
      order: {
        select: { orderNumber: true, createdAt: true },
      },
    },
  });

  const currency = customer.currency as Currency;
  const catalogPrice = getCatalogPriceForCurrency(product, currency);

  return {
    customerId,
    productId,
    currency,
    catalogPrice,
    lastPrice: mostRecent ? mostRecent.unitPrice : null,
    lastOrderNumber: mostRecent?.order.orderNumber ?? null,
    lastOrderDate: mostRecent?.order.createdAt ?? null,
    hasHistory: Boolean(mostRecent),
  };
}

export async function getOrderById(id: string, actor: AuthenticatedUser) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderDetailInclude,
  });

  if (!order) {
    throw notFound('Pedido no encontrado.');
  }

  if (actor.role === 'CUSTOMER' && order.customerId !== actor.customerId) {
    throw forbidden('No tienes permiso para consultar este pedido.');
  }

  return serializeOrder(order, actor);
}

export async function createOrder(
  input: CreateOrderInput,
  actor: AuthenticatedUser,
) {
  const isCustomer = actor.role === 'CUSTOMER';
  const targetCustomerId = isCustomer
    ? actor.customerId
    : input.customerId?.trim();

  if (!targetCustomerId) {
    throw badRequest(
      isCustomer
        ? 'Tu cuenta aún no está vinculada a una empresa cliente. Comunícate con Arte Modelo Dubois.'
        : 'Debes seleccionar un cliente para crear el pedido.',
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: targetCustomerId },
  });
  if (!customer) {
    throw notFound('Cliente no encontrado.');
  }
  if (!customer.isActive || customer.deletedAt) {
    throw badRequest('No puedes registrar pedidos para un cliente desactivado.');
  }

  const currency = customer.currency as Currency;
  const dueDate = isCustomer ? null : parseDueDate(input.consignmentDueDate);

  const created = await prisma.$transaction(async (tx) => {
    const items = await resolveOrderItemsForPersistence({
      tx,
      customerId: customer.id,
      currency,
      rawItems: input.items,
      allowCustomPrice: !isCustomer,
    });

    const totals = calculateOrderTotals({
      items,
      shippingCost: isCustomer ? 0 : input.shippingCost,
      shippingDiscount: isCustomer ? 0 : input.shippingDiscount,
      amountPaid: 0,
    });

    const orderNumber = await generateNextOrderNumber(tx);
    const now = new Date();

    return tx.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        type: isCustomer ? 'REGULAR' : input.type,
        approvalStatus: isCustomer ? 'PENDING_CONFIRMATION' : 'CONFIRMED',
        fulfillmentStatus: 'PENDING_PACKING',
        paymentStatus: 'PENDING_PAYMENT',
        currency,
        subtotal: totals.subtotal,
        itemsDiscountTotal: totals.itemsDiscountTotal,
        shippingCost: totals.shippingCost,
        shippingDiscount: totals.shippingDiscount,
        totalAmount: totals.totalAmount,
        amountPaid: 0,
        amountPending: totals.amountPending,
        consignmentDueDate: dueDate,
        notes: input.notes?.trim() || null,
        createdById: actor.id,
        confirmedById: isCustomer ? null : actor.id,
        confirmedAt: isCustomer ? null : now,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productPrimaryCode: item.productPrimaryCode,
            quantityOrdered: item.quantityOrdered,
            quantityPacked: 0,
            quantityDispatched: 0,
            unitPrice: item.unitPrice,
            discountType: item.discountType,
            discountValue: item.discountValue,
            discountAmount: item.discountAmount,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: orderDetailInclude,
    });
  });

  if (isCustomer) {
    try {
      const staffUsers = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'EMPLOYEE'] },
          isActive: true,
          isVerified: true,
        },
        select: { email: true },
      });
      const orderUrl = `${env.frontendUrl}/pedidos/${created.id}`;
      await Promise.all(
        staffUsers.map((staff) =>
          sendCustomerOrderPendingStaffEmail({
            to: staff.email,
            orderNumber: created.orderNumber,
            customerName: customer.companyName,
            itemsCount: created.items.length,
            orderUrl,
          }),
        ),
      );
    } catch {
      // No bloquear creación del pedido si falla el proveedor de correo
    }
  }

  return {
    order: serializeOrder(created, actor),
    message: isCustomer
      ? 'Pedido enviado correctamente. Queda pendiente de confirmación por Arte Modelo Dubois.'
      : 'Pedido creado y confirmado correctamente.',
  };
}

export async function confirmOrder(
  orderId: string,
  input: ConfirmOrderInput,
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden('Solo el personal autorizado puede confirmar pedidos.');
  }

  const confirmed = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!existing) {
      throw notFound('Pedido no encontrado.');
    }
    if (existing.approvalStatus !== 'PENDING_CONFIRMATION') {
      throw badRequest('Solo se pueden confirmar pedidos pendientes de confirmación.');
    }

    const currency = existing.currency as Currency;
    const dueDate =
      input.consignmentDueDate !== undefined
        ? parseDueDate(input.consignmentDueDate)
        : existing.consignmentDueDate;

    const preparedItems = input.items
      ? await resolveOrderItemsForPersistence({
          tx,
          customerId: existing.customerId,
          currency,
          rawItems: input.items,
          allowCustomPrice: true,
        })
      : existing.items.map((item) => {
          const line = calculateOrderLine({
            quantityOrdered: item.quantityOrdered,
            unitPrice: item.unitPrice,
            discountType: item.discountType as DiscountType,
            discountValue: item.discountValue,
          });
          return {
            productId: item.productId,
            productName: item.productName,
            productPrimaryCode: item.productPrimaryCode,
            quantityOrdered: item.quantityOrdered,
            quantityPacked: item.quantityPacked,
            quantityDispatched: item.quantityDispatched,
            unitPrice: item.unitPrice,
            discountType: item.discountType as DiscountType,
            discountValue: item.discountValue,
            discountAmount: line.discountAmount,
            lineTotal: line.lineTotal,
            gross: line.gross,
          };
        });

    const totals = calculateOrderTotals({
      items: preparedItems,
      shippingCost: input.shippingCost ?? existing.shippingCost,
      shippingDiscount: input.shippingDiscount ?? existing.shippingDiscount,
      amountPaid: existing.amountPaid,
    });

    if (input.items) {
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
    }

    return tx.order.update({
      where: { id: existing.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.notes !== undefined
          ? { notes: input.notes?.trim() || null }
          : {}),
        consignmentDueDate: dueDate,
        approvalStatus: 'CONFIRMED',
        confirmedById: actor.id,
        confirmedAt: new Date(),
        subtotal: totals.subtotal,
        itemsDiscountTotal: totals.itemsDiscountTotal,
        shippingCost: totals.shippingCost,
        shippingDiscount: totals.shippingDiscount,
        totalAmount: totals.totalAmount,
        amountPending: totals.amountPending,
        ...(input.items
          ? {
              items: {
                create: preparedItems.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  productPrimaryCode: item.productPrimaryCode,
                  quantityOrdered: item.quantityOrdered,
                  quantityPacked: 0,
                  quantityDispatched: 0,
                  unitPrice: item.unitPrice,
                  discountType: item.discountType,
                  discountValue: item.discountValue,
                  discountAmount: item.discountAmount,
                  lineTotal: item.lineTotal,
                })),
              },
            }
          : {}),
      },
      include: orderDetailInclude,
    });
  });

  try {
    await sendOrderConfirmedCustomerEmail({
      to: confirmed.customer.email,
      customerName: confirmed.customer.companyName,
      orderNumber: confirmed.orderNumber,
      totalFormatted: formatCurrency(
        confirmed.totalAmount,
        confirmed.currency as Currency,
      ),
      orderUrl: `${env.frontendUrl}/pedidos/${confirmed.id}`,
    });
  } catch {
    // No bloquear confirmación si falla el correo
  }

  return {
    order: serializeOrder(confirmed, actor),
    message: 'Pedido confirmado correctamente.',
  };
}

export async function updateOrder(
  orderId: string,
  input: UpdateOrderInput,
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden(
      'Los clientes no pueden editar pedidos después de crearlos. Comunícate con Arte Modelo Dubois.',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!existing) {
      throw notFound('Pedido no encontrado.');
    }
    if (existing.approvalStatus === 'CANCELLED') {
      throw badRequest('No se puede editar un pedido cancelado.');
    }

    const currency = existing.currency as Currency;
    const dueDate =
      input.consignmentDueDate !== undefined
        ? parseDueDate(input.consignmentDueDate)
        : existing.consignmentDueDate;

    let computedItems: Array<{
      productId: string;
      productName: string;
      productPrimaryCode: string;
      quantityOrdered: number;
      quantityPacked: number;
      quantityDispatched: number;
      unitPrice: number;
      discountType: DiscountType;
      discountValue: number;
      discountAmount: number;
      lineTotal: number;
      gross: number;
    }>;

    if (input.items) {
      const nextProductIds = new Set(input.items.map((i) => i.productId));
      for (const oldItem of existing.items) {
        if (
          (oldItem.quantityPacked > 0 || oldItem.quantityDispatched > 0) &&
          !nextProductIds.has(oldItem.productId)
        ) {
          throw badRequest(
            `No puedes eliminar "${oldItem.productName}" porque ya tiene unidades empacadas o despachadas.`,
          );
        }
      }

      const existingByProduct = new Map(
        existing.items.map((i) => [
          i.productId,
          {
            quantityPacked: i.quantityPacked,
            quantityDispatched: i.quantityDispatched,
          },
        ]),
      );

      computedItems = await resolveOrderItemsForPersistence({
        tx,
        customerId: existing.customerId,
        currency,
        rawItems: input.items,
        allowCustomPrice: true,
        existingItemsByProductId: existingByProduct,
      });

      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
    } else {
      computedItems = existing.items.map((item) => {
        const line = calculateOrderLine({
          quantityOrdered: item.quantityOrdered,
          unitPrice: item.unitPrice,
          discountType: item.discountType as DiscountType,
          discountValue: item.discountValue,
        });
        return {
          productId: item.productId,
          productName: item.productName,
          productPrimaryCode: item.productPrimaryCode,
          quantityOrdered: item.quantityOrdered,
          quantityPacked: item.quantityPacked,
          quantityDispatched: item.quantityDispatched,
          unitPrice: item.unitPrice,
          discountType: item.discountType as DiscountType,
          discountValue: item.discountValue,
          discountAmount: line.discountAmount,
          lineTotal: line.lineTotal,
          gross: line.gross,
        };
      });
    }

    const totals = calculateOrderTotals({
      items: computedItems,
      shippingCost: input.shippingCost ?? existing.shippingCost,
      shippingDiscount: input.shippingDiscount ?? existing.shippingDiscount,
      returnedTotal: existing.returnedTotal,
      amountPaid: existing.amountPaid,
    });

    const fulfillmentStatus = deriveFulfillmentStatus(computedItems);
    const paymentStatus = derivePaymentStatus({
      totalAmount: totals.totalAmount,
      amountPaid: existing.amountPaid,
    });

    return tx.order.update({
      where: { id: existing.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.notes !== undefined
          ? { notes: input.notes?.trim() || null }
          : {}),
        consignmentDueDate: dueDate,
        fulfillmentStatus,
        paymentStatus,
        subtotal: totals.subtotal,
        itemsDiscountTotal: totals.itemsDiscountTotal,
        shippingCost: totals.shippingCost,
        shippingDiscount: totals.shippingDiscount,
        totalAmount: totals.totalAmount,
        amountPending: totals.amountPending,
        ...(input.items
          ? {
              items: {
                create: computedItems.map((item) => ({
                  productId: item.productId,
                  productName: item.productName,
                  productPrimaryCode: item.productPrimaryCode,
                  quantityOrdered: item.quantityOrdered,
                  quantityPacked: item.quantityPacked,
                  quantityDispatched: item.quantityDispatched,
                  unitPrice: item.unitPrice,
                  discountType: item.discountType,
                  discountValue: item.discountValue,
                  discountAmount: item.discountAmount,
                  lineTotal: item.lineTotal,
                })),
              },
            }
          : {}),
      },
      include: orderDetailInclude,
    });
  });

  return {
    order: serializeOrder(updated, actor),
    message: 'Pedido actualizado correctamente.',
  };
}

export async function packOrder(
  orderId: string,
  input: PackOrderInput,
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden('Solo el personal autorizado puede empacar pedidos.');
  }

  const packed = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw notFound('Pedido no encontrado.');
    }
    if (order.approvalStatus !== 'CONFIRMED') {
      throw badRequest(
        'El pedido debe estar confirmado antes de empacar mercadería.',
      );
    }

    const itemMap = new Map(order.items.map((i) => [i.id, i]));
    const updatedCounters = new Map(
      order.items.map((i) => [
        i.id,
        {
          quantityOrdered: i.quantityOrdered,
          quantityPacked: i.quantityPacked,
          quantityDispatched: i.quantityDispatched,
        },
      ]),
    );

    const seenItems = new Set<string>();
    for (const entry of input.items) {
      if (seenItems.has(entry.orderItemId)) {
        throw badRequest('No envíes el mismo ítem duplicado en el empaque.');
      }
      seenItems.add(entry.orderItemId);

      const orderItem = itemMap.get(entry.orderItemId);
      if (!orderItem) {
        throw badRequest('Uno de los ítems indicados no pertenece al pedido.');
      }
      if (entry.quantityPacked < orderItem.quantityDispatched) {
        throw badRequest(
          `No puedes reducir el empaque de "${orderItem.productName}" por debajo de ${orderItem.quantityDispatched} unidades ya despachadas.`,
        );
      }
      if (entry.quantityPacked > orderItem.quantityOrdered) {
        throw badRequest(
          `La cantidad empacada de "${orderItem.productName}" (${entry.quantityPacked}) supera las ${orderItem.quantityOrdered} unidades pedidas.`,
        );
      }

      const delta = entry.quantityPacked - orderItem.quantityPacked;
      if (delta !== 0) {
        const product = await tx.product.findUnique({
          where: { id: orderItem.productId },
        });
        if (!product) {
          throw notFound('Producto asociado al pedido no encontrado.');
        }

        if (delta > 0 && product.stock < delta) {
          throw badRequest(
            `Stock insuficiente para "${orderItem.productName}". Disponible: ${product.stock}, requerido adicional: ${delta}.`,
          );
        }

        const previousStock = product.stock;
        const newStock = previousStock - delta;

        await tx.product.update({
          where: { id: product.id },
          data: { stock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: delta > 0 ? 'ORDER_PACK' : 'ORDER_REVERT',
            quantityDelta: -delta,
            previousStock,
            newStock,
            reason:
              delta > 0
                ? `Empaque pedido ${order.orderNumber}${input.notes ? ` (${input.notes.trim()})` : ''}`
                : `Ajuste de empaque pedido ${order.orderNumber}${input.notes ? ` (${input.notes.trim()})` : ''}`,
            reference: order.orderNumber,
            performedById: actor.id,
          },
        });

        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: { quantityPacked: entry.quantityPacked },
        });

        updatedCounters.set(orderItem.id, {
          quantityOrdered: orderItem.quantityOrdered,
          quantityPacked: entry.quantityPacked,
          quantityDispatched: orderItem.quantityDispatched,
        });
      }
    }

    const fulfillmentStatus = deriveFulfillmentStatus(
      Array.from(updatedCounters.values()),
    );

    return tx.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus },
      include: orderDetailInclude,
    });
  });

  return {
    order: serializeOrder(packed, actor),
    message: 'Empaque registrado y stock actualizado por delta correctamente.',
  };
}

export async function createDispatch(
  orderId: string,
  input: CreateDispatchInput,
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden('Solo el personal autorizado puede registrar despachos.');
  }

  const dispatchedOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        dispatches: {
          orderBy: { dispatchNumber: 'desc' },
          take: 1,
          select: { dispatchNumber: true },
        },
      },
    });
    if (!order) {
      throw notFound('Pedido no encontrado.');
    }
    if (order.approvalStatus !== 'CONFIRMED') {
      throw badRequest(
        'Solo se pueden despachar pedidos que estén confirmados.',
      );
    }

    const itemMap = new Map(order.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const dispatchLines: Array<{
      orderItemId: string;
      quantityDispatched: number;
      cumulativeDispatched: number;
      remainingPending: number;
    }> = [];

    const countersMap = new Map(
      order.items.map((i) => [
        i.id,
        {
          quantityOrdered: i.quantityOrdered,
          quantityPacked: i.quantityPacked,
          quantityDispatched: i.quantityDispatched,
        },
      ]),
    );

    for (const entry of input.items) {
      if (seen.has(entry.orderItemId)) {
        throw badRequest('No envíes el mismo ítem duplicado en el despacho.');
      }
      seen.add(entry.orderItemId);

      const orderItem = itemMap.get(entry.orderItemId);
      if (!orderItem) {
        throw badRequest('Uno de los ítems indicados no pertenece al pedido.');
      }

      const availableToDispatch =
        orderItem.quantityPacked - orderItem.quantityDispatched;
      if (entry.quantityToDispatch > availableToDispatch) {
        throw badRequest(
          `Solo hay ${availableToDispatch} unidades empacadas listas para despachar de "${orderItem.productName}".`,
        );
      }

      const cumulativeDispatched =
        orderItem.quantityDispatched + entry.quantityToDispatch;
      const remainingPending =
        orderItem.quantityOrdered - cumulativeDispatched;

      dispatchLines.push({
        orderItemId: orderItem.id,
        quantityDispatched: entry.quantityToDispatch,
        cumulativeDispatched,
        remainingPending,
      });

      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: { quantityDispatched: cumulativeDispatched },
      });

      countersMap.set(orderItem.id, {
        quantityOrdered: orderItem.quantityOrdered,
        quantityPacked: orderItem.quantityPacked,
        quantityDispatched: cumulativeDispatched,
      });
    }

    const nextDispatchNumber = (order.dispatches[0]?.dispatchNumber ?? 0) + 1;

    await tx.dispatchEvent.create({
      data: {
        orderId: order.id,
        dispatchNumber: nextDispatchNumber,
        carrier: input.carrier?.trim() || null,
        notes: input.notes?.trim() || null,
        dispatchedById: actor.id,
        items: {
          create: dispatchLines,
        },
      },
    });

    const fulfillmentStatus = deriveFulfillmentStatus(
      Array.from(countersMap.values()),
    );

    return tx.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus },
      include: orderDetailInclude,
    });
  });

  try {
    const latestDispatch =
      dispatchedOrder.dispatches[dispatchedOrder.dispatches.length - 1];
    await sendOrderDispatchedCustomerEmail({
      to: dispatchedOrder.customer.email,
      customerName: dispatchedOrder.customer.companyName,
      orderNumber: dispatchedOrder.orderNumber,
      dispatchNumber: latestDispatch?.dispatchNumber ?? 1,
      carrier: latestDispatch?.carrier ?? null,
      isCompleted: dispatchedOrder.fulfillmentStatus === 'COMPLETED',
      orderUrl: `${env.frontendUrl}/pedidos/${dispatchedOrder.id}`,
    });
  } catch {
    // No bloquear despacho si falla el correo
  }

  return {
    order: serializeOrder(dispatchedOrder, actor),
    message:
      dispatchedOrder.fulfillmentStatus === 'COMPLETED'
        ? 'Despacho final registrado. El pedido quedó entregado en su totalidad.'
        : 'Despacho parcial registrado correctamente.',
  };
}

export async function cancelOrder(
  orderId: string,
  input: CancelOrderInput,
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden('Solo el personal autorizado puede cancelar pedidos.');
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw notFound('Pedido no encontrado.');
    }
    if (order.approvalStatus === 'CANCELLED') {
      throw badRequest('Este pedido ya fue cancelado anteriormente.');
    }

    const hasDispatched = order.items.some((i) => i.quantityDispatched > 0);
    if (hasDispatched) {
      throw badRequest(
        'No es posible cancelar un pedido que ya tiene unidades despachadas.',
      );
    }

    for (const item of order.items) {
      if (item.quantityPacked > 0) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (product) {
          const previousStock = product.stock;
          const newStock = previousStock + item.quantityPacked;

          await tx.product.update({
            where: { id: product.id },
            data: { stock: newStock },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: 'ORDER_REVERT',
              quantityDelta: item.quantityPacked,
              previousStock,
              newStock,
              reason: `Cancelación lógica pedido ${order.orderNumber}`,
              reference: order.orderNumber,
              performedById: actor.id,
            },
          });
        }

        await tx.orderItem.update({
          where: { id: item.id },
          data: { quantityPacked: 0 },
        });
      }
    }

    return tx.order.update({
      where: { id: order.id },
      data: {
        approvalStatus: 'CANCELLED',
        fulfillmentStatus: 'PENDING_PACKING',
        cancelledAt: new Date(),
        cancelledById: actor.id,
        cancelReason: input.cancelReason.trim(),
      },
      include: orderDetailInclude,
    });
  });

  return {
    order: serializeOrder(cancelled, actor),
    message: 'Pedido cancelado lógicamente e inventario revertido.',
  };
}

export async function listOrderPayments(
  orderId: string,
  query: { page?: unknown; pageSize?: unknown },
  actor: AuthenticatedUser,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, approvalStatus: true },
  });
  if (!order) {
    throw notFound('Pedido no encontrado.');
  }
  if (actor.role === 'CUSTOMER') {
    if (!actor.customerId || order.customerId !== actor.customerId) {
      throw forbidden('No tienes permiso para ver los pagos de este pedido.');
    }
  }

  const hidePrices =
    actor.role === 'CUSTOMER' &&
    (order.approvalStatus as ApprovalStatus) === 'PENDING_CONFIRMATION';

  const { page, pageSize } = parsePaginationQuery(query, 0);
  const total = await prisma.payment.count({ where: { orderId } });
  const pagination = buildPaginationMeta(total, page, pageSize);

  const payments = await prisma.payment.findMany({
    where: { orderId },
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
    include: {
      registeredBy: { select: { id: true, fullName: true } },
      voidedBy: { select: { id: true, fullName: true } },
    },
    ...prismaPaginationArgs(pagination),
  });

  return {
    payments: payments.map((p) => ({
      ...p,
      amount: hidePrices ? null : p.amount,
    })),
    pagination,
  };
}

export async function registerPayment(
  orderId: string,
  input: CreatePaymentInput,
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden('Solo el personal autorizado puede registrar abonos.');
  }

  const parsedDate = new Date(input.paymentDate);
  if (Number.isNaN(parsedDate.getTime())) {
    throw badRequest('La fecha real del pago no es válida.');
  }
  const paymentAmount = roundMoney(input.amount);
  if (paymentAmount <= 0) {
    throw badRequest('El monto del abono debe ser mayor a cero.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        payments: { where: { status: 'ACTIVE' }, select: { amount: true } },
      },
    });
    if (!order) {
      throw notFound('Pedido no encontrado.');
    }
    if (order.approvalStatus !== 'CONFIRMED') {
      throw badRequest(
        'Solo puedes registrar abonos en pedidos confirmados y activos.',
      );
    }

    const activePaid = roundMoney(
      order.payments.reduce((acc, p) => acc + p.amount, 0),
    );
    const currentPending = roundMoney(
      Math.max(0, order.totalAmount - activePaid),
    );
    if (currentPending <= 0) {
      throw badRequest('Este pedido ya se encuentra totalmente pagado.');
    }
    if (paymentAmount > roundMoney(currentPending + 0.001)) {
      throw badRequest(
        `El abono (${paymentAmount.toFixed(2)}) supera el saldo pendiente (${currentPending.toFixed(2)}).`,
      );
    }

    const cappedAmount = Math.min(paymentAmount, currentPending);

    await tx.payment.create({
      data: {
        orderId: order.id,
        amount: roundMoney(cappedAmount),
        method: input.method,
        paymentDate: parsedDate,
        reference: input.reference?.trim() || null,
        receiptImageUrl: input.receiptImageUrl?.trim() || null,
        notes: input.notes?.trim() || null,
        status: 'ACTIVE',
        registeredById: actor.id,
      },
    });

    const newAmountPaid = roundMoney(activePaid + cappedAmount);
    const newAmountPending = roundMoney(
      Math.max(0, order.totalAmount - newAmountPaid),
    );
    const newPaymentStatus = derivePaymentStatus({
      totalAmount: order.totalAmount,
      amountPaid: newAmountPaid,
    });

    return tx.order.update({
      where: { id: order.id },
      data: {
        amountPaid: newAmountPaid,
        amountPending: newAmountPending,
        paymentStatus: newPaymentStatus,
      },
      include: orderDetailInclude,
    });
  });

  try {
    const curr = updated.currency as Currency;
    await sendPaymentRegisteredCustomerEmail({
      to: updated.customer.email,
      customerName: updated.customer.companyName,
      orderNumber: updated.orderNumber,
      amountFormatted: formatCurrency(paymentAmount, curr),
      methodLabel: PAYMENT_METHOD_LABELS[input.method as PaymentMethod],
      pendingFormatted: formatCurrency(updated.amountPending, curr),
      orderUrl: `${env.frontendUrl}/pedidos/${updated.id}`,
    });
  } catch {
    // No bloquear registro del abono si falla el correo
  }

  return {
    order: serializeOrder(updated, actor),
    message:
      updated.paymentStatus === 'PAID'
        ? 'Abono registrado. El pedido quedó pagado en su totalidad.'
        : 'Abono registrado correctamente.',
  };
}

export async function voidPayment(
  orderId: string,
  paymentId: string,
  input: VoidPaymentInput,
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden('Solo el personal autorizado puede anular pagos.');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, totalAmount: true, approvalStatus: true },
    });
    if (!order) {
      throw notFound('Pedido no encontrado.');
    }

    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.orderId !== order.id) {
      throw notFound('Pago no encontrado para este pedido.');
    }
    if (payment.status === 'VOIDED') {
      throw badRequest('Este pago ya fue anulado anteriormente.');
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'VOIDED',
        voidReason: input.voidReason.trim(),
        voidedAt: new Date(),
        voidedById: actor.id,
      },
    });

    const activePayments = await tx.payment.findMany({
      where: { orderId: order.id, status: 'ACTIVE' },
      select: { amount: true },
    });

    const newAmountPaid = roundMoney(
      activePayments.reduce((acc, p) => acc + p.amount, 0),
    );
    const newAmountPending = roundMoney(
      Math.max(0, order.totalAmount - newAmountPaid),
    );
    const newPaymentStatus = derivePaymentStatus({
      totalAmount: order.totalAmount,
      amountPaid: newAmountPaid,
    });

    return tx.order.update({
      where: { id: order.id },
      data: {
        amountPaid: newAmountPaid,
        amountPending: newAmountPending,
        paymentStatus: newPaymentStatus,
      },
      include: orderDetailInclude,
    });
  });

  return {
    order: serializeOrder(updated, actor),
    message: 'Abono anulado correctamente y saldo del pedido recalculado.',
  };
}

export async function createConsignmentReturn(
  orderId: string,
  input: CreateConsignmentReturnInput,
  actor: AuthenticatedUser,
) {
  if (actor.role === 'CUSTOMER') {
    throw forbidden(
      'Solo el personal autorizado puede registrar devoluciones de consignación.',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        consignmentReturns: {
          orderBy: [{ returnNumber: 'desc' }],
          take: 1,
          select: { returnNumber: true },
        },
      },
    });
    if (!order) {
      throw notFound('Pedido no encontrado.');
    }
    if (order.type !== 'CONSIGNMENT') {
      throw badRequest(
        'Las devoluciones de consignación solo aplican a pedidos de tipo Consignación.',
      );
    }
    if (order.approvalStatus !== 'CONFIRMED') {
      throw badRequest(
        'El pedido en consignación debe estar confirmado para registrar devoluciones.',
      );
    }

    const itemMap = new Map(order.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const returnItemsData: Array<{
      orderItemId: string;
      quantityReturned: number;
      unitCredit: number;
      lineCredit: number;
    }> = [];

    let totalCredit = 0;

    for (const entry of input.items) {
      if (seen.has(entry.orderItemId)) {
        throw badRequest('No envíes el mismo ítem duplicado en la devolución.');
      }
      seen.add(entry.orderItemId);

      const orderItem = itemMap.get(entry.orderItemId);
      if (!orderItem) {
        throw badRequest('Uno de los ítems indicados no pertenece al pedido.');
      }

      const maxReturnable = Math.max(
        0,
        orderItem.quantityDispatched - orderItem.quantityReturned,
      );
      if (entry.quantityReturned > maxReturnable) {
        throw badRequest(
          `Solo hay ${maxReturnable} unidades entregadas disponibles para devolver de "${orderItem.productName}".`,
        );
      }

      const unitCredit =
        orderItem.quantityOrdered > 0
          ? roundMoney(orderItem.lineTotal / orderItem.quantityOrdered)
          : roundMoney(orderItem.unitPrice);

      const rawCredit =
        orderItem.quantityReturned === 0 &&
        entry.quantityReturned === orderItem.quantityOrdered
          ? roundMoney(orderItem.lineTotal)
          : roundMoney(entry.quantityReturned * unitCredit);

      totalCredit = roundMoney(totalCredit + rawCredit);
      returnItemsData.push({
        orderItemId: orderItem.id,
        quantityReturned: entry.quantityReturned,
        unitCredit,
        lineCredit: rawCredit,
      });

      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: {
          quantityReturned: orderItem.quantityReturned + entry.quantityReturned,
        },
      });

      const product = await tx.product.findUnique({
        where: { id: orderItem.productId },
        select: { id: true, stock: true },
      });
      if (product) {
        const previousStock = product.stock;
        const newStock = previousStock + entry.quantityReturned;

        await tx.product.update({
          where: { id: product.id },
          data: { stock: newStock },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            type: 'CONSIGNMENT_RETURN',
            quantityDelta: entry.quantityReturned,
            previousStock,
            newStock,
            reason: `Devolución de consignación ${order.orderNumber}`,
            reference: order.orderNumber,
            performedById: actor.id,
          },
        });
      }
    }

    const nextReturnNumber = (order.consignmentReturns[0]?.returnNumber ?? 0) + 1;
    const maxAllowedTotalCredit = roundMoney(
      Math.max(
        0,
        order.subtotal -
          order.itemsDiscountTotal +
          order.shippingCost -
          order.shippingDiscount -
          order.returnedTotal,
      ),
    );
    const boundedCredit = Math.min(totalCredit, maxAllowedTotalCredit);
    const newReturnedTotal = roundMoney(order.returnedTotal + boundedCredit);
    const newTotalAmount = roundMoney(
      Math.max(
        0,
        order.subtotal -
          order.itemsDiscountTotal +
          order.shippingCost -
          order.shippingDiscount -
          newReturnedTotal,
      ),
    );
    const newAmountPending = roundMoney(
      Math.max(0, newTotalAmount - order.amountPaid),
    );
    const newPaymentStatus = derivePaymentStatus({
      totalAmount: newTotalAmount,
      amountPaid: order.amountPaid,
    });

    await tx.consignmentReturn.create({
      data: {
        orderId: order.id,
        returnNumber: nextReturnNumber,
        notes: input.notes?.trim() || null,
        totalCredit: boundedCredit,
        receivedById: actor.id,
        items: { create: returnItemsData },
      },
    });

    return tx.order.update({
      where: { id: order.id },
      data: {
        returnedTotal: newReturnedTotal,
        totalAmount: newTotalAmount,
        amountPending: newAmountPending,
        paymentStatus: newPaymentStatus,
      },
      include: orderDetailInclude,
    });
  });

  return {
    order: serializeOrder(updated, actor),
    message:
      'Devolución de consignación registrada. Inventario y saldo pendiente actualizados.',
  };
}

export async function listConsignmentsOverview(
  query: {
    search?: string;
    country?: string;
    status?: string;
    page?: unknown;
    pageSize?: unknown;
  },
  actor: AuthenticatedUser,
) {
  const { page, pageSize } = parsePaginationQuery(query);
  const where: Record<string, unknown> = {
    type: 'CONSIGNMENT',
    approvalStatus: 'CONFIRMED',
  };

  if (actor.role === 'CUSTOMER') {
    if (!actor.customerId) {
      return {
        orders: [],
        byCustomer: [],
        pagination: buildPaginationMeta(0, page, pageSize),
      };
    }
    where.customerId = actor.customerId;
  }

  if (query.country && query.country !== 'ALL') {
    where.customer = { country: query.country };
  }

  const term = query.search?.trim();
  if (term) {
    where.OR = [
      { orderNumber: containsFilter(term) },
      { customer: { companyName: containsFilter(term) } },
      { customer: { taxId: containsFilter(term) } },
      { items: { some: { productName: containsFilter(term) } } },
    ];
  }

  const allMatching = await prisma.order.findMany({
    where,
    include: orderDetailInclude,
    orderBy: [{ consignmentDueDate: 'asc' }, { createdAt: 'desc' }],
  });

  const nowMs = Date.now();
  const statusFiltered = allMatching.filter((o) => {
    if (query.status === 'OVERDUE') {
      return (
        Boolean(o.consignmentDueDate) &&
        o.consignmentDueDate!.getTime() < nowMs &&
        o.amountPending > 0
      );
    }
    if (query.status === 'UPCOMING') {
      if (!o.consignmentDueDate || o.amountPending <= 0) return false;
      const diffDays =
        (o.consignmentDueDate.getTime() - nowMs) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 30;
    }
    return true;
  });

  const customerSummaryMap = new Map<
    string,
    {
      customerId: string;
      companyName: string;
      country: CountryCode;
      countryLabel: string;
      currency: Currency;
      ordersCount: number;
      unitsOrdered: number;
      unitsDispatched: number;
      unitsReturned: number;
      unitsNetInStore: number;
      grossTotal: number;
      returnedCredit: number;
      netTotal: number;
      amountPaid: number;
      amountPending: number;
      nearestDueDate: Date | null;
    }
  >();

  for (const order of statusFiltered) {
    const country = (
      (COUNTRIES as readonly string[]).includes(order.customer.country)
        ? order.customer.country
        : 'OTHER'
    ) as CountryCode;

    const existing = customerSummaryMap.get(order.customerId) ?? {
      customerId: order.customerId,
      companyName: order.customer.companyName,
      country,
      countryLabel: COUNTRY_LABELS[country],
      currency: order.currency as Currency,
      ordersCount: 0,
      unitsOrdered: 0,
      unitsDispatched: 0,
      unitsReturned: 0,
      unitsNetInStore: 0,
      grossTotal: 0,
      returnedCredit: 0,
      netTotal: 0,
      amountPaid: 0,
      amountPending: 0,
      nearestDueDate: null,
    };

    existing.ordersCount += 1;
    for (const item of order.items) {
      existing.unitsOrdered += item.quantityOrdered;
      existing.unitsDispatched += item.quantityDispatched;
      existing.unitsReturned += item.quantityReturned;
      existing.unitsNetInStore += Math.max(
        0,
        item.quantityDispatched - item.quantityReturned,
      );
    }

    existing.grossTotal = roundMoney(existing.grossTotal + order.subtotal);
    existing.returnedCredit = roundMoney(
      existing.returnedCredit + order.returnedTotal,
    );
    existing.netTotal = roundMoney(existing.netTotal + order.totalAmount);
    existing.amountPaid = roundMoney(existing.amountPaid + order.amountPaid);
    existing.amountPending = roundMoney(
      existing.amountPending + order.amountPending,
    );

    if (order.consignmentDueDate && order.amountPending > 0) {
      if (
        !existing.nearestDueDate ||
        order.consignmentDueDate.getTime() < existing.nearestDueDate.getTime()
      ) {
        existing.nearestDueDate = order.consignmentDueDate;
      }
    }

    customerSummaryMap.set(order.customerId, existing);
  }

  const total = statusFiltered.length;
  const pagination = buildPaginationMeta(total, page, pageSize);
  const sliced =
    pagination.pageSize === 0
      ? statusFiltered
      : statusFiltered.slice(
          (pagination.page - 1) * pagination.pageSize,
          pagination.page * pagination.pageSize,
        );

  return {
    orders: sliced.map((order) => serializeOrder(order, actor)),
    byCustomer: Array.from(customerSummaryMap.values()).sort((a, b) =>
      a.companyName.localeCompare(b.companyName),
    ),
    pagination,
  };
}
