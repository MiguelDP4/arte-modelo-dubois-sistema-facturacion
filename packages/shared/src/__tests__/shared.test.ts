import { describe, expect, it } from 'vitest';
import {
  COUNTRY_CURRENCY,
  COUNTRY_TAX_LABEL,
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
});
