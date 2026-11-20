'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, ROLE_LABELS } from '@arte-modelo/shared';
import { AppShell } from '@/components/AppShell/AppShell';
import {
  ApprovalBadge,
  FulfillmentBadge,
  PaymentBadge,
} from '@/components/Orders/OrderStatusBadges';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import type { DashboardResponse } from '@/types/order';
import styles from './dashboard.module.scss';

function DashboardContent() {
  const { user, permissions, hasPermission } = useAuth();

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-summary', user?.id, user?.role],
    enabled: Boolean(user),
    queryFn: async () => {
      const res = await apiClient.get('/dashboard');
      return res.data as DashboardResponse;
    },
  });

  if (!user) return null;

  const data = dashboardQuery.data;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Bienvenido, {user.fullName}</h1>
          <p className={styles.subtitle}>
            Sistema de Facturación y Pedidos B2B — Arte Modelo Dubois 2.0
          </p>
        </div>
        <span className={`${styles.roleBadge} ${styles[user.role]}`}>
          {ROLE_LABELS[user.role]}
        </span>
      </div>

      {data?.role === 'CUSTOMER' ? (
        <>
          {!data.linked ? (
            <section className={styles.panelCard}>
              <p className={styles.emptyText}>
                Tu usuario aún no está vinculado a una ficha de empresa.
                Comunícate con Arte Modelo Dubois para activar tus pedidos.
              </p>
            </section>
          ) : null}

          <section
            className={styles.customerKpiGrid}
            aria-label="Resumen de tus pedidos"
          >
            <article className={styles.kpiCard}>
              <span>Pedidos por confirmar</span>
              <strong>{data.customerCounts?.pendingConfirmation ?? 0}</strong>
              <small>En revisión por Arte Modelo</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Pedidos en proceso</span>
              <strong>{data.customerCounts?.inProgress ?? 0}</strong>
              <small>En empaque o despacho parcial</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Pedidos entregados</span>
              <strong>{data.customerCounts?.delivered ?? 0}</strong>
              <small>Completados</small>
            </article>
          </section>

          <section className={styles.panelCard} aria-label="Tus pedidos recientes">
            <div className={styles.panelHeader}>
              <h2>Tus Pedidos Recientes</h2>
              <Link href="/pedidos/nuevo" className={styles.inlineLink}>
                + Solicitar nuevo pedido
              </Link>
            </div>
            {(data.recentOrders ?? []).length === 0 ? (
              <p className={styles.emptyText}>
                Aún no tienes pedidos registrados.
              </p>
            ) : (
              <ul className={styles.alertList}>
                {(data.recentOrders ?? []).map((ord) => (
                  <li key={ord.id} className={styles.alertRow}>
                    <div className={styles.alertMeta}>
                      <Link
                        href={`/pedidos/${ord.id}`}
                        className={styles.inlineLink}
                      >
                        {ord.orderNumber}
                      </Link>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <ApprovalBadge status={ord.approvalStatus} />
                        <FulfillmentBadge status={ord.fulfillmentStatus} />
                        <PaymentBadge status={ord.paymentStatus} />
                      </div>
                    </div>
                    <div className={styles.alertRight}>
                      {ord.pricesVisible && ord.totalAmount !== null ? (
                        <>
                          <strong>
                            {formatCurrency(ord.totalAmount, ord.currency)}
                          </strong>
                          <span>
                            Pendiente:{' '}
                            {formatCurrency(ord.amountPending ?? 0, ord.currency)}
                          </span>
                        </>
                      ) : (
                        <span>Por confirmar</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {data && data.role !== 'CUSTOMER' && data.staffCounts ? (
        <>
          <section className={styles.kpiGrid} aria-label="Estado de pedidos">
            <article className={styles.kpiCard}>
              <span>Por confirmar</span>
              <strong>{data.staffCounts.pendingConfirmationCount}</strong>
              <small>Solicitudes de clientes</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Por empacar</span>
              <strong>{data.staffCounts.pendingPackingCount}</strong>
              <small>Confirmados en preparación</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Listos para despacho</span>
              <strong>{data.staffCounts.readyToDispatchCount}</strong>
              <small>Empacados al 100%</small>
            </article>
            <article className={styles.kpiCard}>
              <span>Despacho parcial</span>
              <strong>{data.staffCounts.partiallyDispatchedCount}</strong>
              <small>Con entregas pendientes</small>
            </article>
          </section>

          <section
            className={styles.panelCard}
            aria-label="Cuentas por cobrar por moneda"
          >
            <div className={styles.panelHeader}>
              <h2>Cuentas por Cobrar por Moneda</h2>
              <Link href="/pedidos" className={styles.inlineLink}>
                Ver cartera completa
              </Link>
            </div>
            <div className={styles.kpiGrid}>
              {(data.receivableByCurrency ?? []).map((row) => (
                <article key={row.currency} className={styles.alertRow}>
                  <div className={styles.alertMeta}>
                    <strong>{row.currency}</strong>
                    <span>{row.ordersWithBalance} pedido(s) con saldo</span>
                    <span>
                      Abonado: {formatCurrency(row.totalPaid, row.currency)}
                    </span>
                  </div>
                  <div className={styles.alertRight}>
                    <strong>
                      {formatCurrency(row.totalPending, row.currency)}
                    </strong>
                    <small>Por cobrar</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className={styles.twoCol}>
            <section
              className={styles.panelCard}
              aria-label="Consignaciones próximas a revisión"
            >
              <div className={styles.panelHeader}>
                <h2>Consignaciones Próximas a Revisión</h2>
                <Link href="/consignaciones" className={styles.inlineLink}>
                  Ver consignaciones
                </Link>
              </div>
              {(data.upcomingConsignments ?? []).length === 0 ? (
                <p className={styles.emptyText}>
                  No hay consignaciones pendientes de revisión.
                </p>
              ) : (
                <ul className={styles.alertList}>
                  {(data.upcomingConsignments ?? []).map((c) => (
                    <li key={c.id} className={styles.alertRow}>
                      <div className={styles.alertMeta}>
                        <Link
                          href={`/pedidos/${c.id}`}
                          className={styles.inlineLink}
                        >
                          {c.orderNumber} · {c.customerName}
                        </Link>
                        <span>
                          {c.consignmentDueDate
                            ? `Revisión: ${new Date(
                                c.consignmentDueDate,
                              ).toLocaleDateString('es-GT')}`
                            : 'Sin fecha sugerida'}
                        </span>
                      </div>
                      <div className={styles.alertRight}>
                        <strong>
                          {formatCurrency(c.amountPending, c.currency)}
                        </strong>
                        {c.isOverdue ? (
                          <span className={styles.overduePill}>Vencida</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className={styles.panelCard}
              aria-label="Alertas de stock bajo"
            >
              <div className={styles.panelHeader}>
                <h2>Alertas de Stock Bajo</h2>
                <Link href="/productos" className={styles.inlineLink}>
                  Gestionar inventario
                </Link>
              </div>
              {(data.lowStockProducts ?? []).length === 0 ? (
                <p className={styles.emptyText}>
                  Todo el inventario está por encima del umbral mínimo.
                </p>
              ) : (
                <ul className={styles.alertList}>
                  {(data.lowStockProducts ?? []).map((p) => (
                    <li key={p.id} className={styles.alertRow}>
                      <div className={styles.alertMeta}>
                        <strong>{p.name}</strong>
                        <span>Código: {p.primaryCode || 'Sin código'}</span>
                      </div>
                      <span className={styles.stockLowPill}>
                        Stock: {p.stock} (mín. {p.lowStockThreshold})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}

      <section className={styles.grid} aria-label="Accesos principales">
        <article className={styles.card}>
          <div>
            <h2>Catálogo de Productos</h2>
            <p>
              Consulta nuestro catálogo completo por nombre o cualquiera de sus
              códigos de referencia con galería visual.
            </p>
          </div>
          <Link href="/catalogo" className={styles.cardAction}>
            Ver Catálogo
          </Link>
        </article>

        {hasPermission('orders.read') ? (
          <article className={styles.card}>
            <div>
              <h2>Pedidos y Despachos</h2>
              <p>
                Crea y confirma pedidos B2B, gestiona empaque por delta,
                entregas parciales, abonos y exportación Excel.
              </p>
            </div>
            <Link href="/pedidos" className={styles.cardAction}>
              Ver Pedidos
            </Link>
          </article>
        ) : null}

        {hasPermission('orders.read') ? (
          <article className={styles.card}>
            <div>
              <h2>Consignaciones</h2>
              <p>
                Controla mercadería colocada por cliente, fechas de revisión,
                devoluciones a stock y recibos en Excel.
              </p>
            </div>
            <Link href="/consignaciones" className={styles.cardAction}>
              Ver Consignaciones
            </Link>
          </article>
        ) : null}

        {hasPermission('products.read_prices') ? (
          <article className={styles.card}>
            <div>
              <h2>Productos e Inventario</h2>
              <p>
                Administra precios multimoneda (GTQ, HNL, NIO, USD), códigos
                múltiples, imágenes y movimientos de Kardex.
              </p>
            </div>
            <Link href="/productos" className={styles.cardAction}>
              Gestionar Productos
            </Link>
          </article>
        ) : null}

        {hasPermission('customers.read') ? (
          <article className={styles.card}>
            <div>
              <h2>Cartera de Clientes</h2>
              <p>
                Administra empresas de Guatemala, Honduras, Nicaragua y El
                Salvador, datos fiscales y cuentas vinculadas.
              </p>
            </div>
            <Link href="/clientes" className={styles.cardAction}>
              Gestionar Clientes
            </Link>
          </article>
        ) : null}

        {hasPermission('users.read') ? (
          <article className={styles.card}>
            <div>
              <h2>Gestión de Usuarios</h2>
              <p>
                Invita empleados o clientes, gestiona accesos, reenvía invitaciones
                y administra estados de cuenta.
              </p>
            </div>
            <Link href="/usuarios" className={styles.cardAction}>
              Administrar Usuarios
            </Link>
          </article>
        ) : null}

        <article className={styles.card}>
          <div>
            <h2>Configuración y Permisos</h2>
            <p>
              Actualiza tu perfil, contraseña y (si eres administrador) la matriz
              de {permissions.length} permisos activos de tu rol.
            </p>
          </div>
          <Link href="/configuracion" className={styles.cardAction}>
            Ir a Configuración
          </Link>
        </article>
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
