import {
  buildPaginationMeta,
  calculateOrderLine,
  calculateOrderTotals,
  COUNTRIES,
  COUNTRY_LABELS,
  deriveFulfillmentStatus,
  roundMoney,
  type ApprovalStatus,
  type CancelOrderInput,
  type ConfirmOrderInput,
  type CountryCode,
  type CreateDispatchInput,
  type CreateOrderInput,
  type Currency,
  type DiscountType,
  type OrderItemInput,
  type PackOrderInput,
  type UpdateOrderInput,
} from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import { badRequest, forbidden, notFound } from '../lib/errors';
import {
  containsFilter,
  parsePaginationQuery,
  prismaPaginationArgs,
} from '../lib/pagination';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';

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
        select: { id: true, stock: true },
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
  createdBy: { select: { id: true, fullName: true } },
  confirmedBy: { select: { id: true, fullName: true } },
  cancelledBy: { select: { id: true, fullName: true } },
};

const orderListInclude = {
  customer: orderDetailInclude.customer,
  items: orderDetailInclude.items,
  _count: { select: { dispatches: true } },
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
      unitPrice: number;
      discountType: string;
      discountValue: number;
      discountAmount: number;
      lineTotal: number;
      product?: { id: string; stock: number } | null;
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
    _count?: { dispatches: number };
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
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      productPrimaryCode: item.productPrimaryCode,
      quantityOrdered: item.quantityOrdered,
      quantityPacked: item.quantityPacked,
      quantityDispatched: item.quantityDispatched,
      quantityPendingDispatch: Math.max(
        0,
        item.quantityOrdered - item.quantityDispatched,
      ),
      currentStock:
        actor.role !== 'CUSTOMER' ? (item.product?.stock ?? null) : null,
      unitPrice: hidePrices ? null : item.unitPrice,
      discountType: item.discountType as DiscountType,
      discountValue: hidePrices ? null : item.discountValue,
      discountAmount: hidePrices ? null : item.discountAmount,
      lineTotal: hidePrices ? null : item.lineTotal,
    })),
    ...(order.dispatches ? { dispatches: order.dispatches } : {}),
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
      amountPaid: existing.amountPaid,
    });

    const fulfillmentStatus = deriveFulfillmentStatus(computedItems);

    return tx.order.update({
      where: { id: existing.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.notes !== undefined
          ? { notes: input.notes?.trim() || null }
          : {}),
        consignmentDueDate: dueDate,
        fulfillmentStatus,
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
