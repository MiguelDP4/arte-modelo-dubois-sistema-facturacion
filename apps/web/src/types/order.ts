import type {
  ApprovalStatus,
  CountryCode,
  Currency,
  DiscountType,
  FulfillmentStatus,
  OrderType,
  PaginationMeta,
  PaymentMethod,
  PaymentRecordStatus,
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
  quantityReturned: number;
  quantityPendingDispatch: number;
  quantityNetConsigned: number;
  quantityAvailableToReturn: number;
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

export interface OrderPaymentDto {
  id: string;
  orderId: string;
  amount: number | null;
  method: PaymentMethod;
  paymentDate: string;
  reference: string | null;
  receiptImageUrl: string | null;
  notes: string | null;
  status: PaymentRecordStatus;
  voidReason: string | null;
  voidedAt: string | null;
  registeredBy: { id: string; fullName: string } | null;
  voidedBy: { id: string; fullName: string } | null;
  createdAt: string;
}

export interface ConsignmentReturnItemDto {
  id: string;
  orderItemId: string;
  quantityReturned: number;
  unitCredit: number | null;
  lineCredit: number | null;
  orderItem: {
    id: string;
    productName: string;
    productPrimaryCode: string;
  };
}

export interface ConsignmentReturnDto {
  id: string;
  orderId: string;
  returnNumber: number;
  returnedAt: string;
  notes: string | null;
  totalCredit: number | null;
  receivedBy: { id: string; fullName: string } | null;
  items: ConsignmentReturnItemDto[];
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
  returnedTotal: number | null;
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
  paymentsCount?: number;
  consignmentReturnsCount?: number;
  items: OrderItemDto[];
  dispatches?: OrderDispatchDto[];
  payments?: OrderPaymentDto[];
  consignmentReturns?: ConsignmentReturnDto[];
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

export interface ConsignmentCustomerSummaryDto {
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
  nearestDueDate: string | null;
}

export interface ConsignmentsOverviewResponse {
  orders: OrderDto[];
  byCustomer: ConsignmentCustomerSummaryDto[];
  pagination: PaginationMeta;
}

export interface StaffDashboardResponse {
  role: 'ADMIN' | 'EMPLOYEE';
  staffCounts: {
    pendingConfirmationCount: number;
    pendingPackingCount: number;
    readyToDispatchCount: number;
    partiallyDispatchedCount: number;
  };
  receivableByCurrency: Array<{
    currency: Currency;
    ordersWithBalance: number;
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
  }>;
  upcomingConsignments: Array<{
    id: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    currency: Currency;
    amountPending: number;
    fulfillmentStatus: FulfillmentStatus;
    consignmentDueDate: string | null;
    daysRemaining: number | null;
    isOverdue: boolean;
  }>;
  lowStockProducts: Array<{
    id: string;
    name: string;
    primaryCode: string;
    stock: number;
    lowStockThreshold: number;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    type: OrderType;
    approvalStatus: ApprovalStatus;
    fulfillmentStatus: FulfillmentStatus;
    paymentStatus: PaymentStatus;
    currency: Currency;
    totalAmount: number;
    amountPending: number;
    createdAt: string;
  }>;
}

export interface CustomerDashboardResponse {
  role: 'CUSTOMER';
  linked: boolean;
  customerCounts: {
    pendingConfirmation: number;
    inProgress: number;
    delivered: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    type: OrderType;
    approvalStatus: ApprovalStatus;
    fulfillmentStatus: FulfillmentStatus;
    paymentStatus: PaymentStatus;
    currency: Currency;
    pricesVisible: boolean;
    totalAmount: number | null;
    amountPending: number | null;
    consignmentDueDate: string | null;
    createdAt: string;
  }>;
}

export type DashboardResponse = StaffDashboardResponse | CustomerDashboardResponse;
