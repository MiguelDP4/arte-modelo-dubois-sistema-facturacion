import { z } from 'zod';
import { COUNTRIES, DISCOUNT_TYPES, ORDER_TYPES, ROLES } from './constants';
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

export const productCodeInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'El código no puede estar vacío.')
    .max(60, 'El código no puede superar 60 caracteres.'),
  label: z
    .string()
    .trim()
    .min(1, 'La etiqueta del código es obligatoria.')
    .max(40, 'La etiqueta no puede superar 40 caracteres.')
    .default('Interno'),
  isPrimary: z.boolean().default(false),
});

export const productImageInputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'La URL de la imagen es obligatoria.')
    .max(500, 'La URL de la imagen es demasiado larga.'),
  altText: z
    .string()
    .trim()
    .max(160, 'El texto alternativo no puede superar 160 caracteres.')
    .optional()
    .nullable(),
});

export const priceFieldSchema = z
  .number()
  .min(0, 'El precio no puede ser negativo.')
  .max(9999999.99, 'El precio supera el límite permitido.')
  .nullable()
  .optional();

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre del producto debe tener al menos 2 caracteres.')
    .max(160, 'El nombre no puede superar 160 caracteres.'),
  description: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede superar 1000 caracteres.')
    .nullable()
    .optional(),
  codes: z
    .array(productCodeInputSchema)
    .min(1, 'Debes registrar al menos un código para el producto.'),
  priceGTQ: priceFieldSchema,
  priceHNL: priceFieldSchema,
  priceNIO: priceFieldSchema,
  priceUSD: priceFieldSchema,
  initialStock: z
    .number()
    .int('El inventario inicial debe ser un número entero.')
    .min(0, 'El inventario inicial no puede ser negativo.')
    .default(0),
  lowStockThreshold: z
    .number()
    .int('El umbral de stock bajo debe ser un número entero.')
    .min(0, 'El umbral de stock bajo no puede ser negativo.')
    .default(5),
  images: z
    .array(productImageInputSchema)
    .max(10, 'Máximo 10 imágenes por producto.')
    .optional(),
});

export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre del producto debe tener al menos 2 caracteres.')
    .max(160, 'El nombre no puede superar 160 caracteres.')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'La descripción no puede superar 1000 caracteres.')
    .nullable()
    .optional(),
  codes: z
    .array(productCodeInputSchema)
    .min(1, 'El producto debe conservar al menos un código.')
    .optional(),
  priceGTQ: priceFieldSchema,
  priceHNL: priceFieldSchema,
  priceNIO: priceFieldSchema,
  priceUSD: priceFieldSchema,
  lowStockThreshold: z
    .number()
    .int('El umbral de stock bajo debe ser un número entero.')
    .min(0, 'El umbral de stock bajo no puede ser negativo.')
    .optional(),
  images: z
    .array(productImageInputSchema)
    .max(10, 'Máximo 10 imágenes por producto.')
    .optional(),
  isActive: z.boolean().optional(),
});

export const createStockMovementSchema = z
  .object({
    type: z.enum(['MANUAL_IN', 'MANUAL_OUT', 'MANUAL_ADJUST']),
    quantity: z
      .number()
      .int('La cantidad debe ser un número entero.')
      .min(0, 'La cantidad no puede ser negativa.'),
    reason: z
      .string()
      .trim()
      .min(3, 'Indica el motivo del movimiento (mínimo 3 caracteres).')
      .max(300, 'El motivo no puede superar 300 caracteres.'),
    reference: z
      .string()
      .trim()
      .max(120, 'La referencia no puede superar 120 caracteres.')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => data.type === 'MANUAL_ADJUST' || data.quantity > 0,
    {
      message: 'Para ingresos o salidas, la cantidad debe ser mayor a cero.',
      path: ['quantity'],
    },
  );

export const uploadImageSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'El nombre del archivo es obligatorio.')
    .max(160, 'El nombre del archivo es demasiado largo.'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  dataBase64: z.string().min(16, 'Los datos de la imagen no son válidos.'),
});

export const createCustomerSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'El nombre de la empresa debe tener al menos 2 caracteres.')
    .max(160, 'El nombre de la empresa no puede superar 160 caracteres.'),
  managerName: z
    .string()
    .trim()
    .min(2, 'El nombre del encargado debe tener al menos 2 caracteres.')
    .max(120, 'El nombre del encargado no puede superar 120 caracteres.'),
  phone: z
    .string()
    .trim()
    .min(4, 'Ingresa un teléfono válido.')
    .max(30, 'El teléfono no puede superar 30 caracteres.'),
  email: emailSchema,
  country: z.enum(COUNTRIES),
  address: z
    .string()
    .trim()
    .min(4, 'La dirección debe tener al menos 4 caracteres.')
    .max(300, 'La dirección no puede superar 300 caracteres.'),
  taxId: z
    .string()
    .trim()
    .min(2, 'El identificador fiscal es obligatorio.')
    .max(60, 'El identificador fiscal no puede superar 60 caracteres.'),
  notes: z
    .string()
    .trim()
    .max(1000, 'Las notas no pueden superar 1000 caracteres.')
    .nullable()
    .optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const linkCustomerUserSchema = z.object({
  userId: z.string().trim().min(1, 'Selecciona un usuario para vincular.'),
});

export const orderItemInputSchema = z
  .object({
    productId: z.string().trim().min(1, 'Selecciona un producto válido.'),
    quantityOrdered: z
      .number()
      .int('La cantidad pedida debe ser un número entero.')
      .min(1, 'La cantidad pedida debe ser al menos 1.')
      .max(100000, 'La cantidad pedida supera el máximo permitido.'),
    unitPrice: z
      .number()
      .min(0, 'El precio unitario no puede ser negativo.')
      .max(9999999.99, 'El precio unitario supera el límite permitido.')
      .optional(),
    discountType: z.enum(DISCOUNT_TYPES).default('FIXED'),
    discountValue: z
      .number()
      .min(0, 'El descuento no puede ser negativo.')
      .max(9999999.99, 'El descuento supera el límite permitido.')
      .default(0),
  })
  .refine(
    (data) => data.discountType !== 'PERCENT' || data.discountValue <= 100,
    {
      message: 'El descuento porcentual no puede superar el 100%.',
      path: ['discountValue'],
    },
  );

const optionalMoneyField = z
  .number()
  .min(0, 'El monto no puede ser negativo.')
  .max(9999999.99, 'El monto supera el límite permitido.');

const optionalDueDateField = z
  .string()
  .trim()
  .max(40)
  .nullable()
  .optional()
  .or(z.literal(''));

const optionalNotesField = z
  .string()
  .trim()
  .max(1000, 'Las notas no pueden superar 1000 caracteres.')
  .nullable()
  .optional();

export const createOrderSchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  type: z.enum(ORDER_TYPES).default('REGULAR'),
  shippingCost: optionalMoneyField.default(0),
  shippingDiscount: optionalMoneyField.default(0),
  consignmentDueDate: optionalDueDateField,
  notes: optionalNotesField,
  items: z
    .array(orderItemInputSchema)
    .min(1, 'El pedido debe incluir al menos un producto.'),
});

export const updateOrderSchema = z.object({
  type: z.enum(ORDER_TYPES).optional(),
  shippingCost: optionalMoneyField.optional(),
  shippingDiscount: optionalMoneyField.optional(),
  consignmentDueDate: optionalDueDateField,
  notes: optionalNotesField,
  items: z
    .array(orderItemInputSchema)
    .min(1, 'El pedido debe conservar al menos un producto.')
    .optional(),
});

export const confirmOrderSchema = z.object({
  type: z.enum(ORDER_TYPES).optional(),
  shippingCost: optionalMoneyField.optional(),
  shippingDiscount: optionalMoneyField.optional(),
  consignmentDueDate: optionalDueDateField,
  notes: optionalNotesField,
  items: z
    .array(orderItemInputSchema)
    .min(1, 'El pedido debe incluir al menos un producto.')
    .optional(),
});

export const packOrderSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().trim().min(1, 'Ítem inválido.'),
        quantityPacked: z
          .number()
          .int('La cantidad empacada debe ser un entero.')
          .min(0, 'La cantidad empacada no puede ser negativa.'),
      }),
    )
    .min(1, 'Debes indicar al menos un ítem a empacar.'),
  notes: z
    .string()
    .trim()
    .max(300, 'Las notas de empaque no pueden superar 300 caracteres.')
    .nullable()
    .optional(),
});

export const createDispatchSchema = z.object({
  carrier: z
    .string()
    .trim()
    .max(120, 'El transporte no puede superar 120 caracteres.')
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, 'Las notas de despacho no pueden superar 500 caracteres.')
    .nullable()
    .optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().trim().min(1, 'Ítem inválido.'),
        quantityToDispatch: z
          .number()
          .int('La cantidad a despachar debe ser un entero.')
          .min(1, 'Debes despachar al menos 1 unidad del ítem.'),
      }),
    )
    .min(1, 'Debes seleccionar al menos un ítem para despachar.'),
});

export const cancelOrderSchema = z.object({
  cancelReason: z
    .string()
    .trim()
    .min(3, 'Indica el motivo de cancelación (mínimo 3 caracteres).')
    .max(500, 'El motivo de cancelación no puede superar 500 caracteres.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type CompleteInvitationInput = z.infer<typeof completeInvitationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type UploadImageInput = z.infer<typeof uploadImageSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type LinkCustomerUserInput = z.infer<typeof linkCustomerUserSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>;
export type PackOrderInput = z.infer<typeof packOrderSchema>;
export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
