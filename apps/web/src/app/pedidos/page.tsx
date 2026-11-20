'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  APPROVAL_STATUSES,
  APPROVAL_STATUS_LABELS,
  DEFAULT_PAGE_SIZE,
  formatCurrency,
  FULFILLMENT_STATUSES,
  FULFILLMENT_STATUS_LABELS,
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  SEARCH_DEBOUNCE_MS,
  type PaginationMeta,
} from '@arte-modelo/shared';
import { Eye, Pencil, Plus } from 'lucide-react';
import { AppShell } from '@/components/AppShell/AppShell';
import {
  ResponsiveTable,
  type TableColumn,
} from '@/components/ResponsiveTable/ResponsiveTable';
import { Pagination } from '@/components/Pagination/Pagination';
import { SearchingIndicator } from '@/components/SearchingIndicator/SearchingIndicator';
import {
  ApprovalBadge,
  FulfillmentBadge,
  OrderTypeBadge,
  PaymentBadge,
} from '@/components/Orders/OrderStatusBadges';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient } from '@/lib/api-client';
import type { OrderDto, OrderListResponse } from '@/types/order';
import styles from './pedidos.module.scss';

function PedidosContent() {
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission('orders.create');
  const canManage = hasPermission('orders.manage') && user?.role !== 'CUSTOMER';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [approvalFilter, setApprovalFilter] = useState('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const ordersQuery = useQuery({
    queryKey: [
      'orders',
      debouncedSearch,
      approvalFilter,
      fulfillmentFilter,
      typeFilter,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (approvalFilter !== 'ALL') params.approvalStatus = approvalFilter;
      if (fulfillmentFilter !== 'ALL') params.fulfillmentStatus = fulfillmentFilter;
      if (typeFilter !== 'ALL') params.type = typeFilter;

      const res = await apiClient.get('/orders', { params });
      return res.data as OrderListResponse;
    },
  });

  const pagination: PaginationMeta = ordersQuery.data?.pagination ?? {
    page,
    pageSize,
    total: ordersQuery.data?.orders?.length ?? 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  };

  const columns: TableColumn<OrderDto>[] = [
    {
      key: 'order',
      header: 'Pedido',
      render: (order) => (
        <div className={styles.orderCell}>
          <strong>{order.orderNumber}</strong>
          <span>
            {new Date(order.createdAt).toLocaleDateString('es-GT')} ·{' '}
            {order.itemsCount} ítem{order.itemsCount === 1 ? '' : 's'}
          </span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (order) => (
        <div className={styles.orderCell}>
          <strong>{order.customer.companyName}</strong>
          <span>
            {order.customer.countryLabel} ({order.currency})
          </span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (order) => <OrderTypeBadge type={order.type} />,
    },
    {
      key: 'statuses',
      header: 'Estados (Aprobación / Logística / Cobro)',
      render: (order) => (
        <div className={styles.badgesCol}>
          <ApprovalBadge status={order.approvalStatus} />
          <FulfillmentBadge status={order.fulfillmentStatus} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      ),
    },
    {
      key: 'totals',
      header: 'Total / Saldo',
      render: (order) =>
        order.pricesVisible && order.totalAmount !== null ? (
          <div className={`${styles.orderCell} ${styles.moneyValue}`}>
            <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
            <span>
              Pendiente:{' '}
              {formatCurrency(order.amountPending ?? 0, order.currency)}
            </span>
          </div>
        ) : (
          <span className={styles.mutedHint}>Por confirmar con asesor</span>
        ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (order) => (
        <div className={styles.actionsCell}>
          <Link href={`/pedidos/${order.id}`} className={styles.actionBtn}>
            <Eye size={15} /> Ver detalle
          </Link>
          {canManage && order.approvalStatus !== 'CANCELLED' ? (
            <Link
              href={`/pedidos/${order.id}/editar`}
              className={styles.actionBtn}
            >
              <Pencil size={15} /> Editar
            </Link>
          ) : null}
        </div>
      ),
    },
  ];

  const isWaitingDebounce = search.trim() !== debouncedSearch.trim();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Pedidos B2B y Despachos</h1>
          <p className={styles.subtitle}>
            Control desacoplado de confirmación, empaque por delta y entregas
            parciales o totales.
          </p>
        </div>

        {canCreate ? (
          <Link href="/pedidos/nuevo" className={styles.primaryBtn}>
            <Plus size={18} /> Nuevo pedido
          </Link>
        ) : null}
      </div>

      <section className={styles.filtersCard} aria-label="Filtros de pedidos">
        <div className={styles.field}>
          <label htmlFor="orders-search">Buscar pedido</label>
          <input
            id="orders-search"
            type="search"
            placeholder="Número PED-..., empresa, NIT o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isWaitingDebounce ||
          (ordersQuery.isFetching && debouncedSearch.trim().length > 0) ? (
            <SearchingIndicator compact />
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="orders-approval-filter">Confirmación</label>
          <select
            id="orders-approval-filter"
            value={approvalFilter}
            onChange={(e) => {
              setApprovalFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Todas</option>
            {APPROVAL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {APPROVAL_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="orders-fulfillment-filter">Entrega / Empaque</label>
          <select
            id="orders-fulfillment-filter"
            value={fulfillmentFilter}
            onChange={(e) => {
              setFulfillmentFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Todos</option>
            {FULFILLMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {FULFILLMENT_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="orders-type-filter">Tipo</label>
          <select
            id="orders-type-filter"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Todos</option>
            {ORDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {ORDER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </section>

      {ordersQuery.isLoading ? (
        <p role="status">Cargando pedidos...</p>
      ) : (
        <>
          <ResponsiveTable
            columns={columns}
            data={ordersQuery.data?.orders || []}
            rowKey={(o) => o.id}
            emptyMessage="No hay pedidos registrados con los filtros actuales."
            ariaLabel="Listado de pedidos"
          />
          <Pagination
            pagination={pagination}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
            itemLabel="pedidos"
          />
        </>
      )}
    </div>
  );
}

export default function PedidosPage() {
  return (
    <AppShell requiredPermission="orders.read">
      <PedidosContent />
    </AppShell>
  );
}
