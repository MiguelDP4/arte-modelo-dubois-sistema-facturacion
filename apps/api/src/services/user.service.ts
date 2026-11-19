import {
  buildPaginationMeta,
  ROLE_LABELS,
  ROLES,
  type Role,
  type UpdateUserInput,
} from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import { generateRandomToken, sha256 } from '../lib/crypto';
import { badRequest, notFound } from '../lib/errors';
import { containsFilter, parsePaginationQuery, prismaPaginationArgs } from '../lib/pagination';
import { env } from '../config/env';
import { sendInvitationEmail } from './email.service';
import { toPublicUser } from './auth.service';

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

export interface ListUsersQuery {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'pending' | 'all';
  page?: unknown;
  pageSize?: unknown;
}

export async function listUsers(query: ListUsersQuery) {
  const { page, pageSize } = parsePaginationQuery(query);
  const where: Record<string, unknown> = {};

  if (query.role && (ROLES as readonly string[]).includes(query.role)) {
    where.role = query.role;
  }

  if (query.status === 'active') {
    where.isActive = true;
    where.isVerified = true;
  } else if (query.status === 'inactive') {
    where.isActive = false;
  } else if (query.status === 'pending') {
    where.isVerified = false;
  }

  const term = query.search?.trim();
  if (term) {
    where.OR = [
      { fullName: containsFilter(term) },
      { email: containsFilter(term) },
      { phone: containsFilter(term) },
    ];
  }

  const total = await prisma.user.count({ where });
  const pagination = buildPaginationMeta(total, page, pageSize);

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    ...prismaPaginationArgs(pagination),
  });

  return {
    users: users.map((u) => ({
      ...toPublicUser(u),
      hasPendingInvitation: Boolean(u.invitationTokenHash && !u.isVerified),
    })),
    pagination,
  };
}

async function ensureNotLastActiveAdmin(targetUserId: string) {
  const otherAdmins = await prisma.user.count({
    where: {
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
      id: { not: targetUserId },
    },
  });

  if (otherAdmins === 0) {
    throw badRequest(
      'No se puede modificar el rol ni desactivar al último administrador activo del sistema.',
    );
  }
}

export async function updateUserById(
  targetUserId: string,
  actorUserId: string,
  input: UpdateUserInput,
) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw notFound('Usuario no encontrado.');
  }

  if (targetUserId === actorUserId) {
    if (input.isActive === false) {
      throw badRequest('No puedes desactivar tu propia cuenta.');
    }
    if (input.role && input.role !== target.role) {
      throw badRequest('No puedes cambiar tu propio rol.');
    }
  }

  const changingAwayFromAdmin =
    target.role === 'ADMIN' &&
    ((input.role !== undefined && input.role !== 'ADMIN') || input.isActive === false);

  if (changingAwayFromAdmin) {
    await ensureNotLastActiveAdmin(targetUserId);
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  if (input.isActive === false) {
    await prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return {
    user: {
      ...toPublicUser(updated),
      hasPendingInvitation: Boolean(updated.invitationTokenHash && !updated.isVerified),
    },
    message: 'Usuario actualizado correctamente.',
  };
}

export async function resendUserInvitation(targetUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw notFound('Usuario no encontrado.');
  }

  if (user.isVerified) {
    throw badRequest('Este usuario ya completó su verificación y tiene cuenta activa.');
  }

  const rawToken = generateRandomToken(32);
  const invitationTokenHash = sha256(rawToken);
  const invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      invitationTokenHash,
      invitationExpiresAt,
    },
  });

  const inviteUrl = await sendInvitationEmail({
    to: user.email,
    fullName: user.fullName,
    roleLabel: ROLE_LABELS[user.role as Role],
    token: rawToken,
  });

  return {
    message: `Invitación reenviada a ${user.email}.`,
    ...(env.emailProvider === 'mock' && !env.isProd ? { devInvitationUrl: inviteUrl } : {}),
  };
}

export async function deleteUserById(targetUserId: string, actorUserId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw notFound('Usuario no encontrado.');
  }

  if (targetUserId === actorUserId) {
    throw badRequest('No puedes eliminar o desactivar tu propia cuenta.');
  }

  if (target.role === 'ADMIN' && target.isActive) {
    await ensureNotLastActiveAdmin(targetUserId);
  }

  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    }),
  ]);

  return {
    message: 'Usuario desactivado correctamente.',
  };
}
