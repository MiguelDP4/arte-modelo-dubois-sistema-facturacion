import { z } from 'zod';
import { ROLES } from './constants';
import { PERMISSION_CODES } from './permissions';

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar 72 caracteres.')
  .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula.')
  .regex(/[a-z]/, 'La contraseña debe incluir al menos una letra minúscula.')
  .regex(/[0-9]/, 'La contraseña debe incluir al menos un número.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Ingresa un correo electrónico válido.')
  .max(160, 'El correo electrónico es demasiado largo.');

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Ingresa tu nombre completo (mínimo 2 caracteres).')
    .max(120, 'El nombre no puede superar 120 caracteres.'),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .max(30, 'El teléfono no puede superar 30 caracteres.')
    .optional()
    .or(z.literal('')),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(16, 'Token de verificación inválido.'),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const inviteUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'El nombre no puede superar 120 caracteres.'),
  email: emailSchema,
  role: z.enum(ROLES),
  phone: z
    .string()
    .trim()
    .max(30, 'El teléfono no puede superar 30 caracteres.')
    .optional()
    .or(z.literal('')),
});

export const completeInvitationSchema = z.object({
  token: z.string().trim().min(16, 'Token de invitación inválido.'),
  fullName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'El nombre no puede superar 120 caracteres.')
    .optional(),
  phone: z
    .string()
    .trim()
    .max(30, 'El teléfono no puede superar 30 caracteres.')
    .optional()
    .or(z.literal('')),
  password: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres.')
      .max(120, 'El nombre no puede superar 120 caracteres.')
      .optional(),
    phone: z
      .string()
      .trim()
      .max(30, 'El teléfono no puede superar 30 caracteres.')
      .nullable()
      .optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    {
      message: 'Debes ingresar tu contraseña actual para cambiarla.',
      path: ['currentPassword'],
    },
  );

export const updateUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(120, 'El nombre no puede superar 120 caracteres.')
    .optional(),
  phone: z
    .string()
    .trim()
    .max(30, 'El teléfono no puede superar 30 caracteres.')
    .nullable()
    .optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissions: z
    .array(
      z.object({
        code: z.enum(PERMISSION_CODES),
        granted: z.boolean(),
      }),
    )
    .min(1, 'Debes enviar al menos un permiso para actualizar.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type CompleteInvitationInput = z.infer<typeof completeInvitationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
