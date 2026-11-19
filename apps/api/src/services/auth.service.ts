import {
  ROLE_LABELS,
  type CompleteInvitationInput,
  type InviteUserInput,
  type LoginInput,
  type RegisterInput,
  type Role,
  type UpdateProfileInput,
} from '@arte-modelo/shared';
import { prisma } from '../lib/prisma';
import {
  generateRandomToken,
  hashPassword,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../lib/crypto';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { env, REFRESH_TOKEN_MAX_AGE_MS } from '../config/env';
import { sendInvitationEmail, sendVerificationEmail } from './email.service';
import { getPermissionsForRole } from './permission.service';

export interface PublicUserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
}

export function toPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
}): PublicUserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role as Role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

export async function registerCustomer(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict('Ya existe una cuenta registrada con este correo electrónico.');
  }

  const passwordHash = await hashPassword(input.password);
  const rawToken = generateRandomToken(32);
  const verificationTokenHash = sha256(rawToken);
  const verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone || null,
      passwordHash,
      role: 'CUSTOMER',
      isActive: true,
      isVerified: false,
      verificationTokenHash,
      verificationTokenExpiresAt,
    },
  });

  const verifyUrl = await sendVerificationEmail({
    to: user.email,
    fullName: user.fullName,
    token: rawToken,
  });

  return {
    user: toPublicUser(user),
    message:
      'Registro exitoso. Revisa tu correo electrónico para verificar tu cuenta antes de iniciar sesión.',
    ...(env.emailProvider === 'mock' && !env.isProd ? { devVerificationUrl: verifyUrl } : {}),
  };
}

export async function verifyEmailToken(rawToken: string) {
  const tokenHash = sha256(rawToken);
  const user = await prisma.user.findUnique({
    where: { verificationTokenHash: tokenHash },
  });

  if (!user) {
    throw badRequest('El enlace de verificación no es válido o ya fue utilizado.');
  }

  if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
    throw badRequest('El enlace de verificación ha expirado. Solicita uno nuevo.');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
    },
  });

  return {
    user: toPublicUser(updated),
    message: 'Tu correo ha sido verificado correctamente. Ya puedes iniciar sesión.',
  };
}

export async function resendVerificationEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isVerified || !user.passwordHash) {
    return {
      message:
        'Si el correo existe y está pendiente de verificación, enviaremos un nuevo enlace.',
    };
  }

  const rawToken = generateRandomToken(32);
  const verificationTokenHash = sha256(rawToken);
  const verificationTokenExpiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationTokenHash,
      verificationTokenExpiresAt,
    },
  });

  const verifyUrl = await sendVerificationEmail({
    to: user.email,
    fullName: user.fullName,
    token: rawToken,
  });

  return {
    message:
      'Si el correo existe y está pendiente de verificación, enviaremos un nuevo enlace.',
    ...(env.emailProvider === 'mock' && !env.isProd ? { devVerificationUrl: verifyUrl } : {}),
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    throw unauthorized('Credenciales inválidas.');
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw unauthorized('Credenciales inválidas.');
  }

  if (!user.isActive) {
    throw unauthorized('Tu cuenta está desactivada. Contacta al administrador.');
  }

  if (!user.isVerified) {
    throw unauthorized(
      'Debes verificar tu correo electrónico antes de iniciar sesión.',
    );
  }

  const role = user.role as Role;
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role,
  });

  const { token: refreshToken } = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
    },
  });

  const permissions = await getPermissionsForRole(role);

  return {
    accessToken,
    refreshToken,
    user: toPublicUser(user),
    permissions,
  };
}

export async function rotateRefreshToken(rawRefreshToken: string | undefined) {
  if (!rawRefreshToken) {
    throw unauthorized('Sesión expirada. Inicia sesión nuevamente.');
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw unauthorized('Token de sesión inválido o expirado.');
  }

  const tokenHash = sha256(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !stored ||
    stored.revokedAt !== null ||
    stored.expiresAt < new Date() ||
    stored.userId !== payload.sub
  ) {
    throw unauthorized('Sesión revocada o expirada. Inicia sesión nuevamente.');
  }

  if (!stored.user.isActive || !stored.user.isVerified) {
    throw unauthorized('Tu cuenta no se encuentra activa.');
  }

  const role = stored.user.role as Role;
  const newAccessToken = signAccessToken({
    sub: stored.user.id,
    email: stored.user.email,
    role,
  });
  const { token: newRefreshToken } = signRefreshToken(stored.user.id);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: sha256(newRefreshToken),
        userId: stored.user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
      },
    }),
  ]);

  const permissions = await getPermissionsForRole(role);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: toPublicUser(stored.user),
    permissions,
  };
}

export async function logoutSession(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  const tokenHash = sha256(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function inviteUser(input: InviteUserInput, invitedById: string) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict('Ya existe un usuario registrado o invitado con ese correo.');
  }

  const rawToken = generateRandomToken(32);
  const invitationTokenHash = sha256(rawToken);
  const invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone || null,
      role: input.role,
      isActive: true,
      isVerified: false,
      invitationTokenHash,
      invitationExpiresAt,
      invitedById,
    },
  });

  const inviteUrl = await sendInvitationEmail({
    to: user.email,
    fullName: user.fullName,
    roleLabel: ROLE_LABELS[input.role],
    token: rawToken,
  });

  return {
    user: toPublicUser(user),
    message: `Invitación enviada a ${user.email}.`,
    ...(env.emailProvider === 'mock' && !env.isProd ? { devInvitationUrl: inviteUrl } : {}),
  };
}

export async function completeInvitation(input: CompleteInvitationInput) {
  const tokenHash = sha256(input.token);
  const user = await prisma.user.findUnique({
    where: { invitationTokenHash: tokenHash },
  });

  if (!user) {
    throw badRequest('El enlace de invitación no es válido o ya fue utilizado.');
  }

  if (user.invitationExpiresAt && user.invitationExpiresAt < new Date()) {
    throw badRequest('La invitación ha expirado. Solicita al administrador que la reenvíe.');
  }

  const passwordHash = await hashPassword(input.password);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: input.fullName?.trim() || user.fullName,
      phone: input.phone !== undefined ? input.phone || null : user.phone,
      passwordHash,
      isVerified: true,
      isActive: true,
      invitationTokenHash: null,
      invitationExpiresAt: null,
    },
  });

  return {
    user: toPublicUser(updated),
    message: 'Registro completado. Ya puedes iniciar sesión con tu nueva contraseña.',
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound('Usuario no encontrado.');
  }
  const permissions = await getPermissionsForRole(user.role as Role);
  return {
    user: toPublicUser(user),
    permissions,
  };
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound('Usuario no encontrado.');
  }

  const updateData: {
    fullName?: string;
    phone?: string | null;
    passwordHash?: string;
  } = {};

  if (input.fullName !== undefined) {
    updateData.fullName = input.fullName;
  }

  if (input.phone !== undefined) {
    updateData.phone = input.phone || null;
  }

  if (input.newPassword) {
    if (!user.passwordHash || !input.currentPassword) {
      throw badRequest('Debes proporcionar tu contraseña actual.');
    }
    const matches = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!matches) {
      throw badRequest('La contraseña actual no es correcta.');
    }
    updateData.passwordHash = await hashPassword(input.newPassword);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  const permissions = await getPermissionsForRole(updated.role as Role);
  return {
    user: toPublicUser(updated),
    permissions,
    message: 'Perfil actualizado correctamente.',
  };
}
