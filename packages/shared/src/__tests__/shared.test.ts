import { describe, expect, it } from 'vitest';
import {
  APPROVAL_STATUS_LABELS,
  COUNTRY_CURRENCY,
  COUNTRY_LABELS,
  COUNTRY_TAX_LABEL,
  DEFAULT_PAGE_SIZE,
  DISCOUNT_TYPE_LABELS,
  FULFILLMENT_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAGE_SIZE_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PRODUCT_CODE_LABELS,
  SEARCH_DEBOUNCE_MS,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
  buildPaginationMeta,
  calculateOrderLine,
  calculateOrderTotals,
  deriveFulfillmentStatus,
  formatCurrency,
  isPermissionCode,
  LOCKED_ADMIN_PERMISSIONS,
  PERMISSION_CODES,
  PERMISSION_DEFINITIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLES,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  updateRolePermissionsSchema,
  inviteUserSchema,
  completeInvitationSchema,
  createProductSchema,
  updateProductSchema,
  createStockMovementSchema,
  uploadImageSchema,
  createCustomerSchema,
  updateCustomerSchema,
  linkCustomerUserSchema,
  createOrderSchema,
  updateOrderSchema,
  confirmOrderSchema,
  packOrderSchema,
  createDispatchSchema,
  cancelOrderSchema,
} from '../index';

describe('shared constants & currency helpers', () => {
  it('maps countries to expected currencies and tax labels', () => {
    expect(COUNTRY_CURRENCY.GT).toBe('GTQ');
    expect(COUNTRY_CURRENCY.HN).toBe('HNL');
    expect(COUNTRY_CURRENCY.NI).toBe('NIO');
    expect(COUNTRY_CURRENCY.SV).toBe('USD');
    expect(COUNTRY_TAX_LABEL.GT).toBe('NIT');
    expect(COUNTRY_TAX_LABEL.HN).toBe('RTN');
    expect(COUNTRY_TAX_LABEL.NI).toBe('RUC');
  });

  it('formats currencies safely including non-finite fallback and non-breaking spaces', () => {
    expect(formatCurrency(1250.5, 'GTQ')).toContain('Q');
    expect(formatCurrency(1250.5, 'GTQ')).toContain('1');
    expect(formatCurrency(1234567.89, 'GTQ')).toContain('Q\u00A0');
    expect(formatCurrency(99, 'USD')).toContain('$');
    expect(formatCurrency(Number.NaN, 'HNL')).toContain('L');
    expect(formatCurrency(Number.NaN, 'HNL')).toContain('0.00');
  });
});

describe('shared permissions matrix', () => {
  it('defines metadata for every permission code', () => {
    const defCodes = PERMISSION_DEFINITIONS.map((d) => d.code);
    expect(defCodes).toEqual([...PERMISSION_CODES]);
    expect(isPermissionCode('users.read')).toBe(true);
    expect(isPermissionCode('nonexistent.code')).toBe(false);
  });

  it('assigns all permissions to ADMIN and keeps locked admin permissions valid', () => {
    expect(ROLE_DEFAULT_PERMISSIONS.ADMIN).toHaveLength(PERMISSION_CODES.length);
    for (const locked of LOCKED_ADMIN_PERMISSIONS) {
      expect(ROLE_DEFAULT_PERMISSIONS.ADMIN).toContain(locked);
    }
    expect(ROLES).toEqual(['ADMIN', 'EMPLOYEE', 'CUSTOMER']);
  });
});

describe('shared Zod validators', () => {
  it('validates register and login payloads', () => {
    const reg = registerSchema.safeParse({
      fullName: 'Miguel Dubois',
      email: 'MIGUEL@Example.com',
      phone: '+502 5555-1234',
      password: 'Password123',
    });
    expect(reg.success).toBe(true);
    if (reg.success) {
      expect(reg.data.email).toBe('miguel@example.com');
    }

    const weakReg = registerSchema.safeParse({
      fullName: 'A',
      email: 'bad',
      password: 'weak',
    });
    expect(weakReg.success).toBe(false);

    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secret' }).success).toBe(true);
  });

  it('requires currentPassword when newPassword is provided', () => {
    const missingCurrent = updateProfileSchema.safeParse({
      newPassword: 'NewPassword1',
    });
    expect(missingCurrent.success).toBe(false);

    const validChange = updateProfileSchema.safeParse({
      fullName: 'Actualizado',
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
    });
    expect(validChange.success).toBe(true);
  });

  it('validates invite, completeInvitation and role permission updates', () => {
    expect(
      inviteUserSchema.safeParse({
        fullName: 'Empleado Demo',
        email: 'emp@artemodelo.gt',
        role: 'EMPLOYEE',
      }).success,
    ).toBe(true);

    expect(
      completeInvitationSchema.safeParse({
        token: 'a'.repeat(32),
        password: 'Password123',
      }).success,
    ).toBe(true);

    expect(
      updateRolePermissionsSchema.safeParse({
        permissions: [{ code: 'orders.read', granted: true }],
      }).success,
    ).toBe(true);
  });

  it('validates pagination helpers and search debounce constants', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100, 0]);
    expect(DEFAULT_PAGE_SIZE).toBe(10);
    expect(SEARCH_DEBOUNCE_MS).toBe(1000);

    expect(buildPaginationMeta(0, 1, 10)).toEqual({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });

    expect(buildPaginationMeta(25, 1, 10)).toEqual({
      page: 1,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      hasPrev: false,
      hasNext: true,
    });

    expect(buildPaginationMeta(25, 3, 10)).toEqual({
      page: 3,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      hasPrev: true,
      hasNext: false,
    });

    expect(buildPaginationMeta(25, 3, 0)).toEqual({
      page: 1,
      pageSize: 0,
      total: 25,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
  });

  it('validates product, stock movement, upload and customer schemas', () => {
    expect(COUNTRY_LABELS.GT).toBe('Guatemala');
    expect(PRODUCT_CODE_LABELS).toContain('Interno');
    expect(STOCK_MOVEMENT_TYPES).toContain('MANUAL_IN');
    expect(STOCK_MOVEMENT_LABELS.INITIAL).toBe('Inventario inicial');

    expect(
      createProductSchema.safeParse({
        name: 'Marco Dorado Clásico',
        codes: [{ code: 'AMD-001', label: 'Interno', isPrimary: true }],
        priceGTQ: 150,
        priceUSD: 20,
        initialStock: 10,
      }).success,
    ).toBe(true);

    expect(
      createProductSchema.safeParse({
        name: 'Marco sin código',
        codes: [],
      }).success,
    ).toBe(false);

    expect(
      updateProductSchema.safeParse({
        name: 'Marco Actualizado',
        priceHNL: 320,
      }).success,
    ).toBe(true);

    // Stock movement > 0 required for MANUAL_IN / MANUAL_OUT
    expect(
      createStockMovementSchema.safeParse({
        type: 'MANUAL_IN',
        quantity: 0,
        reason: 'Prueba invalida',
      }).success,
    ).toBe(false);

    expect(
      createStockMovementSchema.safeParse({
        type: 'MANUAL_ADJUST',
        quantity: 0,
        reason: 'Conteo físico en cero',
      }).success,
    ).toBe(true);

    expect(
      uploadImageSchema.safeParse({
        fileName: 'marco.png',
        mimeType: 'image/png',
        dataBase64: 'data:image/png;base64,AAAAAAAAAAAAAAAAAAAA',
      }).success,
    ).toBe(true);

    expect(
      createCustomerSchema.safeParse({
        companyName: 'Galería El Quetzal',
        managerName: 'Carlos Méndez',
        phone: '+502 5555-8888',
        email: 'ventas@elquetzal.gt',
        country: 'GT',
        address: 'Zona 10, Ciudad de Guatemala',
        taxId: '123456-7',
      }).success,
    ).toBe(true);

    expect(updateCustomerSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(linkCustomerUserSchema.safeParse({ userId: 'usr_1' }).success).toBe(true);
  });

  it('calculates order lines, totals, fulfillment states, and validates Phase 4 order schemas', () => {
    expect(ORDER_TYPE_LABELS.CONSIGNMENT).toBe('Consignación');
    expect(APPROVAL_STATUS_LABELS.PENDING_CONFIRMATION).toBe('Por confirmar');
    expect(FULFILLMENT_STATUS_LABELS.PARTIALLY_DISPATCHED).toBe('Despacho parcial');
    expect(PAYMENT_STATUS_LABELS.PENDING_PAYMENT).toBe('Pendiente de pago');
    expect(DISCOUNT_TYPE_LABELS.PERCENT).toBe('Porcentaje (%)');

    const lineFixed = calculateOrderLine({
      quantityOrdered: 3,
      unitPrice: 100,
      discountType: 'FIXED',
      discountValue: 25,
    });
    expect(lineFixed).toEqual({ gross: 300, discountAmount: 25, lineTotal: 275 });

    const linePercent = calculateOrderLine({
      quantityOrdered: 2,
      unitPrice: 150,
      discountType: 'PERCENT',
      discountValue: 10,
    });
    expect(linePercent).toEqual({ gross: 300, discountAmount: 30, lineTotal: 270 });

    const totals = calculateOrderTotals({
      items: [lineFixed, linePercent],
      shippingCost: 50,
      shippingDiscount: 15,
      amountPaid: 100,
    });
    expect(totals).toEqual({
      subtotal: 600,
      itemsDiscountTotal: 55,
      shippingCost: 50,
      shippingDiscount: 15,
      totalAmount: 580,
      amountPending: 480,
    });

    expect(deriveFulfillmentStatus([])).toBe('PENDING_PACKING');
    expect(
      deriveFulfillmentStatus([
        { quantityOrdered: 4, quantityPacked: 0, quantityDispatched: 0 },
      ]),
    ).toBe('PENDING_PACKING');
    expect(
      deriveFulfillmentStatus([
        { quantityOrdered: 4, quantityPacked: 2, quantityDispatched: 0 },
      ]),
    ).toBe('PACKING');
    expect(
      deriveFulfillmentStatus([
        { quantityOrdered: 4, quantityPacked: 4, quantityDispatched: 0 },
      ]),
    ).toBe('READY_TO_DISPATCH');
    expect(
      deriveFulfillmentStatus([
        { quantityOrdered: 4, quantityPacked: 4, quantityDispatched: 2 },
      ]),
    ).toBe('PARTIALLY_DISPATCHED');
    expect(
      deriveFulfillmentStatus([
        { quantityOrdered: 4, quantityPacked: 4, quantityDispatched: 4 },
      ]),
    ).toBe('COMPLETED');

    expect(
      createOrderSchema.safeParse({
        customerId: 'cust_1',
        type: 'CONSIGNMENT',
        items: [{ productId: 'prod_1', quantityOrdered: 2, unitPrice: 175 }],
      }).success,
    ).toBe(true);

    expect(
      createOrderSchema.safeParse({
        items: [
          {
            productId: 'prod_1',
            quantityOrdered: 1,
            discountType: 'PERCENT',
            discountValue: 120,
          },
        ],
      }).success,
    ).toBe(false);

    expect(updateOrderSchema.safeParse({ shippingCost: 25 }).success).toBe(true);
    expect(confirmOrderSchema.safeParse({}).success).toBe(true);
    expect(
      packOrderSchema.safeParse({
        items: [{ orderItemId: 'oi_1', quantityPacked: 3 }],
      }).success,
    ).toBe(true);
    expect(
      createDispatchSchema.safeParse({
        carrier: 'Guatex',
        items: [{ orderItemId: 'oi_1', quantityToDispatch: 2 }],
      }).success,
    ).toBe(true);
    expect(
      cancelOrderSchema.safeParse({ cancelReason: 'Cliente solicitó cancelar' }).success,
    ).toBe(true);
    expect(cancelOrderSchema.safeParse({ cancelReason: 'no' }).success).toBe(false);
  });
});
