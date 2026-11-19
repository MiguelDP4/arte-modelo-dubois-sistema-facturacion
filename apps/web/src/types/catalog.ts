import type { StockMovementType } from '@arte-modelo/shared';

export interface ProductCodeDto {
  id?: string;
  code: string;
  label: string;
  isPrimary: boolean;
}

export interface ProductImageDto {
  id?: string;
  url: string;
  altText?: string | null;
  sortOrder?: number;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  codes: ProductCodeDto[];
  images: ProductImageDto[];
  createdAt: string;
}

export interface StaffProduct extends CatalogProduct {
  isActive: boolean;
  deletedAt: string | null;
  updatedAt: string;
  priceGTQ?: number | null;
  priceHNL?: number | null;
  priceNIO?: number | null;
  priceUSD?: number | null;
  stock?: number;
  lowStockThreshold?: number;
  isLowStock?: boolean;
}

export interface StockMovementDto {
  id: string;
  productId: string;
  type: StockMovementType;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference: string | null;
  createdAt: string;
  performedBy: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}
