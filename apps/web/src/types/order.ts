import type {
  ApprovalStatus,
  CountryCode,
  Currency,
  DiscountType,
  FulfillmentStatus,
  OrderType,
  PaginationMeta,
  PaymentStatus,
} from '@arte-modelo/shared';

export interface OrderCustomerSummary {
  id: string;
  companyName: string;
  managerName: string;
  phone: string;
  email: string;
  country: CountryCode;
  countryLabel: string;
  currency: Currency;
  address: string;
  taxId: string;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productPrimaryCode: string;
  quantityOrdered: number;
  quantityPacked: number;
  quantityDispatched: number;
  quantityPendingDispatch: number;
  currentStock: number | null;
  productImageUrl?: string | null;
  unitPrice: number | null;
  discountType: DiscountType;
  discountValue: number | null;
  discountAmount: number | null;
  lineTotal: number | null;
}

export interface OrderDispatchItemDto {
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
}

export interface OrderDispatchDto {
  id: string;
  dispatchNumber: number;
  dispatchedAt: string;
  carrier: string | null;
  notes: string | null;
  dispatchedBy: { id: string; fullName: string } | null;
  items: OrderDispatchItemDto[];
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  customerId: string;
  customer: OrderCustomerSummary;
  type: OrderType;
  approvalStatus: ApprovalStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  currency: Currency;
  pricesVisible: boolean;
  subtotal: number | null;
  itemsDiscountTotal: number | null;
  shippingCost: number | null;
  shippingDiscount: number | null;
  totalAmount: number | null;
  amountPaid: number | null;
  amountPending: number | null;
  consignmentDueDate: string | null;
  notes: string | null;
  createdBy: { id: string; fullName: string } | null;
  confirmedBy: { id: string; fullName: string } | null;
  confirmedAt: string | null;
  cancelledBy: { id: string; fullName: string } | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  itemsCount: number;
  dispatchesCount: number;
  items: OrderItemDto[];
  dispatches?: OrderDispatchDto[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderListResponse {
  orders: OrderDto[];
  pagination: PaginationMeta;
}

export interface LastPriceResponse {
  customerId: string;
  productId: string;
  currency: Currency;
  catalogPrice: number | null;
  lastPrice: number | null;
  lastOrderNumber: string | null;
  lastOrderDate: string | null;
  hasHistory: boolean;
}
