import type { PermissionCode, Role } from '@arte-modelo/shared';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export interface ManagedUser extends AuthUser {
  hasPendingInvitation: boolean;
}

export interface PermissionMatrixItem {
  id: string;
  code: PermissionCode;
  module: string;
  name: string;
  description: string;
  grants: Record<Role, boolean>;
}

export interface PermissionMatrixResponse {
  roles: Role[];
  lockedAdminPermissions: PermissionCode[];
  permissions: PermissionMatrixItem[];
}
