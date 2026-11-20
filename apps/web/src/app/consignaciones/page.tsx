'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  COUNTRIES,
  COUNTRY_LABELS,
  DEFAULT_PAGE_SIZE,
  formatCurrency,
  SEARCH_DEBOUNCE_MS,
} from '@arte-modelo/shared';
import { Eye, FileSpreadsheet, Plus } from 'lucide-react';
import { AppShell } from '@/components/AppShell/AppShell';
import { Pagination } from '@/components/Pagination/Pagination';
import {
  ResponsiveTable,
  type TableColumn,
} from '@/components/ResponsiveTable/ResponsiveTable';
import { SearchingIndicator } from '@/components/SearchingIndicator/SearchingIndicator';
import {
  FulfillmentBadge,
  PaymentBadge,
} from '@/components/Orders/OrderStatusBadges';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type {
  ConsignmentCustomerSummaryDto,
  ConsignmentsOverviewResponse,
  OrderDto,
} from '@/types/order';
import styles from './consignaciones.module.scss';

function ConsignacionesContent() {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const isStaff = user?.role !== 'CUSTOMER';
  const canCreate = hasPermission('orders.create');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const consignmentsQuery = useQuery({
    queryKey: [
      'consignments',
      debouncedSearch,
      countryFilter,
      statusFilter,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (countryFilter !== 'ALL') params.country = countryFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await apiClient.get('/orders/consignments', { params });
      return res.data as ConsignmentsOverviewResponse;
    },
  });

  const handleDownloadConsignmentExcel = async (order: OrderDto) => {
    try {
      setDownloadingId(order.id);
      const res = await apiClient.get(`/orders/${order.id}/excel`, {
        params: { type: 'consignment' },
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `recibo-consignacion-${order.orderNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast(
        getApiErrorMessage(err, 'No se pudo descargar el recibo en Excel.'),
        'error',
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const summaryColumns: TableColumn<ConsignmentCustomerSummaryDto>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      render: (row) => (
        <div className={styles.cellStack}>
          {isStaff ? (
            <Link
              href={`/clientes/${row.customerId}`}
              className={styles.orderLink}
            >
              {row.companyName}
            </Link>
          ) : (
            <strong>{row.companyName}</strong>
          )}
          <span>
            {row.countryLabel} · {row.ordersCount} consignación(es)
          </span>
        </div>
      ),
    },
    {
      key: 'units',
      header: 'Mercadería (Entr. / Dev. / En Tienda)',
      render: (row) => (
        <div className={styles.cellStack}>
          <strong>{row.unitsNetInStore} uds. en tienda</strong>
          <span>
            Entregadas: {row.unitsDispatched} · Devueltas: {row.unitsReturned}
          </span>
        </div>
      ),
    },
    {
      key: 'returned',
      header: 'Crédito Dev.',
      render: (row) => (
        <span className={styles.moneyValue}>
          {formatCurrency(row.returnedCredit, row.currency)}
        </span>
      ),
    },
    {
      key: 'paid',
      header: 'Abonado',
      render: (row) => (
        <span className={styles.moneyValue}>
          {formatCurrency(row.amountPaid, row.currency)}
        </span>
      ),
    },
    {
      key: 'pending',
      header: 'Saldo Pendiente',
      render: (row) => (
        <span className={styles.moneyValue}>
          {formatCurrency(row.amountPending, row.currency)}
        </span>
      ),
    },
    {
      key: 'due',
      header: 'Próx. Revisión',
      render: (row) =>
        row.nearestDueDate
          ? new Date(row.nearestDueDate).toLocaleDateString('es-GT')
          : 'Sin fecha',
    },
  ];

  const orderColumns: TableColumn<OrderDto>[] = [
    {
      key: 'orderNumber',
      header: 'Consignación',
      render: (order) => (
        <div className={styles.cellStack}>
          <Link href={`/pedidos/${order.id}`} className={styles.orderLink}>
            {order.orderNumber}
          </Link>
          <span>{order.customer.companyName}</span>
        </div>
      ),
    },
    {
      key: 'dueDate',
      header: 'Revisión',
      render: (order) => {
        if (!order.consignmentDueDate) return <span>Sin fecha</span>;
        const due = new Date(order.consignmentDueDate);
        const isOverdue =
          due.getTime() < Date.now() && (order.amountPending ?? 0) > 0;
        return (
          <div className={styles.cellStack}>
            <span>{due.toLocaleDateString('es-GT')}</span>
            {isOverdue ? (
              <span className={styles.overdueBadge}>Vencida</span>
            ) : (
              <span className={styles.okBadge}>Vigente</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'statuses',
      header: 'Entrega / Pago',
      render: (order) => (
        <div className={styles.cellStack}>
          <FulfillmentBadge status={order.fulfillmentStatus} />
          <PaymentBadge status={order.paymentStatus} />
        </div>
      ),
    },
    {
      key: 'totals',
      header: 'Neto / Devuelto / Saldo',
      render: (order) => (
        <div className={styles.cellStack}>
          <span className={styles.moneyValue}>
            Neto: {formatCurrency(order.totalAmount ?? 0, order.currency)}
          </span>
          {(order.returnedTotal ?? 0) > 0 ? (
            <span>
              Devuelto:{' '}
              {formatCurrency(order.returnedTotal ?? 0, order.currency)}
            </span>
          ) : null}
          <span className={styles.moneyValue}>
            Pendiente:{' '}
            {formatCurrency(order.amountPending ?? 0, order.currency)}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (order) => (
        <div className={styles.rowActions}>
          <Link href={`/pedidos/${order.id}`} className={styles.secondaryBtn}>
            <Eye size={15} /> Detalle
          </Link>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={downloadingId === order.id}
            onClick={() => void handleDownloadConsignmentExcel(order)}
          >
            <FileSpreadsheet size={15} />{' '}
            {downloadingId === order.id ? 'Generando...' : 'Recibo .xlsx'}
          </button>
        </div>
      ),
    },
  ];

  const byCustomer = consignmentsQuery.data?.byCustomer ?? [];
  const orders = consignmentsQuery.data?.orders ?? [];
  const pagination = consignmentsQuery.data?.pagination ?? {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  };
  const isWaitingDebounce = search.trim() !== debouncedSearch.trim();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Control de Consignaciones</h1>
          <p className={styles.subtitle}>
            Seguimiento automatizado por cliente: mercadería entregada,
            devoluciones a inventario, saldo en tienda y fecha de revisión.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/pedidos" className={styles.secondaryBtn}>
            Ver todos los pedidos
          </Link>
          {canCreate && isStaff ? (
            <Link href="/pedidos/nuevo" className={styles.primaryBtn}>
              <Plus size={16} /> Nuevo pedido
            </Link>
          ) : null}
        </div>
      </div>

      <section
        className={styles.filtersCard}
        aria-label="Filtros de consignaciones"
      >
        <div className={styles.field}>
          <label htmlFor="consign-search">Buscar consignación</label>
          <input
            id="consign-search"
            type="search"
            placeholder="Número PED-..., empresa, NIT o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isWaitingDebounce ||
          (consignmentsQuery.isFetching && debouncedSearch.trim().length > 0) ? (
            <SearchingIndicator compact />
          ) : null}
        </div>

        {isStaff ? (
          <div className={styles.field}>
            <label htmlFor="consign-country">País</label>
            <select
              id="consign-country"
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Todos</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="consign-status">Estado de revisión</label>
          <select
            id="consign-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Todas</option>
            <option value="UPCOMING">Próximas (≤ 30 días)</option>
            <option value="OVERDUE">Vencidas con saldo</option>
          </select>
        </div>
      </section>

      <section className={styles.card} aria-label="Consolidado por cliente">
        <h2>Consolidado de Mercadería en Consignación por Cliente</h2>
        <ResponsiveTable
          columns={summaryColumns}
          data={byCustomer}
          rowKey={(r) => r.customerId}
          emptyMessage="No hay mercadería en consignación activa con los filtros actuales."
          ariaLabel="Resumen de consignaciones por cliente"
        />
      </section>

      <section className={styles.card} aria-label="Pedidos en consignación">
        <h2>Detalle de Pedidos en Consignación</h2>
        {consignmentsQuery.isLoading ? (
          <p role="status">Cargando consignaciones...</p>
        ) : (
          <>
            <ResponsiveTable
              columns={orderColumns}
              data={orders}
              rowKey={(o) => o.id}
              emptyMessage="No se encontraron consignaciones activas."
              ariaLabel="Listado de pedidos en consignación"
            />
            <Pagination
              pagination={pagination}
              pageSize={pageSize}
              onPageChange={(nextPage) => setPage(nextPage)}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}

export default function ConsignacionesPage() {
  return (
    <AppShell requiredPermission="orders.read">
      <ConsignacionesContent />
    </AppShell>
  );
}
