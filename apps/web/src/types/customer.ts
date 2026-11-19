import type {
  ApprovalStatus,
  CountryCode,
  Currency,
  FulfillmentStatus,
  OrderType,
  PaymentStatus,
} from '@arte-modelo/shared';

export interface LinkedUserDto {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive?: boolean;
  isVerified: boolean;
}

export interface CustomerOrderSummaryDto {
  id: string;
  orderNumber: string;
  type: OrderType;
  approvalStatus: ApprovalStatus;
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  currency: Currency;
  totalAmount: number;
  amountPending: number;
  consignmentDueDate: string | null;
  createdAt: string;
}

export interface CustomerDto {
  id: string;
  companyName: string;
  managerName: string;
  phone: string;
  email: string;
  country: CountryCode;
  countryLabel: string;
  currency: Currency;
  taxLabel: string;
  address: string;
  taxId: string;
  notes: string | null;
  isActive: boolean;
  deletedAt: string | null;
  linkedUsersCount: number;
  users?: LinkedUserDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetailResponse {
  customer: CustomerDto;
  orders: CustomerOrderSummaryDto[];
}
