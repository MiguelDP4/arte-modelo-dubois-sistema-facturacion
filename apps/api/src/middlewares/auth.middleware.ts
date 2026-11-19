import type { NextFunction, Request, Response } from 'express';
import type { PermissionCode, Role } from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/crypto';
import { forbidden, unauthorized } from '../lib/errors';
import { getPermissionsForRole } from '../services/permission.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  customerId: string | null;
  permissions: PermissionCode[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw unauthorized('Token de acceso requerido.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized('Token de acceso inválido o expirado.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive || !user.isVerified) {
      throw unauthorized('Tu cuenta no se encuentra activa.');
    }

    const role = user.role as Role;
    const permissions = await getPermissionsForRole(role);

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role,
      customerId: user.customerId ?? null,
      permissions,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(...requiredPermissions: PermissionCode[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }

    const missing = requiredPermissions.filter(
      (code) => !req.user!.permissions.includes(code),
    );

    if (missing.length > 0) {
      next(
        forbidden(
          `No cuentas con el permiso requerido (${missing.join(', ')}).`,
        ),
      );
      return;
    }

    next();
  };
}
