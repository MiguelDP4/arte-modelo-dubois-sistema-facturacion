import {
  buildPaginationMeta,
  LOCKED_ADMIN_PERMISSIONS,
  ROLES,
  type PermissionCode,
  type Role,
  type UpdateRolePermissionsInput,
} from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import { badRequest } from '../lib/errors';
import { parsePaginationQuery } from '../lib/pagination';

export async function getPermissionsForRole(role: Role): Promise<PermissionCode[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { role, granted: true },
    include: { permission: true },
  });

  const granted = new Set<PermissionCode>(
    rows.map((r) => r.permission.code as PermissionCode),
  );

  if (role === 'ADMIN') {
    for (const locked of LOCKED_ADMIN_PERMISSIONS) {
      granted.add(locked);
    }
  }

  return Array.from(granted).sort();
}

export async function getPermissionsMatrix(query?: {
  page?: unknown;
  pageSize?: unknown;
}) {
  const { page, pageSize } = parsePaginationQuery(query || {}, 0);
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { code: 'asc' }],
    include: {
      rolePermissions: true,
    },
  });

  const mapped = permissions.map((perm) => {
    const grants: Record<Role, boolean> = {
      ADMIN: false,
      EMPLOYEE: false,
      CUSTOMER: false,
    };

    for (const rp of perm.rolePermissions) {
      if ((ROLES as readonly string[]).includes(rp.role)) {
        grants[rp.role as Role] = rp.granted;
      }
    }

    if ((LOCKED_ADMIN_PERMISSIONS as readonly string[]).includes(perm.code)) {
      grants.ADMIN = true;
    }

    return {
      id: perm.id,
      code: perm.code as PermissionCode,
      module: perm.module,
      name: perm.name,
      description: perm.description,
      grants,
    };
  });

  const pagination = buildPaginationMeta(mapped.length, page, pageSize);
  const paginated =
    pagination.pageSize === 0
      ? mapped
      : mapped.slice(
          (pagination.page - 1) * pagination.pageSize,
          pagination.page * pagination.pageSize,
        );

  return {
    roles: [...ROLES],
    lockedAdminPermissions: [...LOCKED_ADMIN_PERMISSIONS],
    permissions: paginated,
    pagination,
  };
}

export async function updateRolePermissions(
  role: string,
  input: UpdateRolePermissionsInput,
) {
  if (!(ROLES as readonly string[]).includes(role)) {
    throw badRequest('Rol inválido. Los roles fijos permitidos son ADMIN, EMPLOYEE y CUSTOMER.');
  }

  const targetRole = role as Role;

  if (targetRole === 'ADMIN') {
    const revokingLocked = input.permissions.find(
      (p) =>
        !p.granted &&
        (LOCKED_ADMIN_PERMISSIONS as readonly string[]).includes(p.code),
    );
    if (revokingLocked) {
      throw badRequest(
        `El permiso crítico "${revokingLocked.code}" no puede revocarse del rol ADMIN para evitar bloqueo del sistema.`,
      );
    }
  }

  const allPermissions = await prisma.permission.findMany({
    where: {
      code: { in: input.permissions.map((p) => p.code) },
    },
  });

  const codeToId = new Map(allPermissions.map((p) => [p.code, p.id]));

  await prisma.$transaction(
    input.permissions.map((item) => {
      const permissionId = codeToId.get(item.code);
      if (!permissionId) {
        throw badRequest(`Permiso desconocido: ${item.code}`);
      }

      return prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role: targetRole,
            permissionId,
          },
        },
        update: { granted: item.granted },
        create: {
          role: targetRole,
          permissionId,
          granted: item.granted,
        },
      });
    }),
  );

  return getPermissionsMatrix();
}
