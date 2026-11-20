export const ROLES = ['ADMIN', 'EMPLOYEE', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  EMPLOYEE: 'Empleado',
  CUSTOMER: 'Cliente',
};

export const CURRENCIES = ['GTQ', 'HNL', 'NIO', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GTQ: 'Q',
  HNL: 'L',
  NIO: 'C$',
  USD: '$',
};

export const COUNTRIES = ['GT', 'HN', 'NI', 'SV', 'OTHER'] as const;
export type CountryCode = (typeof COUNTRIES)[number];

export const COUNTRY_CURRENCY: Record<CountryCode, Currency> = {
  GT: 'GTQ',
  HN: 'HNL',
  NI: 'NIO',
  SV: 'USD',
  OTHER: 'USD',
};

export const COUNTRY_TAX_LABEL: Record<CountryCode, string> = {
  GT: 'NIT',
  HN: 'RTN',
  NI: 'RUC',
  SV: 'DTE / NIT',
  OTHER: 'ID Fiscal',
};

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  GT: 'Guatemala',
  HN: 'Honduras',
  NI: 'Nicaragua',
  SV: 'El Salvador',
  OTHER: 'Otro',
};

export const PRODUCT_CODE_LABELS = [
  'Interno',
  'Proveedor',
  'Cliente / Tienda',
  'Alternativo',
] as const;

export const STOCK_MOVEMENT_TYPES = [
  'INITIAL',
  'MANUAL_IN',
  'MANUAL_OUT',
  'MANUAL_ADJUST',
  'ORDER_PACK',
  'ORDER_REVERT',
  'CONSIGNMENT_RETURN',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  INITIAL: 'Inventario inicial',
  MANUAL_IN: 'Ingreso manual',
  MANUAL_OUT: 'Salida manual',
  MANUAL_ADJUST: 'Ajuste de inventario',
  ORDER_PACK: 'Empaque de pedido',
  ORDER_REVERT: 'Reversión de pedido',
  CONSIGNMENT_RETURN: 'Devolución consignación',
};

export const ORDER_TYPES = ['REGULAR', 'CONSIGNMENT'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  REGULAR: 'Regular',
  CONSIGNMENT: 'Consignación',
};

export const APPROVAL_STATUSES = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'CANCELLED',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING_CONFIRMATION: 'Por confirmar',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
};

export const FULFILLMENT_STATUSES = [
  'PENDING_PACKING',
  'PACKING',
  'READY_TO_DISPATCH',
  'PARTIALLY_DISPATCHED',
  'COMPLETED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  PENDING_PACKING: 'Por empacar',
  PACKING: 'Empacando',
  READY_TO_DISPATCH: 'Listo para despacho',
  PARTIALLY_DISPATCHED: 'Despacho parcial',
  COMPLETED: 'Entregado total',
};

export const PAYMENT_STATUSES = [
  'PENDING_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PARTIALLY_PAID: 'Abono parcial',
  PAID: 'Pagado',
};

export const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'CHECK'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
};

export const PAYMENT_RECORD_STATUSES = ['ACTIVE', 'VOIDED'] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export const PAYMENT_RECORD_STATUS_LABELS: Record<PaymentRecordStatus, string> = {
  ACTIVE: 'Activo',
  VOIDED: 'Anulado',
};

export const EXCEL_DOCUMENT_TYPES = [
  'invoice',
  'consignment',
  'delivery',
] as const;
export type ExcelDocumentType = (typeof EXCEL_DOCUMENT_TYPES)[number];

export const EXCEL_DOCUMENT_LABELS: Record<ExcelDocumentType, string> = {
  invoice: 'Factura / Resumen de Pedido',
  consignment: 'Recibo de Consignación',
  delivery: 'Nota de Entrega Parcial / Total',
};

export const DISCOUNT_TYPES = ['FIXED', 'PERCENT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  FIXED: 'Monto fijo',
  PERCENT: 'Porcentaje (%)',
};

export function roundMoney(val: number): number {
  return Math.round((Number.isFinite(val) ? val : 0) * 100) / 100;
}

export function calculateOrderLine(params: {
  quantityOrdered: number;
  unitPrice: number;
  discountType?: DiscountType;
  discountValue?: number;
}) {
  const qty = Math.max(0, params.quantityOrdered);
  const price = Math.max(0, params.unitPrice);
  const gross = roundMoney(qty * price);
  const rawDisc = Math.max(0, params.discountValue ?? 0);
  const discountType = params.discountType ?? 'FIXED';

  const discountAmount =
    discountType === 'PERCENT'
      ? roundMoney((gross * Math.min(100, rawDisc)) / 100)
      : roundMoney(Math.min(gross, rawDisc));

  const lineTotal = roundMoney(Math.max(0, gross - discountAmount));
  return { gross, discountAmount, lineTotal };
}

export function calculateOrderTotals(params: {
  items: Array<{ gross?: number; discountAmount?: number; lineTotal: number }>;
  shippingCost?: number;
  shippingDiscount?: number;
  returnedTotal?: number;
  amountPaid?: number;
}) {
  let subtotal = 0;
  let itemsDiscountTotal = 0;

  for (const item of params.items) {
    const disc = roundMoney(Math.max(0, item.discountAmount ?? 0));
    const gross =
      item.gross !== undefined
        ? roundMoney(item.gross)
        : roundMoney(item.lineTotal + disc);
    subtotal = roundMoney(subtotal + gross);
    itemsDiscountTotal = roundMoney(itemsDiscountTotal + disc);
  }

  const shippingCost = roundMoney(Math.max(0, params.shippingCost ?? 0));
  const shippingDiscount = roundMoney(
    Math.min(shippingCost, Math.max(0, params.shippingDiscount ?? 0)),
  );
  const returnedTotal = roundMoney(Math.max(0, params.returnedTotal ?? 0));
  const totalAmount = roundMoney(
    Math.max(
      0,
      subtotal - itemsDiscountTotal + shippingCost - shippingDiscount - returnedTotal,
    ),
  );
  const safePaid = roundMoney(Math.max(0, params.amountPaid ?? 0));
  const amountPending = roundMoney(Math.max(0, totalAmount - safePaid));

  return {
    subtotal,
    itemsDiscountTotal,
    shippingCost,
    shippingDiscount,
    returnedTotal,
    totalAmount,
    amountPending,
  };
}

export function derivePaymentStatus(params: {
  totalAmount: number;
  amountPaid: number;
}): PaymentStatus {
  const safeTotal = roundMoney(Math.max(0, params.totalAmount));
  const safePaid = roundMoney(Math.max(0, params.amountPaid));
  if (safePaid <= 0) {
    return safeTotal <= 0 ? 'PAID' : 'PENDING_PAYMENT';
  }
  if (safePaid >= safeTotal) {
    return 'PAID';
  }
  return 'PARTIALLY_PAID';
}

export function deriveFulfillmentStatus(
  items: Array<{
    quantityOrdered: number;
    quantityPacked: number;
    quantityDispatched: number;
  }>,
): FulfillmentStatus {
  if (items.length === 0) return 'PENDING_PACKING';

  const hasOrdered = items.some((i) => i.quantityOrdered > 0);
  if (hasOrdered && items.every((i) => i.quantityDispatched >= i.quantityOrdered)) {
    return 'COMPLETED';
  }
  if (items.some((i) => i.quantityDispatched > 0)) {
    return 'PARTIALLY_DISPATCHED';
  }
  if (hasOrdered && items.every((i) => i.quantityPacked >= i.quantityOrdered)) {
    return 'READY_TO_DISPATCH';
  }
  if (items.some((i) => i.quantityPacked > 0)) {
    return 'PACKING';
  }
  return 'PENDING_PACKING';
}

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 0] as const;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const SEARCH_DEBOUNCE_MS = 1000;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function buildPaginationMeta(
  total: number,
  page: number,
  pageSize: number,
): PaginationMeta {
  if (pageSize === 0) {
    return {
      page: 1,
      pageSize: 0,
      total,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    };
  }

  const safePageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(pageSize || DEFAULT_PAGE_SIZE)),
  );
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page || 1)), totalPages);
  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}

export function formatCurrency(amount: number, currency: Currency): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const formatted = safeAmount.toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOLS[currency]}\u00A0${formatted}`;
}
