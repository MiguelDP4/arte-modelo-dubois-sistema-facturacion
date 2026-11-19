import type { PrismaClient } from '@prisma/client';
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLES,
  type PermissionCode,
} from '@arte-modelo/shared';

/**
 * Siembra idempotente de permisos base y asignaciones por defecto
 * para los 3 roles fijos (ADMIN, EMPLOYEE, CUSTOMER).
 * Ejecutado en transacción para rendimiento óptimo tanto en SQLite como en PostgreSQL.
 */
export async function seedPermissions(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    const existingPerms = await tx.permission.findMany();
    const permByCode = new Map(existingPerms.map((p) => [p.code, p]));

    for (const def of PERMISSION_DEFINITIONS) {
      const existing = permByCode.get(def.code);
      if (!existing) {
        const created = await tx.permission.create({
          data: {
            code: def.code,
            module: def.module,
            name: def.name,
            description: def.description,
          },
        });
        permByCode.set(def.code, created);
      } else if (
        existing.module !== def.module ||
        existing.name !== def.name ||
        existing.description !== def.description
      ) {
        const updated = await tx.permission.update({
          where: { id: existing.id },
          data: {
            module: def.module,
            name: def.name,
            description: def.description,
          },
        });
        permByCode.set(def.code, updated);
      }
    }

    const existingGrants = await tx.rolePermission.findMany();
    const grantKeySet = new Set(
      existingGrants.map((g) => `${g.role}:${g.permissionId}`),
    );

    const missingGrants: Array<{
      role: string;
      permissionId: string;
      granted: boolean;
    }> = [];

    for (const def of PERMISSION_DEFINITIONS) {
      const permission = permByCode.get(def.code);
      if (!permission) continue;

      for (const role of ROLES) {
        const key = `${role}:${permission.id}`;
        if (!grantKeySet.has(key)) {
          const defaults = ROLE_DEFAULT_PERMISSIONS[role] as readonly PermissionCode[];
          missingGrants.push({
            role,
            permissionId: permission.id,
            granted: defaults.includes(def.code),
          });
        }
      }
    }

    if (missingGrants.length > 0) {
      await tx.rolePermission.createMany({
        data: missingGrants,
      });
    }
  });
}
