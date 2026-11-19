import type { CountryCode, Currency } from '@arte-modelo/shared';

export interface LinkedUserDto {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive?: boolean;
  isVerified: boolean;
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
  orders: unknown[];
}
