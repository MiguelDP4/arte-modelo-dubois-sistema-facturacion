import type {
  CreateProductInput,
  CreateStockMovementInput,
  UpdateProductInput,
} from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import { badRequest, conflict, notFound } from '../lib/errors';

const productInclude = {
  codes: {
    orderBy: [{ isPrimary: 'desc' as const }, { code: 'asc' as const }],
  },
  images: {
    orderBy: { sortOrder: 'asc' as const },
  },
};

type ProductWithRelations = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.product.findFirst<{
        include: typeof productInclude;
      }>
    >
  >
>;

export function toPublicCatalogProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    codes: product.codes.map((c) => ({
      id: c.id,
      code: c.code,
      label: c.label,
      isPrimary: c.isPrimary,
    })),
    images: product.images.map((img) => ({
      id: img.id,
      url: img.url,
      altText: img.altText,
      sortOrder: img.sortOrder,
    })),
    createdAt: product.createdAt,
  };
}

export function toStaffProduct(
  product: ProductWithRelations,
  includePrices: boolean,
) {
  return {
    ...toPublicCatalogProduct(product),
    isActive: product.isActive,
    deletedAt: product.deletedAt,
    updatedAt: product.updatedAt,
    ...(includePrices
      ? {
          priceGTQ: product.priceGTQ,
          priceHNL: product.priceHNL,
          priceNIO: product.priceNIO,
          priceUSD: product.priceUSD,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold,
          isLowStock: product.stock <= product.lowStockThreshold,
        }
      : {}),
  };
}

function normalizeCodes(
  codes: Array<{ code: string; label?: string; isPrimary?: boolean }>,
) {
  const seen = new Set<string>();
  const normalized = codes.map((item) => {
    const cleanCode = item.code.trim().toUpperCase();
    if (!cleanCode) {
      throw badRequest('Los códigos de producto no pueden estar vacíos.');
    }
    if (seen.has(cleanCode)) {
      throw badRequest(`El código "${cleanCode}" está duplicado en el formulario.`);
    }
    seen.add(cleanCode);
    return {
      code: cleanCode,
      label: item.label?.trim() || 'Interno',
      isPrimary: Boolean(item.isPrimary),
    };
  });

  const firstPrimaryIdx = normalized.findIndex((c) => c.isPrimary);
  const chosenIdx = firstPrimaryIdx >= 0 ? firstPrimaryIdx : 0;

  return normalized.map((c, idx) => ({
    ...c,
    isPrimary: idx === chosenIdx,
  }));
}

function matchesProductSearch(
  product: ProductWithRelations,
  searchTerm: string,
): boolean {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return true;

  if (product.name.toLowerCase().includes(term)) return true;
  if (product.description?.toLowerCase().includes(term)) return true;
  if (product.category?.toLowerCase().includes(term)) return true;

  return product.codes.some((c) => c.code.toLowerCase().includes(term));
}

function extractCategories(products: ProductWithRelations[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    if (p.category?.trim()) {
      set.add(p.category.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
}

export async function listPublicCatalog(query: {
  search?: string;
  category?: string;
}) {
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    include: productInclude,
    orderBy: [{ name: 'asc' }],
  });

  const categories = extractCategories(activeProducts);

  const filtered = activeProducts.filter((product) => {
    if (
      query.category &&
      query.category !== 'ALL' &&
      product.category?.trim().toLowerCase() !== query.category.trim().toLowerCase()
    ) {
      return false;
    }
    if (query.search && !matchesProductSearch(product, query.search)) {
      return false;
    }
    return true;
  });

  return {
    products: filtered.map(toPublicCatalogProduct),
    categories,
  };
}

export async function getPublicCatalogProduct(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, isActive: true, deletedAt: null },
    include: productInclude,
  });
  if (!product) {
    throw notFound('Producto no encontrado en el catálogo.');
  }
  return toPublicCatalogProduct(product);
}

export async function listProducts(
  query: {
    search?: string;
    category?: string;
    includeArchived?: boolean;
    lowStockOnly?: boolean;
  },
  includePrices: boolean,
) {
  const products = await prisma.product.findMany({
    where: query.includeArchived ? {} : { isActive: true, deletedAt: null },
    include: productInclude,
    orderBy: [{ name: 'asc' }],
  });

  const categories = extractCategories(products);

  const filtered = products.filter((product) => {
    if (
      query.category &&
      query.category !== 'ALL' &&
      product.category?.trim().toLowerCase() !== query.category.trim().toLowerCase()
    ) {
      return false;
    }
    if (query.search && !matchesProductSearch(product, query.search)) {
      return false;
    }
    if (
      includePrices &&
      query.lowStockOnly &&
      product.stock > product.lowStockThreshold
    ) {
      return false;
    }
    return true;
  });

  return {
    products: filtered.map((p) => toStaffProduct(p, includePrices)),
    categories,
  };
}

export async function getProductById(id: string, includePrices: boolean) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!product) {
    throw notFound('Producto no encontrado.');
  }
  return toStaffProduct(product, includePrices);
}

export async function createProduct(
  input: CreateProductInput,
  actorUserId: string,
) {
  const normalizedCodes = normalizeCodes(input.codes);

  const collisions = await prisma.productCode.findMany({
    where: { code: { in: normalizedCodes.map((c) => c.code) } },
  });
  if (collisions.length > 0) {
    throw conflict(
      `El código "${collisions[0].code}" ya está asignado a otro producto.`,
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        priceGTQ: input.priceGTQ ?? null,
        priceHNL: input.priceHNL ?? null,
        priceNIO: input.priceNIO ?? null,
        priceUSD: input.priceUSD ?? null,
        stock: input.initialStock,
        lowStockThreshold: input.lowStockThreshold,
        isActive: true,
        codes: {
          create: normalizedCodes,
        },
        images: input.images?.length
          ? {
              create: input.images.map((img, idx) => ({
                url: img.url,
                altText: img.altText ?? null,
                sortOrder: idx,
              })),
            }
          : undefined,
      },
      include: productInclude,
    });

    if (input.initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: 'INITIAL',
          quantityDelta: input.initialStock,
          previousStock: 0,
          newStock: input.initialStock,
          reason: 'Inventario inicial al registrar producto',
          performedById: actorUserId,
        },
      });
    }

    return product;
  });

  return {
    product: toStaffProduct(created, true),
    message: 'Producto creado correctamente.',
  };
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!existing) {
    throw notFound('Producto no encontrado.');
  }

  const normalizedCodes = input.codes ? normalizeCodes(input.codes) : undefined;
  if (normalizedCodes) {
    const collisions = await prisma.productCode.findMany({
      where: {
        code: { in: normalizedCodes.map((c) => c.code) },
        productId: { not: id },
      },
    });
    if (collisions.length > 0) {
      throw conflict(
        `El código "${collisions[0].code}" ya pertenece a otro producto.`,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (normalizedCodes) {
      await tx.productCode.deleteMany({ where: { productId: id } });
      await tx.productCode.createMany({
        data: normalizedCodes.map((c) => ({
          productId: id,
          code: c.code,
          label: c.label,
          isPrimary: c.isPrimary,
        })),
      });
    }

    if (input.images !== undefined) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (input.images.length > 0) {
        await tx.productImage.createMany({
          data: input.images.map((img, idx) => ({
            productId: id,
            url: img.url,
            altText: img.altText ?? null,
            sortOrder: idx,
          })),
        });
      }
    }

    return tx.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.priceGTQ !== undefined ? { priceGTQ: input.priceGTQ } : {}),
        ...(input.priceHNL !== undefined ? { priceHNL: input.priceHNL } : {}),
        ...(input.priceNIO !== undefined ? { priceNIO: input.priceNIO } : {}),
        ...(input.priceUSD !== undefined ? { priceUSD: input.priceUSD } : {}),
        ...(input.lowStockThreshold !== undefined
          ? { lowStockThreshold: input.lowStockThreshold }
          : {}),
        ...(input.isActive !== undefined
          ? {
              isActive: input.isActive,
              deletedAt: input.isActive ? null : new Date(),
            }
          : {}),
      },
      include: productInclude,
    });
  });

  return {
    product: toStaffProduct(updated, true),
    message: 'Producto actualizado correctamente.',
  };
}

export async function archiveProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Producto no encontrado.');
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
    include: productInclude,
  });

  return {
    product: toStaffProduct(updated, true),
    message: 'Producto archivado correctamente.',
  };
}

export async function restoreProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Producto no encontrado.');
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { isActive: true, deletedAt: null },
    include: productInclude,
  });

  return {
    product: toStaffProduct(updated, true),
    message: 'Producto restaurado al catálogo activo.',
  };
}

export async function listStockMovements(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw notFound('Producto no encontrado.');
  }

  const movements = await prisma.stockMovement.findMany({
    where: { productId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      performedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });

  return {
    productId: product.id,
    productName: product.name,
    currentStock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    movements,
  };
}

export async function registerStockMovement(
  productId: string,
  input: CreateStockMovementInput,
  actorUserId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw notFound('Producto no encontrado.');
    }

    const previousStock = product.stock;
    let newStock = previousStock;
    let quantityDelta = 0;

    if (input.type === 'MANUAL_IN') {
      quantityDelta = input.quantity;
      newStock = previousStock + input.quantity;
    } else if (input.type === 'MANUAL_OUT') {
      if (input.quantity > previousStock) {
        throw badRequest(
          `Stock insuficiente. Existencia actual: ${previousStock}, salida solicitada: ${input.quantity}.`,
        );
      }
      quantityDelta = -input.quantity;
      newStock = previousStock - input.quantity;
    } else {
      newStock = input.quantity;
      quantityDelta = newStock - previousStock;
      if (quantityDelta === 0) {
        throw badRequest(
          'El nuevo inventario coincide con la existencia actual (sin variación).',
        );
      }
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        type: input.type,
        quantityDelta,
        previousStock,
        newStock,
        reason: input.reason,
        reference: input.reference?.trim() || null,
        performedById: actorUserId,
      },
      include: {
        performedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: newStock },
      include: productInclude,
    });

    return { movement, product: updatedProduct };
  });

  return {
    movement: result.movement,
    product: toStaffProduct(result.product, true),
    message: 'Movimiento de inventario registrado correctamente.',
  };
}
