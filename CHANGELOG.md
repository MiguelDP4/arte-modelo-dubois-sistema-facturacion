# Changelog — Arte Modelo Dubois 2.0

Todos los cambios relevantes del proyecto se registran en este archivo siguiendo [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
