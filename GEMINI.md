# GEMINI.md — Sistema de Facturación y Pedidos B2B: Arte Modelo Dubois 2.0

> **Propósito:** Documento rector de arquitectura, reglas de negocio, diseño visual, calidad de código, testing y flujo de trabajo entre **Miguel Dubois (Product Owner / Administrador)** y el **Agente de IA (Desarrollo e Ingeniería)**. Toda sesión de trabajo en `Sistema Facturación Arte Modelo 2.0` debe obedecer estas reglas sin excepción.

---

## 1. Roles de Trabajo y Dinámica Operativa (Bajo Consumo de Tokens)

1. **División de responsabilidades:**
   - **Miguel (Administrador / Decisor):** Prioriza qué tarea se ejecuta desde `BACKLOG.md`, toma decisiones administrativas/de negocio, configura secretos/variables de entorno en la nube cuando se le indique, realiza pruebas de aceptación manual en local/staging y autoriza promociones a `development` y `main`.
   - **Agente de IA (Ejecución Técnica):** Diseña, implementa (backend, frontend, base de datos, migraciones, seeds, exportación Excel), escribe y ejecuta todas las pruebas automatizadas, levanta servidores locales para verificación y mantiene actualizados `BACKLOG.md`, `DOCUMENTATION.md` y `CHANGELOG.md`.

2. **Protocolo obligatorio por tarea:**
   1. Miguel indica el ID de la tarea del tablero [BACKLOG.md](./BACKLOG.md) (ej. `F1-02`).
   2. El agente crea o usa una rama `feature/<id>-<slug>` o `fix/<id>-<slug>` a partir de `development` (nunca trabajar features directo en `main`).
   3. El agente implementa la tarea siguiendo las reglas de calidad, diseño y seguridad de este documento.
   4. El agente ejecuta y valida **100% passing**:
      - Tests unitarios con Vitest (`npm test` y `npm run test:coverage` con cobertura **> 85%** en `statements` y `lines`).
      - Tests de integración de API.
      - Tests E2E con Playwright para los flujos afectados.
   5. El agente actualiza `BACKLOG.md` (estado `En Revisión` / `Hecho`) y, al cerrar un hito, actualiza `DOCUMENTATION.md` y `CHANGELOG.md`.
   6. El agente levanta los servidores locales (`apps/api` y `apps/web`) y entrega a Miguel una **guía puntual de prueba**: URL exacta, credenciales/rol a usar y pasos concretos a verificar.
   7. Una vez Miguel aprueba la prueba manual, se realiza el merge a `development`.

3. **Acciones que requieren aprobación explícita de Miguel:**
   - Hacer merge o push hacia `main` (Producción).
   - Ejecutar migraciones o seeds destructivos fuera de la base local de desarrollo/test.
   - Modificar variables de entorno productivas o contratar/cambiar servicios externos.

---

## 2. Arquitectura del Monorepo y Stack Tecnológico

Inicio **desde cero** (sin migrar código heredado de v1.0) bajo una estructura **monorepo** limpia en un único repositorio (`https://github.com/MiguelDP4/arte-modelo-dubois-sistema-facturacion.git`):

```text
Sistema Facturación Arte Modelo 2.0/
├── apps/
│   ├── api/                 # Backend REST: Node.js + Express 5 + TypeScript + Prisma + Zod + ExcelJS + Vitest
│   └── web/                 # Frontend Web: Next.js (App Router) + React + TypeScript + TanStack Query + Axios + SCSS Modules + Vitest + Playwright
├── packages/
│   └── shared/              # Contratos TypeScript, enums, validadores Zod y utilidades compartidas (monedas, estados)
├── BACKLOG.md               # Tablero Kanban / Backlog en Markdown para control de avance
├── CHANGELOG.md             # Registro de cambios por hito
├── DOCUMENTATION.md         # Documentación técnica viva del sistema
└── GEMINI.md                # Este archivo de reglas y plan maestro
```

### Servicios Externos
- **Base de datos:** PostgreSQL (Neon en la nube para Staging/Producción; PostgreSQL local para Dev/Test).
- **Almacenamiento de imágenes:** Cloudinary (fotos de productos y comprobantes de pago).
- **Correos transaccionales y notificaciones:** Resend.
- **Infraestructura adicional (referencia Kroma Lab Sales Studio):** En la Fase 0 (`F0-02`), el agente revisará la documentación/configuración indicada por Miguel de *Kroma Lab Sales Studio* para alinear exactamente el proveedor de hosting/deploy y utilidades operativas, entregando a Miguel la lista exacta de variables `.env` a cargar.

---

## 3. Git Flow y Aislamiento de Bases de Datos

### 3.1 Estrategia de Ramas (Git Flow)
- **`main` (Producción):** Código estable y validado listo para uso real del papá de Miguel. **Prohibido** hacer commits directos de desarrollo. Solo recibe merges aprobados desde `development` por hito completado.
- **`development` (Staging / Demo):** Rama de integración continua y ambiente de demostración con datos de prueba (`seed`).
- **`feature/*` y `fix/*`:** Ramas temporales por tarea del `BACKLOG.md`, creadas desde `development` y fusionadas de regreso a `development`.

### 3.2 Cuatro Entornos de Base de Datos Estrictamente Separados
1. **Local Development (`DATABASE_URL` local):** PostgreSQL corriendo en la PC de Miguel para pruebas manuales locales. No afecta las demos.
2. **Local Test (`TEST_DATABASE_URL` local):** Base de datos exclusiva para suites automatizadas (Vitest integración + Playwright). **PROHIBIDO** ejecutar tests automatizados contra Staging o Producción.
3. **Staging / Demo (`development` en Neon):** Base de datos en la nube poblada mediante `seed` realista (catálogo, clientes de los 4 países, pedidos en consignación, entregas parciales y abonos) para demostrar avances al papá de Miguel.
4. **Producción (`main` en Neon):** Base de datos limpia exclusiva para la operación real. **Intocable** durante desarrollo y pruebas.

---

## 4. Reglas de Negocio (Arte Modelo Dubois 2.0)

### 4.1 Catálogo Multimoneda y Múltiples Códigos
- **Sin categorías de productos:** Los productos del catálogo no manejan campo de categoría ni filtros por categoría; la organización y búsqueda se basan en nombre, descripción y sus códigos asociados.
- **Paginación a nivel de API y debounce obligatorio (Regla Permanente):**
  - Todo endpoint de listado (`/api/catalog`, `/api/products`, `/api/customers`, `/api/users` y futuros módulos de pedidos/pagos/consignación) debe implementar paginación real en base de datos (`page`, `pageSize` configurable por el usuario entre `10`, `20`, `50` y `100`, con objeto `pagination`).
  - Todo input de búsqueda en el frontend debe aplicar un **debounce estricto de `1000 ms` (1 segundo)** (`useDebouncedValue`) antes de disparar solicitudes al backend, evitando sobrecargar el servidor con llamadas por cada pulsación de tecla.
- **Monedas soportadas por país del cliente:**
  - Guatemala: `GTQ` (`Q`)
  - Honduras: `HNL` (`L`)
  - Nicaragua: `NIO` (`C$`)
  - El Salvador / Otros: `USD` (`$`)
- **Tabla relacional `ProductCode` (en lugar de columnas `code`..`code4`):**
  - Un producto puede tener `N` códigos asociados (`id`, `productId`, `code`, `label` ej. *Interno*, *Proveedor*, *Cliente/Tienda*, `isPrimary`).
  - Permite buscar productos por cualquier código registrado y mantener unicidad/trazabilidad sin columnas fijas limitantes.
- **Stock e Historial (`StockMovement`):**
  - Toda variación de inventario (ingreso inicial, ajuste manual, empaque en pedido, reversión por edición/cancelación, devolución de consignación) queda registrada en una tabla de auditoría `StockMovement`.
  - Al editar la cantidad empacada de un pedido, el inventario se ajusta únicamente por el **delta** (diferencia respecto a la cantidad previamente empacada), nunca restando el total nuevamente.

### 4.2 Pedidos, Estados Desacoplados, Precios y Descuentos
- **Tipos de Pedido (`OrderType`):** `REGULAR` | `CONSIGNMENT`.
- **Estados desacoplados en `Order` (nunca mezclar logística con cobros en un solo campo):**
  1. `approvalStatus`: `PENDING_CONFIRMATION` (pedidos creados por `CUSTOMER` esperando validación de staff) | `CONFIRMED` | `CANCELLED` (borrado lógico con `cancelledAt`, `cancelledById`, `cancelReason`).
  2. `fulfillmentStatus`: `PENDING_PACKING` | `PACKING` | `READY_TO_DISPATCH` | `PARTIALLY_DISPATCHED` | `COMPLETED`.
  3. `paymentStatus`: `PENDING_PAYMENT` | `PARTIALLY_PAID` | `PAID`.
- **Inmutabilidad histórica de precios:**
  - Cada `OrderItem` guarda su propio `unitPrice`, `discount` (porcentaje o monto fijo) y `lineTotal` congelados al momento del pedido.
  - Editar el precio de un ítem en un pedido **jamás** modifica el catálogo ni otros pedidos existentes.
  - **Tooltip de último precio:** Al editar el precio unitario de un producto para un cliente en el formulario de pedido, mostrar un tooltip inteligente: `"Último precio aplicado a este cliente: <moneda> XX.XX"` (junto al precio base de catálogo) para asistir las negociaciones diferenciadas por cliente.
- **Flete / Envío:** El pedido soporta `shippingCost` (flete) y `shippingDiscount` (descuento al flete) incluidos en el cálculo de total y saldo pendiente.
- **Edición por rol:** Un `CUSTOMER` puede crear pedidos (que nacen en `PENDING_CONFIRMATION`), pero **no puede editarlos** tras crearlos. Solo `ADMIN` o `EMPLOYEE` pueden modificar ítems, precios, descuentos o cancelar pedidos.

### 4.3 Consignación Automatizada
- Los pedidos `CONSIGNMENT` incorporan control automatizado que reemplaza los Excel manuales:
  - Fecha sugerida de corte/revisión (`consignmentDueDate`).
  - Registro de **devoluciones de mercadería no vendida** (`ConsignmentReturn`), que reingresan unidades al `stock` (vía `StockMovement`) y ajustan automáticamente el `amountPending` del pedido.
  - Reporte/vista consolidada de mercadería en consignación por cliente (entregado, vendido/pagado, devuelto y saldo pendiente).

### 4.4 Pagos y Abonos (Sin Tarjeta de Crédito)
- Tabla `Payment` independiente vinculada a `Order` (múltiples abonos por pedido):
  - **Métodos permitidos exclusivamente:** `CASH` (Efectivo), `TRANSFER` (Transferencia), `CHECK` (Cheque).
  - Campos obligatorios/clave: `amount`, `method`, `paymentDate` (fecha real del pago), `reference` (número de boleta/depósito/cheque), `receiptImageUrl` (opcional vía Cloudinary), `notes`.
  - **Anulación y corrección:** Los pagos no se borran físicamente; pueden **anularse** (`status: VOIDED`, `voidReason`, `voidedAt`, `voidedById`) recalculando automáticamente `amountPaid`, `amountPending` y `paymentStatus` del pedido.

### 4.5 Generación de Documentos en Excel (`.xlsx`)
- El backend generará archivos **Excel (`.xlsx`)** descargables (ej. mediante `ExcelJS`) con el **logo oficial de Arte Modelo Dubois** (migrado desde `favicon.ico` de v1.0 a PNG optimizado) en la esquina superior izquierda, encabezado con **"Arte Modelo Dubois"**, datos del cliente, fecha, código de pedido y desglose financiero.
- Tipos de documento generados dinámicamente desde el historial del pedido:
  1. **Factura / Resumen de Pedido**
  2. **Recibo de Consignación**
  3. **Nota de Entrega Parcial / Total:** Detalla por cada producto la cantidad pedida, cantidad entregada en ese despacho / acumulada y **cantidad pendiente por entregar**, actualizándose automáticamente en entregas posteriores sin edición manual.

---

## 5. Seguridad, Roles Fijos y Notificaciones

- **Roles fijos (`Role`):** `ADMIN`, `EMPLOYEE`, `CUSTOMER` (sin creación dinámica de roles personalizados).
- **RBAC real en Backend y Frontend:**
  - **Todos** los endpoints requieren JWT válido (`requireAuth`) y validación explícita de permisos granulares (eliminando chequeos inconsistentes o rutas privadas sin auth).
  - **Única excepción pública:** El catálogo (`GET /api/catalog`), accesible sin autenticación **ocultando estrictamente** precios, costos y cantidades de stock.
  - **Visibilidad de precios:** Únicamente `ADMIN` y `EMPLOYEE` pueden ver precios y stock en el catálogo general; los visitantes públicos y `CUSTOMER` en catálogo no ven precios fluctuantes (solo en confirmación/detalle de sus propios pedidos si aplica según regla de staff).
- **Registro público:** `/registro` permanece abierto para clientes con verificación obligatoria por correo electrónico.
- **Notificaciones automáticas por correo (Resend):**
  - Verificación de cuenta e invitaciones.
  - Aviso automático al staff cuando un cliente registra un nuevo pedido pendiente de confirmar.
  - Aviso automático al cliente cuando su pedido es confirmado, despachado (parcial o total) o recibe un abono.
  - *(Sin integración de WhatsApp en esta versión).*

---

## 6. Diseño Visual, Material Design Recto y Mobile-First

1. **Estética Material Design Recto (Obligatorio):**
   - **Esquinas 100% rectas:** `border-radius: 0` en todos los componentes (tarjetas, tablas, botones, inputs, selects, modales, badges, dropdowns, barra lateral y botones de acción).
   - **Colores planos y sombras suaves:** Sin gradientes decorativos. Sombras suaves estilo elevación Material Design aplicadas de forma consistente a cards, tablas, botones, inputs enfocados/elevados, modales, dropdowns, Topbar y Sidebar.
   - **Cards, Sidebar y Botones sin contornos innecesarios:** Las cards y el Sidebar **no llevan bordes exteriores** (`border: none`), distinguiéndose únicamente como "hojas de papel" por su sombra. Los botones solo llevan borde cuando su fondo coincide con el fondo del elemento padre; cuando tienen fondo contrastante (primarios, peligro, activos), van sin borde (`border: none`) y con una sombra muy tenue. El logo PNG mantiene fondo transparente y usa `filter: drop-shadow(...)` para perfilado sutil.
2. **Paleta de Colores (`theme.scss` + SCSS Modules):**
   - Conservar la identidad de v1.0:
     - *Tema Claro:* Fondos crema/durazno (`#ffe7c8`, `#f5d5b7`, `#fff1de`, `#fdfaf6`), marca y Topbar azul marino (`#06005c`, `#08042b`, `#110b51`, `#302c61`) y acentos azul rey (`#1c318d`, `#2d22a3`).
     - *Tema Oscuro:* Fondos carbón (`#242424`, `#1a1a1a`, `#292929`, `#333333`), marca vino/borgoña (`#250000`, `#531212`, `#762323`) y acentos dorado/rojo (`#e0c942`, `#b61212`).
   - **Auditoría de contraste:** Ajustar los colores de texto, bordes y estados semánticos (éxito/pagado, advertencia/parcial, error/anulado) para garantizar legibilidad **WCAG AA** en ambos temas.
3. **Layout, Tipografía y Responsividad Mobile-First:**
   - Diseñar siempre primero para móvil (`320px` / `375px`) con objetivos táctiles mínimos de **`44px x 44px`** y cero desbordamiento horizontal.
   - **Topbar fijo superior** + **Sidebar colapsable a la izquierda** (drawer deslizable en móvil).
   - Tipografía base: **`Arial, Helvetica, sans-serif`**.
   - **Prohibido `alert()` / `confirm()` del navegador:** Toda alerta, error o confirmación usa modales personalizados o toasts estilizados con la estética recta del sistema.
   - **Tablas adaptables sin scroll horizontal:** Cuando una tabla exceda el ancho del viewport móvil, debe transformarse automáticamente en **cards apiladas** con sombra suave.
4. **Dashboard Inicial (`/`):**
   - Para `ADMIN` / `EMPLOYEE`: Pedidos pendientes (por confirmar por clientes, por empacar y listos para despacho), resumen de cuentas por cobrar agrupado por moneda (`GTQ`, `HNL`, `NIO`, `USD`), pedidos en consignación próximos a revisión y alertas de stock bajo.
   - Para `CUSTOMER`: Resumen de sus pedidos activos (pendientes de confirmar, en proceso y entregados).

---

## 7. Reglas Estrictas de Calidad de Código y Testing

1. **Calidad de código:**
   - Sin lógica duplicada; funciones pequeñas con retornos tempranos; controladores delegando lógica de negocio compleja a servicios reutilizables (`services/`).
   - Validación estricta de entradas en backend con **Zod** y manejo centralizado de errores HTTP.
2. **Suite obligatoria en cada cambio:**
   - **Tests Unitarios (`Vitest`):** Todo controlador, servicio, middleware, validador, hook, contexto y componente UI nuevo o modificado debe tener tests unitarios en `src/__tests__/`.
   - **100% Passing:** Prohibido dejar tests fallando, saltar assertions o hacer merge con fallas.
   - **Cobertura mínima (> 85%):** `vitest.config.*` exige `statements >= 85%` y `lines >= 85%` en `apps/api` y `apps/web`.
   - **Tests de Integración (API):** Probar endpoints reales contra `TEST_DATABASE_URL` (auth, RBAC, transacciones de pedido/stock/pago/consignación, exportación Excel).
   - **Tests E2E (`Playwright`):** Cubrir los flujos críticos de punta a punta en el navegador (desktop y viewport móvil) ejecutados por el agente antes de pedir validación manual a Miguel.
3. **Documentación viva:**
   - Mantener `DOCUMENTATION.md` (endpoints, esquema Prisma, mapa de componentes) y `CHANGELOG.md` actualizados al cerrar cada hito.

---

## 8. Plan de Trabajo por Fases (Roadmap)

El desglose detallado de tareas ejecutables vive en [BACKLOG.md](./BACKLOG.md).

- **Fase 0 — Fundación, Monorepo, Entornos y Diseño Base:** Inicialización de Git Flow (`main`, `development`), monorepo (`apps/api`, `apps/web`, `packages/shared`), revisión de servicios/env de Kroma Lab Sales Studio, setup de 4 entornos de BD, extracción de logo v1.0, `theme.scss` auditado (WCAG AA, `border-radius: 0`, sombras suaves Material) y layout Mobile-First (Topbar + Sidebar + Modales/Toasts).
- **Fase 1 — Autenticación, Roles Fijos y RBAC Real:** Esquema base de usuarios/permisos, registro público con verificación Resend, login/refresh `httpOnly`, invitación de usuarios, middleware RBAC por permisos en todos los endpoints y vistas de Usuarios/Perfil.
- **Fase 2 — Catálogo Multimoneda, Múltiples Códigos e Inventario (Kardex):** Modelos `Product`, `ProductCode`, `StockMovement`, subida de imágenes optimizadas a Cloudinary, catálogo público (sin precios/stock), catálogo privado para staff y gestión visual Mobile-First.
- **Fase 3 — Clientes Regionales y Vinculación de Cuentas:** CRUD de `Customer` con etiqueta fiscal por país (`NIT`, `RTN`, `DTE`, `RUC`), vinculación de usuarios `CUSTOMER`, historial de pedidos y estados de cuenta del cliente.
- **Fase 4 — Motor de Pedidos, Confirmación, Empaque y Despachos Parciales:** Creación por staff y clientes (`PENDING_CONFIRMATION`), precios congelados + tooltip de último precio al cliente, descuentos por ítem y flete, empaque transaccional por delta con `StockMovement`, despachos parciales (`DispatchEvent`) y cancelación lógica.
- **Fase 5 — Pagos (Efectivo/Transferencia/Cheque), Consignación y Excel (`.xlsx`):** Modelo `Payment` con anulación/corrección y comprobantes, módulo automatizado de Consignación (`ConsignmentReturn` + reporte), correos automáticos de eventos y generador Excel (`.xlsx`) con logo para Factura, Consignación y Nota de Entrega Parcial/Total.
- **Fase 6 — Dashboard Ejecutivo, Auditoría Final, E2E y Salida a Staging/Producción:** Dashboard con KPIs multimoneda, suite completa Playwright (móvil + escritorio), seed realista de demo en `development` (Staging), validación final con Miguel y su papá, y release a `main`.
