import { describe, expect, it } from 'vitest';
import {
  COUNTRY_CURRENCY,
  COUNTRY_LABELS,
  COUNTRY_TAX_LABEL,
  PRODUCT_CODE_LABELS,
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_TYPES,
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

  it('formats currencies safely including non-finite fallback', () => {
    expect(formatCurrency(1250.5, 'GTQ')).toContain('Q');
    expect(formatCurrency(1250.5, 'GTQ')).toContain('1');
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

  it('validates product, stock movement, upload and customer schemas', () => {
    expect(COUNTRY_LABELS.GT).toBe('Guatemala');
    expect(PRODUCT_CODE_LABELS).toContain('Interno');
    expect(STOCK_MOVEMENT_TYPES).toContain('MANUAL_IN');
    expect(STOCK_MOVEMENT_LABELS.INITIAL).toBe('Inventario inicial');

    expect(
      createProductSchema.safeParse({
        name: 'Marco Dorado Clásico',
        category: 'Marcos',
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
});
