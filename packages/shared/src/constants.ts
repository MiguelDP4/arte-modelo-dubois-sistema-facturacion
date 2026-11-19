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

export const APPROVAL_STATUSES = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'CANCELLED',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  'PENDING_PACKING',
  'PACKING',
  'READY_TO_DISPATCH',
  'PARTIALLY_DISPATCHED',
  'COMPLETED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'CHECK'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
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
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize || DEFAULT_PAGE_SIZE)));
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
  return `${CURRENCY_SYMBOLS[currency]} ${formatted}`;
}
