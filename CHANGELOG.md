# Changelog — Arte Modelo Dubois 2.0

Todos los cambios relevantes del proyecto se registran en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [2.0.0-alpha.2] — Fase 2 & Fase 3 (Catálogo Multimoneda, Kardex y Cartera Regional de Clientes)

### Agregado
- **Fase 2 — Catálogo Multimoneda, Códigos Múltiples y Kardex (`F2-01` a `F2-03`):**
  - Modelos Prisma `Product`, `ProductCode`, `ProductImage` y `StockMovement` en esquemas PostgreSQL y SQLite.
  - Endpoints `/api/catalog` público (estrictamente sin precios ni stock) y `/api/products` autenticado con control RBAC (`products.read`, `products.read_prices`, `products.manage`), búsqueda unificada por nombre o cualquier código registrado, soft-delete/restauración y Kardex transaccional (`INITIAL`, `MANUAL_IN`, `MANUAL_OUT`, `MANUAL_ADJUST`).
  - Subida de fotografías con compresión en cliente y almacenamiento en Cloudflare R2 (o fallback local `/api/uploads/product-image`).
  - Vistas Mobile-First `/catalogo` (visitante y staff) y `/productos` (tabla responsive/cards, editor dinámico de códigos múltiples, galería modal y Kardex).
- **Fase 3 — Cartera Regional de Clientes (`F3-01` a `F3-02`):**
  - Modelo `Customer` con moneda automática por país (`GT` → `GTQ`, `HN` → `HNL`, `NI` → `NIO`, `SV`/`OTHER` → `USD`) y etiqueta fiscal dinámica (`NIT`, `RTN`, `RUC`, `DTE / NIT`, `ID Fiscal`).
  - Endpoints `/api/customers` 100% protegidos por autenticación/permisos (`customers.read`, `customers.manage`), con vinculación y desvinculación de cuentas de usuario `CUSTOMER` y bloqueo de desactivación mientras existan cuentas vinculadas.
  - Vistas `/clientes` y `/clientes/[id]` Mobile-First.
  - Seed realista en `apps/api/src/db/seed.ts` (4 usuarios, 4 clientes regionales y 6 productos multimoneda con múltiples códigos e imágenes SVG locales).

## [2.0.0-alpha.1] — Fase 0 & Fase 1 (Fundación, Diseño, Auth y RBAC Real)

### Agregado
- **Fase 0 — Fundación y Sistema de Diseño (`F0-01` a `F0-04`):**
  - Rama `development` (Staging) y monorepo npm workspaces con `packages/shared`, `apps/api` (Express 5 + Prisma + Zod + Vitest) y `apps/web` (Next.js 15 App Router + TanStack Query + Axios + SCSS Modules + Vitest + Playwright).
  - Infraestructura alineada con *Kroma Lab Sales Studio*: soporte dual Prisma PostgreSQL (Neon Staging/Prod) y SQLite local aislado (`dev.db` / `test.db`), `render.yaml`, `apps/api/Dockerfile`, `docker-compose.yml`, `.env.example` documentados y bloqueo de seguridad (`SAFETY_BLOCK`) para impedir tests sobre Neon.
  - Extracción del escudo oficial de Arte Modelo Dubois desde v1.0 (`favicon.ico`) a PNG transparente 256×256 en `apps/web/public/logo-arte-modelo.png` y `apps/api/assets/logo-arte-modelo.png`.
  - Sistema visual Material Design Recto (`border-radius: 0`, sombras suaves, tipografía Arial, paleta v1.0 auditada WCAG AA en tema claro y oscuro) y shell Mobile-First (`Topbar`, `Sidebar` colapsable/drawer, `Modal`, `ConfirmModal`, `ToastContainer`, `ResponsiveTable` con cards en móvil).
- **Fase 1 — Autenticación, Roles Fijos y RBAC Real (`F1-01` a `F1-04`):**
  - Esquema Prisma inicial (`User`, `RefreshToken`, `Permission`, `RolePermission`) y seed transaccional idempotente para los roles fijos `ADMIN`, `EMPLOYEE` y `CUSTOMER`.
  - Endpoints completos de Auth (`/api/auth/register`, `/verify`, `/resend-verification`, `/login`, `/refresh-token` con cookie `httpOnly` y rotación, `/logout`, `/me`, `/invite`, `/complete-invitation`) + servicio de correo dual (`smtp` / `resend` / `mock`).
  - Middlewares `requireAuth` y `requirePermission(...)` aplicados a todas las rutas privadas (`/api/users`, `/api/permissions`) con protección del último administrador, auto-desactivación y permisos críticos bloqueados de `ADMIN`.
  - Vistas Mobile-First: `/login`, `/registro`, `/verificar-cuenta`, `/registro-invitado`, `/` (Inicio), `/usuarios` y `/configuracion` (Mi Perfil + Matriz de Permisos por Rol).
  - Suites automatizadas: Vitest (>85% de cobertura en `shared`, `api` y `web`), pruebas de integración contra `test.db` y E2E Playwright (Desktop + Mobile).
