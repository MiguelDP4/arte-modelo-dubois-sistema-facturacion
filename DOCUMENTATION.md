# Documentación Técnica — Arte Modelo Dubois 2.0

> **Fuente Única de Verdad** del Sistema de Facturación y Pedidos B2B de **Arte Modelo Dubois**. Actualizada al cierre de **Fase 4**.

---

## 1. Arquitectura del Monorepo

```text
Sistema Facturación Arte Modelo 2.0/
├── packages/
│   └── shared/              # Contratos TS, roles fijos, matriz de permisos, monedas y validadores Zod
├── apps/
│   ├── api/                 # Backend REST: Express 5 + TypeScript + Prisma + Zod + Vitest + Supertest
│   │   ├── assets/          # Logo oficial PNG (256x256) para exportación Excel (.xlsx)
│   │   ├── prisma/          # schema.prisma (PostgreSQL Neon) y schema.sqlite.prisma (Local/Test)
│   │   └── src/             # config, db, lib, middlewares, services, controllers, routes, __tests__
│   └── web/                 # Frontend: Next.js 15 (App Router) + React 19 + TanStack Query + Axios + SCSS Modules
│       ├── public/          # Logo oficial PNG + favicon.ico
│       ├── e2e/             # Suites Playwright (Desktop 1280px + Mobile 375px)
│       └── src/             # styles (theme/mixins/globals), contexts, lib, components, app, __tests__
├── render.yaml              # Despliegue backend en Render (Free Tier)
├── docker-compose.yml       # PostgreSQL local opcional
├── BACKLOG.md               # Tablero Kanban de tareas
├── CHANGELOG.md             # Historial de versiones e hitos
├── DOCUMENTATION.md         # Este documento
└── GEMINI.md                # Reglas de ingeniería y plan maestro
```

---

## 2. Infraestructura y Servicios Externos (Alineado con Kroma Lab Sales Studio — $0 Costos Fijos)

| Componente | Tecnología | Proveedor | Uso / Ambiente |
| :--- | :--- | :--- | :--- |
| **Base de Datos Cloud** | PostgreSQL Serverless | **Neon.tech** (Free Tier) | 2 proyectos/bases independientes: **Staging** (`development`) y **Producción** (`main`) |
| **Base de Datos Local** | SQLite aislado | Local en PC | `apps/api/prisma/dev.db` (dev manual) y `apps/api/prisma/test.db` (exclusivo pruebas automatizadas) |
| **Backend API** | Node.js + Express 5 + Prisma | **Render** (`render.yaml`) o **Google Cloud Run** (`apps/api/Dockerfile`) | API REST + healthcheck en `/api/health` |
| **Frontend Web** | Next.js 15 App Router | **Cloudflare Pages** / **Vercel** | Portal B2B + panel administrativo Mobile-First |
| **Storage de Archivos** | S3-compatible ($0 Egress) | **Cloudflare R2** (o Cloudinary opcional) | Fotos de productos y comprobantes de pago (Fases 2 y 5) |
| **Correo Transaccional** | SMTP (Nodemailer) / Resend API | **Gmail SMTP** (igual a Kroma Lab) o **Resend** | Verificación de registro, invitaciones y avisos de pedidos/pagos (`EMAIL_PROVIDER=mock` en local/test) |

### Separación Estricta de los 4 Entornos de Base de Datos
1. **Local Development (`apps/api/.env`):** `DATABASE_URL="file:./dev.db"` — para tus pruebas manuales locales sin afectar demos.
2. **Local Test (`apps/api/.env.test`):** `TEST_DATABASE_URL="file:./test.db"` — exclusiva para Vitest (integración) y Playwright. Además `src/config/env.ts` incluye un bloqueo de seguridad (`SAFETY_BLOCK`) que aborta si alguien intenta correr `NODE_ENV=test` contra una URL de `neon.tech` o `neondb`.
3. **Staging / Demo (rama `development`):** Proyecto Neon separado con `seed` realista para demos con tu papá.
4. **Producción (rama `main`):** Proyecto Neon limpio y separado; **intocable** durante desarrollo y pruebas.

### Variables de Entorno a Configurar en la Nube (Staging y Producción)

**Backend (`apps/api` — Render / Cloud Run):**
- `NODE_ENV=production`
- `PORT=8080` (Cloud Run) o asignado por Render
- `FRONTEND_URL=https://<tu-frontend>`
- `DATABASE_URL=postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require`
- `JWT_ACCESS_SECRET=<clave aleatoria de 64+ caracteres>`
- `JWT_REFRESH_SECRET=<clave aleatoria diferente de 64+ caracteres>`
- `EMAIL_PROVIDER=smtp` (o `resend`)
- `EMAIL_FROM="Arte Modelo Dubois" <tu-correo@dominio.com>`
- Si usas SMTP (igual que Kroma Lab): `SMTP_HOST`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS`
- Si usas Resend: `RESEND_API_KEY`
- Storage (para Fases 2 y 5): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (o credenciales `CLOUDINARY_*`)

**Frontend (`apps/web` — Cloudflare Pages / Vercel):**
- `NEXT_PUBLIC_API_URL=https://<tu-api>/api`

---

## 3. Esquema de Base de Datos (Fases 1–4)

Modelos implementados de forma idéntica en `apps/api/prisma/schema.prisma` (PostgreSQL) y `apps/api/prisma/schema.sqlite.prisma` (SQLite):

- **`User`**: `id`, `email` (unique), `passwordHash`, `fullName`, `phone`, `role` (`ADMIN` | `EMPLOYEE` | `CUSTOMER`), `customerId` (opcional hacia `Customer`), `isActive`, `isVerified`, tokens de verificación/invitación, `createdAt`, `updatedAt`.
- **`RefreshToken`**: `id`, `tokenHash` (SHA-256 unique), `userId`, `expiresAt`, `revokedAt`, `createdAt`.
- **`Permission` & `RolePermission`**: matriz RBAC granular por módulo para los 3 roles fijos.
- **`Product`**: `id`, `name`, `description`, `priceGTQ`, `priceHNL`, `priceNIO`, `priceUSD`, `stock`, `lowStockThreshold`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`. (Sin campo de categoría).
- **`ProductCode`**: `id`, `productId`, `code` (unique), `label`, `isPrimary`.
- **`ProductImage`**: `id`, `productId`, `url`, `altText`, `sortOrder`.
- **`StockMovement`**: `id`, `productId`, `type` (`INITIAL` | `MANUAL_IN` | `MANUAL_OUT` | `MANUAL_ADJUST` | `ORDER_PACK` | `ORDER_REVERT` | `CONSIGNMENT_RETURN`), `quantityDelta`, `previousStock`, `newStock`, `reason`, `reference`, `performedById`, `createdAt`.
- **`Customer`**: `id`, `companyName`, `managerName`, `phone`, `email` (unique), `country` (`GT` | `HN` | `NI` | `SV` | `OTHER`), `currency` (`GTQ` | `HNL` | `NIO` | `USD`), `address`, `taxId`, `notes`, `isActive`, `deletedAt`, `createdAt`, `updatedAt`.
- **`Order`**: `id`, `orderNumber` (`PED-YYYY-XXXX`), `customerId`, `type` (`REGULAR` | `CONSIGNMENT`), estados desacoplados (`approvalStatus`, `fulfillmentStatus`, `paymentStatus`), `currency`, `subtotal`, `itemsDiscountTotal`, `shippingCost`, `shippingDiscount`, `totalAmount`, `amountPaid`, `amountPending`, `consignmentDueDate`, `notes`, auditoría de creación/confirmación/cancelación lógica (`cancelReason`, `cancelledAt`, `cancelledById`).
- **`OrderItem`**: `id`, `orderId`, `productId`, `productName`, `productPrimaryCode`, `quantityOrdered`, `quantityPacked`, `quantityDispatched`, `unitPrice` congelado, `discountType` (`FIXED` | `PERCENT`), `discountValue`, `discountAmount`, `lineTotal`.
- **`DispatchEvent` & `DispatchEventItem`**: historial de entregas parciales o totales (`dispatchNumber`, `carrier`, `notes`, `dispatchedAt`, `quantityDispatched`, `cumulativeDispatched`, `remainingPending`).

---

## 4. Endpoints REST Implementados (Fases 1–4)

| Método | Ruta | Acceso / Permiso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Público | Estado de salud del servidor y conectividad con BD. |
| `POST` | `/api/auth/register` | Público | Registro abierto de cliente (`CUSTOMER`) con envío de enlace de verificación. |
| `POST` | `/api/auth/verify` | Público | Verifica correo electrónico mediante token único. |
| `POST` | `/api/auth/resend-verification` | Público | Reenvía enlace de verificación si la cuenta está pendiente. |
| `POST` | `/api/auth/login` | Público | Valida credenciales, devuelve `accessToken` JWT y cookie `httpOnly` `amd_refresh_token`. |
| `POST` | `/api/auth/refresh-token` | Cookie `httpOnly` | Rota el refresh token de forma segura y devuelve nuevo `accessToken` + permisos. |
| `POST` | `/api/auth/logout` | Cookie `httpOnly` | Revoca sesión activa en BD y elimina cookie. |
| `POST` | `/api/auth/complete-invitation` | Público (con token) | Activa usuario invitado definiendo su contraseña. |
| `GET` | `/api/auth/me` | `requireAuth` | Devuelve perfil del usuario autenticado y permisos efectivos. |
| `PATCH` | `/api/auth/me` | `requireAuth` | Actualiza nombre, teléfono y/o contraseña propia. |
| `POST` | `/api/auth/invite` | `users.create` | Invita a un usuario con rol fijo (`ADMIN`, `EMPLOYEE` o `CUSTOMER`). |
| `GET` | `/api/users` | `users.read` | Lista usuarios con filtros `search`, `role`, `status` y paginación (`page`, `pageSize`). |
| `POST` | `/api/users/invite` | `users.create` | Alias REST de invitación de usuario bajo `/api/users`. |
| `POST` | `/api/users/:id/resend-invitation` | `users.create` | Regenera y reenvía token de invitación a un usuario pendiente. |
| `PATCH` | `/api/users/:id` | `users.update` | Edita nombre, teléfono, rol o estado activo (protege último `ADMIN` y auto-desactivación). |
| `DELETE` | `/api/users/:id` | `users.delete` | Desactivación lógica segura y revocación inmediata de refresh tokens. |
| `GET` | `/api/permissions` | `permissions.manage` | Devuelve la matriz de permisos paginable (`page`, `pageSize`; `pageSize=0` por defecto devuelve todos). |
| `PUT` | `/api/permissions/role/:role` | `permissions.manage` | Actualiza permisos de un rol fijo (protegiendo permisos críticos de `ADMIN`). |
| `GET` | `/api/catalog` | Público | Catálogo público paginado (`page`, `pageSize`; `0` = todos) con búsqueda por código/nombre y parámetro opcional `excludeIds`; **excluye precios y stock** (sin categorías). |
| `GET` | `/api/catalog/:id` | Público | Detalle público de producto sin precios ni stock. |
| `GET` | `/api/products` | `products.read` | Lista productos paginados (`page`, `pageSize`; `0` = todos) con búsqueda unificada por cualquier código y parámetro opcional `excludeIds` (solo incluye precios/stock si tiene `products.read_prices`). |
| `GET` | `/api/products/:id` | `products.read` | Detalle interno de producto respetando `products.read_prices`. |
| `POST` | `/api/products` | `products.manage` | Crea producto multimoneda, códigos múltiples, imágenes e inventario inicial (`StockMovement`). |
| `PATCH` | `/api/products/:id` | `products.manage` | Actualiza datos, precios, códigos múltiples e imágenes sin mutar stock directamente. |
| `DELETE` | `/api/products/:id` | `products.manage` | Archiva lógicamente el producto (`isActive = false`). |
| `POST` | `/api/products/:id/restore` | `products.manage` | Restaura producto archivado al catálogo activo. |
| `GET` | `/api/products/:id/stock-movements` | `products.read_prices` | Historial cronológico de Kardex paginable (`page`, `pageSize`; `0` = todos). |
| `POST` | `/api/products/:id/stock-movements` | `products.manage` | Registra entrada, salida o ajuste exacto transaccional de stock. |
| `POST` | `/api/uploads/product-image` | `products.manage` | Sube fotografía JPG/PNG/WebP a Cloudflare R2 o fallback local `/api/uploads/products/`. |
| `GET` | `/api/uploads/products/:fileName` | Público (imagen) | Sirve archivos locales en desarrollo cuando R2 no está configurado. |
| `GET` | `/api/customers` | `customers.read` | Lista clientes regionales paginados (`page`, `pageSize`; `0` = todos) con filtro por país y búsqueda general. |
| `GET` | `/api/customers/unlinked-users` | `customers.manage` | Usuarios `CUSTOMER` activos disponibles para vincular (paginable, `pageSize=0` por defecto). |
| `GET` | `/api/customers/:id` | `customers.read` | Ficha completa del cliente y usuarios vinculados. |
| `POST` | `/api/customers` | `customers.manage` | Crea cliente regional asignando moneda y etiqueta fiscal automática. |
| `PATCH` | `/api/customers/:id` | `customers.manage` | Actualiza datos fiscales/regionales y estado activo. |
| `DELETE` | `/api/customers/:id` | `customers.manage` | Desactiva cliente lógicamente (bloquea si aún tiene cuentas vinculadas). |
| `POST` | `/api/customers/:id/users` | `customers.manage` | Vincula cuenta `CUSTOMER` al cliente. |
| `DELETE` | `/api/customers/:id/users/:userId` | `customers.manage` | Desvincula cuenta de usuario del cliente. |
| `GET` | `/api/orders` | `orders.read` | Lista pedidos paginados (`page`, `pageSize`; `0` = todos), filtros y alcance estricto por cliente si rol es `CUSTOMER`. |
| `GET` | `/api/orders/last-price` | `products.read_prices` | Devuelve el último precio aplicado a un `(customerId, productId)` y el precio base del catálogo (solo staff). |
| `GET` | `/api/orders/:id` | `orders.read` | Detalle completo del pedido, ítems e historial de despachos (enmascara precios si `CUSTOMER` y `PENDING_CONFIRMATION`). |
| `POST` | `/api/orders` | `orders.create` | Crea pedido (`PENDING_CONFIRMATION` para `CUSTOMER` sin precios/flete cliente; `CONFIRMED` para staff con precios congelados). |
| `POST` | `/api/orders/:id/confirm` | `orders.confirm` | Confirma pedido de cliente ajustando precios/descuentos/flete finales (`CUSTOMER` bloqueado). |
| `PATCH` | `/api/orders/:id` | `orders.manage` | Edita pedido sin alterar precios de catálogo ni reducir debajo de lo ya empacado (`CUSTOMER` bloqueado). |
| `POST` | `/api/orders/:id/pack` | `orders.manage` | Empaca por **delta** transaccional de stock (`ORDER_PACK` / `ORDER_REVERT`) sin modificar `paymentStatus`. |
| `POST` | `/api/orders/:id/dispatches` | `orders.manage` | Registra entrega parcial o total (`DispatchEvent`) actualizando `fulfillmentStatus` (`PARTIALLY_DISPATCHED` / `COMPLETED`). |
| `POST` | `/api/orders/:id/cancel` | `orders.cancel` | Cancelación lógica con motivo y reversión automática de unidades empacadas al stock. |

---

## 5. Sistema de Diseño Visual y Frontend (`apps/web`)

- **Estilo Material Design Recto:** `border-radius: 0 !important` global, colores planos, **cards y Sidebar sin bordes exteriores** (elevación tipo papel únicamente por sombra) y **botones sin borde salvo cuando coinciden con el fondo del elemento padre**.
- **Paleta heredada de v1.0 y auditada WCAG AA (`src/styles/theme.scss`):**
  - *Tema Claro:* Fondos `#ffe7c8` / `#f5d5b7` / `#fff1de` / `#fdfaf6`; marca azul marino `#06005c` / `#08042b` / `#110b51`.
  - *Tema Oscuro (`html[data-theme="dark"]`):* Fondos carbón `#242424` / `#1a1a1a` / `#292929` / `#333333`; marca vino/borgoña `#250000` / `#531212` / `#762323`; acentos dorado `#e0c942` y rojo `#b61212`.
- **Mobile-First:** Base diseñada desde 320px/375px con áreas táctiles `>= 44px`, cero scroll horizontal y `ResponsiveTable` que convierte tablas en cards apiladas en móvil.
- **Paginación y Debounce (`1000 ms`):** Componente `Pagination` con selector de tamaño de página (`10`, `20`, `50`, `100` y `Todos` = `pageSize=0`) respaldado por consultas paginadas en todos los endpoints de listado, componente `SearchingIndicator` (`"Buscando..."` con spinner animado) y hook `useDebouncedValue` (`SEARCH_DEBOUNCE_MS = 1000`) en todos los buscadores para evitar solicitudes excesivas al servidor.
- **Sin `alert()` / `confirm()`:** Todo aviso o confirmación usa `ToastContainer`, `Modal` o `ConfirmModal`.

### Páginas Implementadas
- `/login`, `/registro`, `/verificar-cuenta`, `/registro-invitado` — Flujos de acceso y registro público.
- `/` — Dashboard inicial con accesos rápidos por permiso.
- `/catalogo` — Catálogo público (sin precios/stock) y consulta interna para staff con galería modal.
- `/pedidos`, `/pedidos/nuevo`, `/pedidos/[id]` y `/pedidos/[id]/editar` — Listado paginado de pedidos B2B, creación/edición para staff y clientes con `CustomerSearchSelect` y `ProductSearchSelect` (búsqueda perezosa con debounce `1000 ms`, spinner `"Buscando..."`, carga incremental por scroll de 10 en 10, exclusión de repetidos y tooltip condicional solo con historial previo), confirmación, empaque por delta y despachos parciales/totales.
- `/productos` — Gestión de catálogo multimoneda, códigos múltiples, subida de fotos y Kardex (`products.read_prices`).
- `/clientes` y `/clientes/[id]` — Cartera regional con etiqueta fiscal dinámica y vinculación de usuarios (`customers.read`).
- `/usuarios` — Gestión de usuarios e invitaciones (`users.read`).
- `/configuracion` — Mi Perfil y Matriz de Permisos por Rol (`permissions.manage`).

---

## 6. Comandos Útiles del Monorepo

```bash
# Instalar dependencias
npm install

# Preparar bases locales (dev.db con usuarios demo + test.db limpia)
npm run build:shared
npm run db:local:setup
npm run db:test:setup

# Levantar servidores locales
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:3000

# Verificación de calidad y pruebas
npm run lint
npm run build
npm run test:coverage
npm run test:e2e
```
