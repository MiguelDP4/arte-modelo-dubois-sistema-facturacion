# Tablero de Avance y Backlog — Arte Modelo Dubois 2.0

> **Instrucciones de uso:** Miguel selecciona el **ID** de una tarea en estado `Por Hacer` y le indica al agente que la ejecute. Al completarla (con tests unitarios >85%, integración y Playwright pasando), el agente la mueve a `En Revisión` y entrega los pasos exactos de prueba local. Tras el visto bueno de Miguel, pasa a `Hecho` y se fusiona a `development`.

## Resumen de Estado

| Fase | Nombre | Estado |
| :--- | :--- | :--- |
| **Fase 0** | Fundación, Monorepo, Entornos y Sistema de Diseño | `En Revisión` |
| **Fase 1** | Autenticación, Roles Fijos y RBAC Real | `En Revisión` |
| **Fase 2** | Catálogo Multimoneda, Códigos Múltiples y Kardex | `Pendiente` |
| **Fase 3** | Cartera Regional de Clientes | `Pendiente` |
| **Fase 4** | Motor de Pedidos, Precios, Empaque y Despachos | `Pendiente` |
| **Fase 5** | Pagos, Consignación Automatizada, Correos y Excel (`.xlsx`) | `Pendiente` |
| **Fase 6** | Dashboard, E2E Completo, Demo Staging y Producción | `Pendiente` |

---

## Backlog Detallado

### Fase 0 — Fundación, Monorepo, Entornos y Sistema de Diseño
| ID | Tarea | Rama Sugerida | Estado | Criterio de Done |
| :--- | :--- | :--- | :--- | :--- |
| `F0-01` | Inicializar rama `development` y estructura monorepo (`apps/api`, `apps/web`, `packages/shared`) con TypeScript, ESLint, Vitest (>85%) y Playwright | `feature/F0-01-monorepo-setup` | `En Revisión` | Monorepo compila (`build`), corren scripts `test` y `test:coverage` base en ambos apps. |
| `F0-02` | Alinear servicios externos e infraestructura con *Kroma Lab Sales Studio* y documentar `.env.example` (Local, Test, Staging, Prod) | `feature/F0-02-infra-env-setup` | `En Revisión` | Guía clara para Miguel con todas las variables de entorno y bases separadas (`local`, `test`, `staging`, `prod`). |
| `F0-03` | Extraer logo oficial desde v1.0 a `apps/web/public` y `apps/api/assets` para encabezados web y Excel | `feature/F0-03-logo-assets` | `En Revisión` | Logo nítido en PNG/SVG disponible para UI y generador `.xlsx`. |
| `F0-04` | Construir `theme.scss` (contraste WCAG AA light/dark, `border-radius: 0`, sombras suaves Material Design) y componentes base Mobile-First (`Topbar`, `Sidebar`, `Modal`, `Toast`, `ResponsiveTable`) | `feature/F0-04-design-system-shell` | `En Revisión` | Shell navegable en 320px/375px y desktop, sin `alert()`, tests unitarios + Playwright visual básico pasando. |

### Fase 1 — Autenticación, Roles Fijos y RBAC Real
| ID | Tarea | Rama Sugerida | Estado | Criterio de Done |
| :--- | :--- | :--- | :--- | :--- |
| `F1-01` | Esquema Prisma inicial (`User`, `Permission`, `RolePermission` para `ADMIN`, `EMPLOYEE`, `CUSTOMER`) + script `seed-permissions` | `feature/F1-01-auth-rbac-schema` | `En Revisión` | Migración aplicada en local y test DB; seed idempotente de permisos por rol. |
| `F1-02` | Endpoints de Auth (`/auth/register`, `/verify`, `/login`, `/refresh-token` `httpOnly`, `/invite`, `/complete-invitation`) + correos Resend | `feature/F1-02-auth-api` | `En Revisión` | Validación Zod, hashing SHA-256/bcrypt, tests unitarios e integración pasando. |
| `F1-03` | Middleware `requireAuth` + `requirePermission(...)` aplicado a todas las rutas privadas y UI de `/login`, `/registro`, `/registro-invitado` | `feature/F1-03-auth-ui-rbac` | `En Revisión` | Flujos auth probados en Vitest y Playwright (login, registro, expiración/refresh). |
| `F1-04` | Módulo `/usuarios` y `/configuracion` (gestión de usuarios, invitaciones y matriz de permisos para roles fijos) | `feature/F1-04-users-permissions-ui` | `En Revisión` | CRUD usuarios, reenvío de invitación y switches de permisos con tests unitarios y E2E. |

### Fase 2 — Catálogo Multimoneda, Códigos Múltiples y Kardex
| ID | Tarea | Rama Sugerida | Estado | Criterio de Done |
| :--- | :--- | :--- | :--- | :--- |
| `F2-01` | Modelos `Product`, `ProductCode`, `ProductImage` y `StockMovement` + API CRUD con búsqueda unificada por código | `feature/F2-01-products-api` | `Por Hacer` | Múltiples códigos por producto, soft-delete, kardex automático e integración DB pasando. |
| `F2-02` | Endpoint `GET /api/catalog` público (sin precios ni stock) vs `GET /api/products` autenticado con permiso de precios/stock | `feature/F2-02-catalog-privacy` | `Por Hacer` | Garantía por tests de que usuarios públicos y `CUSTOMER` no reciben precios ni stock en catálogo. |
| `F2-03` | UI de `/catalogo` y `/productos` Mobile-First (cards en móvil, compresión e subida Cloudinary, galería modal, kardex de stock) | `feature/F2-03-products-ui` | `Por Hacer` | Alta/edición/borrado de productos, múltiples códigos y vistas probadas con Vitest + Playwright. |

### Fase 3 — Cartera Regional de Clientes
| ID | Tarea | Rama Sugerida | Estado | Criterio de Done |
| :--- | :--- | :--- | :--- | :--- |
| `F3-01` | Modelo `Customer` + API CRUD 100% protegida por auth/permisos + vinculación/desvinculación de cuentas `CUSTOMER` | `feature/F3-01-customers-api` | `Por Hacer` | Filtros por país/nombre/NIT, protección contra borrado con pedidos, tests unitarios e integración. |
| `F3-02` | UI de `/clientes` y `/clientes/[id]` (etiqueta fiscal dinámica por país, lista de pedidos y usuarios vinculados) | `feature/F3-02-customers-ui` | `Por Hacer` | Responsive cards en móvil, tests unitarios + Playwright pasando. |

### Fase 4 — Motor de Pedidos, Precios, Empaque y Despachos
| ID | Tarea | Rama Sugerida | Estado | Criterio de Done |
| :--- | :--- | :--- | :--- | :--- |
| `F4-01` | Modelos `Order`, `OrderItem`, `DispatchEvent` con estados desacoplados (`approvalStatus`, `fulfillmentStatus`, `paymentStatus`), descuentos por ítem y flete | `feature/F4-01-orders-schema-api` | `Por Hacer` | Precios congelados, cálculo exacto de totales/saldos, cancelación lógica y tests unitarios/integración. |
| `F4-02` | Endpoint de sugerencia de último precio por `(customerId, productId)` + bloqueo de edición para `CUSTOMER` | `feature/F4-02-last-price-rules` | `Por Hacer` | Staff recibe último precio aplicado al cliente; `CUSTOMER` no puede editar tras crear. |
| `F4-03` | Lógica transaccional de empaque por **delta** de stock (`StockMovement`) y despachos parciales/totales (`DispatchEvent`) | `feature/F4-03-pack-dispatch-engine` | `Por Hacer` | Editar cantidad empacada ajusta solo el delta; despachos actualizan `fulfillmentStatus` sin pisar `paymentStatus`. |
| `F4-04` | UI de `/pedidos`, `/pedidos/nuevo`, `/pedidos/[id]/editar` y `/pedidos/[id]` con tooltip de último precio y confirmación de pedidos de clientes | `feature/F4-04-orders-ui` | `Por Hacer` | Flujo completo cliente -> staff confirma -> empaca -> despacha parcial/total probado en Playwright móvil y desktop. |

### Fase 5 — Pagos, Consignación Automatizada, Correos y Excel (`.xlsx`)
| ID | Tarea | Rama Sugerida | Estado | Criterio de Done |
| :--- | :--- | :--- | :--- | :--- |
| `F5-01` | Modelo `Payment` (`CASH`, `TRANSFER`, `CHECK`, fecha, comprobante, foto opcional) y endpoint de registro + anulación/corrección | `feature/F5-01-payments-module` | `Por Hacer` | Anular pago recalcula `amountPaid`/`amountPending`/`paymentStatus` manteniendo auditoría; UI sin `alert()`. |
| `F5-02` | Módulo de Consignación (`ConsignmentReturn`, fecha de revisión, devolución a stock y vista de mercadería en consignación por cliente) | `feature/F5-02-consignment-module` | `Por Hacer` | Devoluciones reingresan stock y reducen deuda; reporte de consignaciones activas. |
| `F5-03` | Generador de documentos **Excel (`.xlsx`)** con logo en esquina superior izquierda (Factura, Recibo Consignación, Entrega Parcial/Total) | `feature/F5-03-excel-export` | `Por Hacer` | Descarga de `.xlsx` validada por tests (contenido, columnas pedido/entregado/pendiente, logo incrustado). |
| `F5-04` | Notificaciones automáticas por correo (Resend): pedido cliente pendiente, pedido confirmado, despacho y pago registrado | `feature/F5-04-email-notifications` | `Por Hacer` | Plantillas HTML limpias y tests unitarios con mock + verificación de disparo por evento. |

### Fase 6 — Dashboard, E2E Completo, Demo Staging y Producción
| ID | Tarea | Rama Sugerida | Estado | Criterio de Done |
| :--- | :--- | :--- | :--- | :--- |
| `F6-01` | Dashboard inicial (`/`) por rol: pedidos pendientes/por confirmar, cuentas por cobrar por moneda, consignaciones por vencer y stock bajo | `feature/F6-01-dashboard-kpis` | `Por Hacer` | Métricas exactas multimoneda, vista Mobile-First, tests unitarios y Playwright. |
| `F6-02` | Seed realista de demostración para `development` (Staging) y suite E2E integral (Desktop + Mobile) | `feature/F6-02-staging-seed-e2e` | `Por Hacer` | 100% suites pasando (Vitest >85%, integración y Playwright E2E), `DOCUMENTATION.md` y `CHANGELOG.md` completos. |
| `F6-03` | Despliegue Staging (`development`) para demo con el papá de Miguel -> ajustes -> Release a Producción (`main`) | `release/v2.0.0` | `Por Hacer` | Aprobación explícita de Miguel para merge a `main` y base de producción limpia lista para operar. |
