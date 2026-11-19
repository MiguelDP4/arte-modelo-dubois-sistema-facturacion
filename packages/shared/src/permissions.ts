import type { Role } from './constants';

export const PERMISSION_CODES = [
  'dashboard.view_staff',
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'permissions.manage',
  'products.read',
  'products.read_prices',
  'products.manage',
  'customers.read',
  'customers.manage',
  'orders.read',
  'orders.create',
  'orders.confirm',
  'orders.manage',
  'orders.cancel',
  'payments.read',
  'payments.manage',
  'consignments.manage',
  'reports.read',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export interface PermissionDefinition {
  code: PermissionCode;
  module: string;
  name: string;
  description: string;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    code: 'dashboard.view_staff',
    module: 'Dashboard',
    name: 'Ver KPIs operativos',
    description: 'Ver métricas financieras, cuentas por cobrar y alertas de inventario.',
  },
  {
    code: 'users.read',
    module: 'Usuarios',
    name: 'Ver usuarios',
    description: 'Listar y consultar usuarios del sistema.',
  },
  {
    code: 'users.create',
    module: 'Usuarios',
    name: 'Invitar usuarios',
    description: 'Enviar y reenviar invitaciones de acceso.',
  },
  {
    code: 'users.update',
    module: 'Usuarios',
    name: 'Editar usuarios',
    description: 'Modificar datos, roles y estado activo de usuarios.',
  },
  {
    code: 'users.delete',
    module: 'Usuarios',
    name: 'Eliminar / desactivar usuarios',
    description: 'Dar de baja usuarios del sistema.',
  },
  {
    code: 'permissions.manage',
    module: 'Configuración',
    name: 'Gestionar permisos',
    description: 'Modificar la matriz de permisos de los roles fijos.',
  },
  {
    code: 'products.read',
    module: 'Catálogo',
    name: 'Ver catálogo interno',
    description: 'Consultar productos, códigos múltiples e inventario.',
  },
  {
    code: 'products.read_prices',
    module: 'Catálogo',
    name: 'Ver precios y stock',
    description: 'Visualizar precios multimoneda y existencias de inventario.',
  },
  {
    code: 'products.manage',
    module: 'Catálogo',
    name: 'Administrar productos',
    description: 'Crear, editar, archivar productos y ajustar stock (Kardex).',
  },
  {
    code: 'customers.read',
    module: 'Clientes',
    name: 'Ver cartera de clientes',
    description: 'Consultar clientes regionales e historial.',
  },
  {
    code: 'customers.manage',
    module: 'Clientes',
    name: 'Administrar clientes',
    description: 'Crear, editar clientes y vincular cuentas de usuario.',
  },
  {
    code: 'orders.read',
    module: 'Pedidos',
    name: 'Ver pedidos',
    description: 'Consultar pedidos (todos para staff, propios para cliente).',
  },
  {
    code: 'orders.create',
    module: 'Pedidos',
    name: 'Crear pedidos',
    description: 'Registrar nuevos pedidos regulares o en consignación.',
  },
  {
    code: 'orders.confirm',
    module: 'Pedidos',
    name: 'Confirmar pedidos de clientes',
    description: 'Aprobar pedidos en estado pendiente de confirmación.',
  },
  {
    code: 'orders.manage',
    module: 'Pedidos',
    name: 'Editar, empacar y despachar pedidos',
    description: 'Modificar precios/ítems, empacar por delta y registrar entregas.',
  },
  {
    code: 'orders.cancel',
    module: 'Pedidos',
    name: 'Cancelar pedidos',
    description: 'Aplicar cancelación lógica a pedidos con reversión de inventario.',
  },
  {
    code: 'payments.read',
    module: 'Pagos',
    name: 'Ver abonos y saldos',
    description: 'Consultar historial de pagos y comprobantes.',
  },
  {
    code: 'payments.manage',
    module: 'Pagos',
    name: 'Registrar y anular abonos',
    description: 'Registrar pagos en efectivo, transferencia o cheque y anular errores.',
  },
  {
    code: 'consignments.manage',
    module: 'Consignación',
    name: 'Gestionar consignaciones',
    description: 'Controlar fechas de revisión y devoluciones de mercadería.',
  },
  {
    code: 'reports.read',
    module: 'Reportes',
    name: 'Exportar Excel y reportes',
    description: 'Generar facturas, recibos, notas de entrega en Excel y reportes.',
  },
] as const;

export const ROLE_DEFAULT_PERMISSIONS: Record<Role, readonly PermissionCode[]> = {
  ADMIN: [...PERMISSION_CODES],
  EMPLOYEE: [
    'dashboard.view_staff',
    'products.read',
    'products.read_prices',
    'products.manage',
    'customers.read',
    'customers.manage',
    'orders.read',
    'orders.create',
    'orders.confirm',
    'orders.manage',
    'orders.cancel',
    'payments.read',
    'payments.manage',
    'consignments.manage',
    'reports.read',
  ],
  CUSTOMER: ['orders.read', 'orders.create', 'payments.read'],
};

/**
 * Permisos críticos que el rol ADMIN nunca puede revocarse a sí mismo
 * para evitar el auto-bloqueo administrativo.
 */
export const LOCKED_ADMIN_PERMISSIONS: readonly PermissionCode[] = [
  'users.read',
  'users.update',
  'permissions.manage',
];

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSION_CODES as readonly string[]).includes(value);
}
