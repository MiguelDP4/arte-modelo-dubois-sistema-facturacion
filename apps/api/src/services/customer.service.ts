import {
  buildPaginationMeta,
  COUNTRIES,
  COUNTRY_CURRENCY,
  COUNTRY_LABELS,
  COUNTRY_TAX_LABEL,
  type CountryCode,
  type CreateCustomerInput,
  type Currency,
  type UpdateCustomerInput,
} from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import { badRequest, conflict, notFound } from '../lib/errors';
import { containsFilter, parsePaginationQuery, prismaPaginationArgs } from '../lib/pagination';

function toCustomerDto(customer: {
  id: string;
  companyName: string;
  managerName: string;
  phone: string;
  email: string;
  country: string;
  currency: string;
  address: string;
  taxId: string;
  notes: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users: number };
  users?: Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    isVerified: boolean;
  }>;
}) {
  const country = (
    (COUNTRIES as readonly string[]).includes(customer.country)
      ? customer.country
      : 'OTHER'
  ) as CountryCode;

  return {
    id: customer.id,
    companyName: customer.companyName,
    managerName: customer.managerName,
    phone: customer.phone,
    email: customer.email,
    country,
    countryLabel: COUNTRY_LABELS[country],
    currency: customer.currency as Currency,
    taxLabel: COUNTRY_TAX_LABEL[country],
    address: customer.address,
    taxId: customer.taxId,
    notes: customer.notes,
    isActive: customer.isActive,
    deletedAt: customer.deletedAt,
    linkedUsersCount: customer._count?.users ?? customer.users?.length ?? 0,
    ...(customer.users ? { users: customer.users } : {}),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export async function listCustomers(query: {
  search?: string;
  country?: string;
  includeInactive?: boolean;
  page?: unknown;
  pageSize?: unknown;
}) {
  const { page, pageSize } = parsePaginationQuery(query);
  const where: Record<string, unknown> = {};

  if (!query.includeInactive) {
    where.isActive = true;
    where.deletedAt = null;
  }
  if (query.country && query.country !== 'ALL') {
    where.country = query.country;
  }

  const term = query.search?.trim();
  if (term) {
    where.OR = [
      { companyName: containsFilter(term) },
      { managerName: containsFilter(term) },
      { email: containsFilter(term) },
      { taxId: containsFilter(term) },
      { phone: containsFilter(term) },
    ];
  }

  const total = await prisma.customer.count({ where });
  const pagination = buildPaginationMeta(total, page, pageSize);

  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: { select: { users: true } },
    },
    orderBy: [{ companyName: 'asc' }],
    ...prismaPaginationArgs(pagination),
  });

  return {
    customers: customers.map(toCustomerDto),
    pagination,
  };
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          isVerified: true,
        },
        orderBy: { fullName: 'asc' },
      },
      _count: { select: { users: true } },
    },
  });

  if (!customer) {
    throw notFound('Cliente no encontrado.');
  }

  return {
    customer: toCustomerDto(customer),
    orders: [] as unknown[],
  };
}

export async function listUnlinkedCustomerUsers(query?: {
  page?: unknown;
  pageSize?: unknown;
}) {
  const { page, pageSize } = parsePaginationQuery(query || {}, 0);
  const where = {
    role: 'CUSTOMER',
    isActive: true,
    customerId: null,
  };

  const total = await prisma.user.count({ where });
  const pagination = buildPaginationMeta(total, page, pageSize);

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      isVerified: true,
    },
    orderBy: [{ fullName: 'asc' }],
    ...prismaPaginationArgs(pagination),
  });

  return { users, pagination };
}

export async function createCustomer(input: CreateCustomerInput) {
  const existing = await prisma.customer.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw conflict('Ya existe un cliente registrado con este correo electrónico.');
  }

  const customer = await prisma.customer.create({
    data: {
      companyName: input.companyName,
      managerName: input.managerName,
      phone: input.phone,
      email: input.email,
      country: input.country,
      currency: COUNTRY_CURRENCY[input.country],
      address: input.address,
      taxId: input.taxId,
      notes: input.notes ?? null,
      isActive: true,
    },
    include: {
      _count: { select: { users: true } },
    },
  });

  return {
    customer: toCustomerDto(customer),
    message: 'Cliente creado correctamente.',
  };
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) {
    throw notFound('Cliente no encontrado.');
  }

  if (input.email && input.email !== existing.email) {
    const dup = await prisma.customer.findUnique({
      where: { email: input.email },
    });
    if (dup) {
      throw conflict('Ya existe otro cliente con ese correo electrónico.');
    }
  }

  const nextCountry = input.country ?? (existing.country as CountryCode);
  const nextCurrency = input.country
    ? COUNTRY_CURRENCY[input.country]
    : existing.currency;

  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...(input.companyName !== undefined
        ? { companyName: input.companyName }
        : {}),
      ...(input.managerName !== undefined
        ? { managerName: input.managerName }
        : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.country !== undefined
        ? { country: nextCountry, currency: nextCurrency }
        : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.isActive !== undefined
        ? {
            isActive: input.isActive,
            deletedAt: input.isActive ? null : new Date(),
          }
        : {}),
    },
    include: {
      _count: { select: { users: true } },
    },
  });

  return {
    customer: toCustomerDto(updated),
    message: 'Cliente actualizado correctamente.',
  };
}

export async function archiveCustomer(id: string) {
  const existing = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
    },
  });
  if (!existing) {
    throw notFound('Cliente no encontrado.');
  }

  if (existing._count.users > 0) {
    throw conflict(
      'Este cliente tiene cuentas de usuario vinculadas. Desvincúlalas antes de desactivar el cliente.',
    );
  }

  const updated = await prisma.customer.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
    include: {
      _count: { select: { users: true } },
    },
  });

  return {
    customer: toCustomerDto(updated),
    message: 'Cliente desactivado correctamente.',
  };
}

export async function linkUserToCustomer(customerId: string, userId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw notFound('Cliente no encontrado.');
  }
  if (!customer.isActive) {
    throw badRequest('No puedes vincular usuarios a un cliente desactivado.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound('Usuario no encontrado.');
  }
  if (user.role !== 'CUSTOMER') {
    throw badRequest(
      'Únicamente cuentas con rol Cliente pueden vincularse a una ficha de cliente.',
    );
  }
  if (user.customerId && user.customerId !== customerId) {
    throw conflict('Este usuario ya se encuentra vinculado a otro cliente.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { customerId },
  });

  return {
    ...(await getCustomerById(customerId)),
    message: `Usuario ${user.fullName} vinculado correctamente.`,
  };
}

export async function unlinkUserFromCustomer(customerId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound('Usuario no encontrado.');
  }
  if (user.customerId !== customerId) {
    throw badRequest('El usuario no está vinculado a este cliente.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { customerId: null },
  });

  return {
    ...(await getCustomerById(customerId)),
    message: `Usuario ${user.fullName} desvinculado correctamente.`,
  };
}
