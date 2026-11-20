'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatCurrency,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_RECORD_STATUS_LABELS,
  type ExcelDocumentType,
  type PaymentMethod,
} from '@arte-modelo/shared';
import {
  ArrowLeft,
  Ban,
  Banknote,
  CheckCircle2,
  FileSpreadsheet,
  PackageCheck,
  Pencil,
  RotateCcw,
  Truck,
  Upload,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell/AppShell';
import { Modal } from '@/components/Modal/Modal';
import { ConfirmModal } from '@/components/Modal/ConfirmModal';
import {
  ResponsiveTable,
  type TableColumn,
} from '@/components/ResponsiveTable/ResponsiveTable';
import {
  ApprovalBadge,
  FulfillmentBadge,
  OrderTypeBadge,
  PaymentBadge,
} from '@/components/Orders/OrderStatusBadges';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { compressImageFile } from '@/lib/image-compress';
import type { OrderDto, OrderItemDto, OrderPaymentDto } from '@/types/order';
import styles from './order-detail.module.scss';

function OrderDetailContent() {
  const params = useParams<{ id: string }>();
  const orderId = String(params?.id || '');
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const isStaff = user?.role !== 'CUSTOMER';
  const canConfirm = isStaff && hasPermission('orders.confirm');
  const canManage = isStaff && hasPermission('orders.manage');
  const canCancel = isStaff && hasPermission('orders.cancel');
  const canReadPayments = hasPermission('payments.read');
  const canManagePayments = isStaff && hasPermission('payments.manage');
  const canManageConsignments = isStaff && hasPermission('consignments.manage');

  // Confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Pack modal state (orderItemId -> quantityPacked string)
  const [packOpen, setPackOpen] = useState(false);
  const [packInputs, setPackInputs] = useState<Record<string, string>>({});
  const [packNotes, setPackNotes] = useState('');

  // Dispatch modal state (orderItemId -> quantityToDispatch string)
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchInputs, setDispatchInputs] = useState<Record<string, string>>({});
  const [dispatchCarrier, setDispatchCarrier] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Cancel modal state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Payment modal state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('TRANSFER');
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [payReference, setPayReference] = useState('');
  const [payReceiptUrl, setPayReceiptUrl] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Void payment modal state
  const [voidTarget, setVoidTarget] = useState<OrderPaymentDto | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Consignment return modal state
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnInputs, setReturnInputs] = useState<Record<string, string>>({});
  const [returnNotes, setReturnNotes] = useState('');

  // Excel downloading indicator
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ['order-detail', orderId],
    enabled: Boolean(orderId),
    queryFn: async () => {
      const res = await apiClient.get(`/orders/${orderId}`);
      return res.data.order as OrderDto;
    },
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['consignments'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/orders/${orderId}/confirm`, {});
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Pedido confirmado.', 'success');
      setConfirmOpen(false);
      invalidateAll();
    },
    onError: (err) => {
      showToast(
        getApiErrorMessage(err, 'No se pudo confirmar el pedido.'),
        'error',
      );
    },
  });

  const packMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(packInputs).map(([orderItemId, raw]) => ({
        orderItemId,
        quantityPacked: Math.max(0, Math.floor(Number(raw) || 0)),
      }));
      const res = await apiClient.post(`/orders/${orderId}/pack`, {
        items,
        notes: packNotes.trim() || null,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Empaque actualizado.', 'success');
      setPackOpen(false);
      setPackNotes('');
      invalidateAll();
    },
    onError: (err) => {
      showToast(
        getApiErrorMessage(err, 'No se pudo registrar el empaque.'),
        'error',
      );
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(dispatchInputs)
        .map(([orderItemId, raw]) => ({
          orderItemId,
          quantityToDispatch: Math.floor(Number(raw) || 0),
        }))
        .filter((i) => i.quantityToDispatch > 0);

      if (items.length === 0) {
        throw new Error('Indica al menos 1 unidad para despachar.');
      }

      const res = await apiClient.post(`/orders/${orderId}/dispatches`, {
        carrier: dispatchCarrier.trim() || null,
        notes: dispatchNotes.trim() || null,
        items,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Despacho registrado.', 'success');
      setDispatchOpen(false);
      setDispatchCarrier('');
      setDispatchNotes('');
      invalidateAll();
    },
    onError: (err) => {
      const msg =
        err instanceof Error && !(err as { isAxiosError?: boolean }).isAxiosError
          ? err.message
          : getApiErrorMessage(err, 'No se pudo registrar el despacho.');
      showToast(msg, 'error');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/orders/${orderId}/cancel`, {
        cancelReason,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Pedido cancelado.', 'success');
      setCancelOpen(false);
      setCancelReason('');
      invalidateAll();
    },
    onError: (err) => {
      showToast(
        getApiErrorMessage(err, 'No se pudo cancelar el pedido.'),
        'error',
      );
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = Number(payAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Ingresa un monto de abono válido mayor a cero.');
      }
      const res = await apiClient.post(`/orders/${orderId}/payments`, {
        amount: parsedAmount,
        method: payMethod,
        paymentDate: payDate,
        reference: payReference.trim() || null,
        receiptImageUrl: payReceiptUrl.trim() || null,
        notes: payNotes.trim() || null,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Abono registrado.', 'success');
      setPaymentOpen(false);
      setPayReference('');
      setPayReceiptUrl('');
      setPayNotes('');
      invalidateAll();
    },
    onError: (err) => {
      const msg =
        err instanceof Error && !(err as { isAxiosError?: boolean }).isAxiosError
          ? err.message
          : getApiErrorMessage(err, 'No se pudo registrar el abono.');
      showToast(msg, 'error');
    },
  });

  const voidPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!voidTarget) throw new Error('Selecciona un pago válido.');
      const res = await apiClient.post(
        `/orders/${orderId}/payments/${voidTarget.id}/void`,
        { voidReason },
      );
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Pago anulado.', 'success');
      setVoidTarget(null);
      setVoidReason('');
      invalidateAll();
    },
    onError: (err) => {
      const msg =
        err instanceof Error && !(err as { isAxiosError?: boolean }).isAxiosError
          ? err.message
          : getApiErrorMessage(err, 'No se pudo anular el abono.');
      showToast(msg, 'error');
    },
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(returnInputs)
        .map(([orderItemId, raw]) => ({
          orderItemId,
          quantityReturned: Math.floor(Number(raw) || 0),
        }))
        .filter((i) => i.quantityReturned > 0);

      if (items.length === 0) {
        throw new Error('Indica al menos 1 unidad para devolver.');
      }

      const res = await apiClient.post(
        `/orders/${orderId}/consignment-returns`,
        {
          notes: returnNotes.trim() || null,
          items,
        },
      );
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Devolución registrada.', 'success');
      setReturnOpen(false);
      setReturnNotes('');
      invalidateAll();
    },
    onError: (err) => {
      const msg =
        err instanceof Error && !(err as { isAxiosError?: boolean }).isAxiosError
          ? err.message
          : getApiErrorMessage(err, 'No se pudo registrar la devolución.');
      showToast(msg, 'error');
    },
  });

  const handleReceiptFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingReceipt(true);
      const compressed = await compressImageFile(file);
      const res = await apiClient.post('/uploads/payment-receipt', compressed);
      setPayReceiptUrl(res.data.url as string);
      showToast('Comprobante adjuntado correctamente.', 'success');
    } catch (err) {
      showToast(
        getApiErrorMessage(err, 'No se pudo subir la imagen del comprobante.'),
        'error',
      );
    } finally {
      setUploadingReceipt(false);
      e.target.value = '';
    }
  };

  if (orderQuery.isLoading) {
    return <p role="status">Cargando detalle del pedido...</p>;
  }

  const order = orderQuery.data;
  if (!order) {
    return (
      <div className={styles.page}>
        <section className={styles.card}>
          <h1>Pedido no encontrado</h1>
          <Link href="/pedidos" className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Volver a pedidos
          </Link>
        </section>
      </div>
    );
  }

  const handleDownloadExcel = async (
    docType: ExcelDocumentType,
    dispatchId?: string,
  ) => {
    const key = dispatchId ? `${docType}:${dispatchId}` : docType;
    try {
      setDownloadingDoc(key);
      const res = await apiClient.get(`/orders/${order.id}/excel`, {
        params: {
          type: docType,
          ...(dispatchId ? { dispatchId } : {}),
        },
        responseType: 'blob',
      });
      const prefix =
        docType === 'consignment'
          ? 'recibo-consignacion'
          : docType === 'delivery'
            ? 'nota-entrega'
            : 'factura';
      const blobUrl = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${prefix}-${order.orderNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      showToast(
        getApiErrorMessage(err, 'No se pudo generar el documento Excel.'),
        'error',
      );
    } finally {
      setDownloadingDoc(null);
    }
  };

  const openPackModal = () => {
    const initial: Record<string, string> = {};
    for (const item of order.items) {
      initial[item.id] = String(item.quantityPacked);
    }
    setPackInputs(initial);
    setPackNotes('');
    setPackOpen(true);
  };

  const openDispatchModal = () => {
    const initial: Record<string, string> = {};
    for (const item of order.items) {
      const ready = Math.max(0, item.quantityPacked - item.quantityDispatched);
      initial[item.id] = String(ready);
    }
    setDispatchInputs(initial);
    setDispatchCarrier('');
    setDispatchNotes('');
    setDispatchOpen(true);
  };

  const openPaymentModal = () => {
    setPayAmount(String(order.amountPending ?? 0));
    setPayMethod('TRANSFER');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayReference('');
    setPayReceiptUrl('');
    setPayNotes('');
    setPaymentOpen(true);
  };

  const openReturnModal = () => {
    const initial: Record<string, string> = {};
    for (const item of order.items) {
      initial[item.id] = '0';
    }
    setReturnInputs(initial);
    setReturnNotes('');
    setReturnOpen(true);
  };

  const hasReadyToDispatch = order.items.some(
    (item) => item.quantityPacked - item.quantityDispatched > 0,
  );
  const hasDispatchedAny = order.items.some((i) => i.quantityDispatched > 0);
  const hasReturnableUnits = order.items.some(
    (item) => item.quantityDispatched - (item.quantityReturned ?? 0) > 0,
  );

  const itemColumns: TableColumn<OrderItemDto>[] = [
    {
      key: 'product',
      header: 'Producto',
      render: (item) => (
        <div className={styles.itemCell}>
          <strong>{item.productName}</strong>
          <span>Código: {item.productPrimaryCode}</span>
        </div>
      ),
    },
    ...(order.pricesVisible
      ? [
          {
            key: 'price',
            header: 'Precio / Desc.',
            render: (item: OrderItemDto) => (
              <div className={`${styles.itemCell} ${styles.moneyCell}`}>
                <strong>
                  {formatCurrency(item.unitPrice ?? 0, order.currency)}
                </strong>
                {(item.discountAmount ?? 0) > 0 ? (
                  <span>
                    Desc.: -{' '}
                    {formatCurrency(item.discountAmount ?? 0, order.currency)}
                  </span>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
    {
      key: 'ordered',
      header: 'Pedido',
      render: (item) => <strong>{item.quantityOrdered} uds.</strong>,
    },
    {
      key: 'packed',
      header: 'Empacado',
      render: (item) => <span>{item.quantityPacked} uds.</span>,
    },
    {
      key: 'dispatched',
      header: order.type === 'CONSIGNMENT' ? 'Entregado / Dev.' : 'Despachado',
      render: (item) => (
        <span>
          {item.quantityDispatched} uds.
          {order.type === 'CONSIGNMENT' && (item.quantityReturned ?? 0) > 0
            ? ` (Dev: ${item.quantityReturned})`
            : ''}
        </span>
      ),
    },
    {
      key: 'pending',
      header: 'Pendiente',
      render: (item) => (
        <strong
          className={
            item.quantityPendingDispatch > 0 ? styles.pendingQty : styles.doneQty
          }
        >
          {item.quantityPendingDispatch} uds.
        </strong>
      ),
    },
    ...(order.pricesVisible
      ? [
          {
            key: 'lineTotal',
            header: 'Subtotal',
            render: (item: OrderItemDto) => (
              <strong className={styles.moneyCell}>
                {formatCurrency(item.lineTotal ?? 0, order.currency)}
              </strong>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h1>{order.orderNumber}</h1>
            <OrderTypeBadge type={order.type} />
          </div>
          <div className={styles.badgesRow}>
            <ApprovalBadge status={order.approvalStatus} />
            <FulfillmentBadge status={order.fulfillmentStatus} />
            <PaymentBadge status={order.paymentStatus} />
          </div>
        </div>

        <div className={styles.headerActions}>
          <Link href="/pedidos" className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Volver
          </Link>

          {order.approvalStatus !== 'CANCELLED' ? (
            <div className={styles.excelActionsGroup}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={downloadingDoc === 'invoice'}
                onClick={() => void handleDownloadExcel('invoice')}
              >
                <FileSpreadsheet size={16} />{' '}
                {downloadingDoc === 'invoice' ? 'Generando...' : 'Factura .xlsx'}
              </button>

              {order.type === 'CONSIGNMENT' ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={downloadingDoc === 'consignment'}
                  onClick={() => void handleDownloadExcel('consignment')}
                >
                  <FileSpreadsheet size={16} />{' '}
                  {downloadingDoc === 'consignment'
                    ? 'Generando...'
                    : 'Recibo Consignación .xlsx'}
                </button>
              ) : null}

              {order.approvalStatus === 'CONFIRMED' ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={downloadingDoc === 'delivery'}
                  onClick={() => void handleDownloadExcel('delivery')}
                >
                  <FileSpreadsheet size={16} />{' '}
                  {downloadingDoc === 'delivery'
                    ? 'Generando...'
                    : 'Nota de Entrega .xlsx'}
                </button>
              ) : null}
            </div>
          ) : null}

          {canConfirm && order.approvalStatus === 'PENDING_CONFIRMATION' ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 size={16} /> Confirmar pedido
            </button>
          ) : null}

          {canManage && order.approvalStatus !== 'CANCELLED' ? (
            <Link
              href={`/pedidos/${order.id}/editar`}
              className={styles.secondaryBtn}
            >
              <Pencil size={16} /> Editar
            </Link>
          ) : null}

          {canManage && order.approvalStatus === 'CONFIRMED' ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={openPackModal}
            >
              <PackageCheck size={16} /> Empacar
            </button>
          ) : null}

          {canManage &&
          order.approvalStatus === 'CONFIRMED' &&
          hasReadyToDispatch ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={openDispatchModal}
            >
              <Truck size={16} /> Despachar
            </button>
          ) : null}

          {canCancel &&
          order.approvalStatus !== 'CANCELLED' &&
          !hasDispatchedAny ? (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => setCancelOpen(true)}
            >
              <Ban size={16} /> Cancelar pedido
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.infoCardsGrid}>
        <section className={styles.card} aria-label="Datos del cliente">
          <h2>Datos del Cliente</h2>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>Empresa</span>
              <strong>{order.customer.companyName}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Encargado</span>
              <strong>{order.customer.managerName}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>País y Moneda</span>
              <strong>
                {order.customer.countryLabel} ({order.currency})
              </strong>
            </div>
            <div className={styles.metaItem}>
              <span>Teléfono</span>
              <strong>{order.customer.phone}</strong>
            </div>
            <div className={styles.metaItem} style={{ gridColumn: '1 / -1' }}>
              <span>Dirección</span>
              <strong>{order.customer.address}</strong>
            </div>
            {order.consignmentDueDate ? (
              <div className={styles.metaItem}>
                <span>Fecha sugerida revisión</span>
                <strong>
                  {new Date(order.consignmentDueDate).toLocaleDateString('es-GT')}
                </strong>
              </div>
            ) : null}
            {order.notes ? (
              <div className={styles.metaItem} style={{ gridColumn: '1 / -1' }}>
                <span>Notas</span>
                <strong>{order.notes}</strong>
              </div>
            ) : null}
            {order.approvalStatus === 'CANCELLED' && order.cancelReason ? (
              <div className={styles.cancelBox} style={{ gridColumn: '1 / -1' }}>
                <strong>Motivo de cancelación:</strong> {order.cancelReason}
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.card} aria-label="Resumen financiero">
          <h2>Resumen Financiero</h2>
          {!order.pricesVisible ? (
            <div className={styles.maskedNotice}>
              Los precios y montos finales de este pedido estarán disponibles en
              cuanto un asesor de Arte Modelo Dubois lo confirme.
            </div>
          ) : (
            <div className={styles.financeRows}>
              <div className={styles.financeRow}>
                <span>Subtotal bruto</span>
                <strong>
                  {formatCurrency(order.subtotal ?? 0, order.currency)}
                </strong>
              </div>
              <div className={styles.financeRow}>
                <span>Descuentos en ítems</span>
                <strong>
                  -{' '}
                  {formatCurrency(order.itemsDiscountTotal ?? 0, order.currency)}
                </strong>
              </div>
              <div className={styles.financeRow}>
                <span>Flete neto</span>
                <strong>
                  {formatCurrency(
                    (order.shippingCost ?? 0) - (order.shippingDiscount ?? 0),
                    order.currency,
                  )}
                </strong>
              </div>
              {(order.returnedTotal ?? 0) > 0 ? (
                <div className={styles.financeRow}>
                  <span>Devoluciones consignación</span>
                  <strong>
                    -{' '}
                    {formatCurrency(order.returnedTotal ?? 0, order.currency)}
                  </strong>
                </div>
              ) : null}
              <div className={`${styles.financeRow} ${styles.financeGrand}`}>
                <span>Total del Pedido</span>
                <strong>
                  {formatCurrency(order.totalAmount ?? 0, order.currency)}
                </strong>
              </div>
              <div className={styles.financeRow}>
                <span>Abonado</span>
                <strong>
                  {formatCurrency(order.amountPaid ?? 0, order.currency)}
                </strong>
              </div>
              <div className={styles.financeRow}>
                <span>Saldo pendiente</span>
                <strong>
                  {formatCurrency(order.amountPending ?? 0, order.currency)}
                </strong>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className={styles.card} aria-label="Detalle de productos">
        <h2>Productos del Pedido</h2>
        <ResponsiveTable
          columns={itemColumns}
          data={order.items}
          rowKey={(i) => i.id}
          ariaLabel="Ítems del pedido"
        />
      </section>

      {canReadPayments && order.pricesVisible ? (
        <section className={styles.card} aria-label="Pagos y abonos">
          <div className={styles.sectionTop}>
            <h2>Pagos y Abonos</h2>
            {canManagePayments &&
            order.approvalStatus === 'CONFIRMED' &&
            (order.amountPending ?? 0) > 0 ? (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={openPaymentModal}
              >
                <Banknote size={16} /> Registrar abono
              </button>
            ) : null}
          </div>

          {(order.payments || []).length === 0 ? (
            <p className={styles.emptyText}>
              Aún no se han registrado pagos o abonos para este pedido.
            </p>
          ) : (
            <div className={styles.dispatchList}>
              {(order.payments || []).map((payment) => (
                <article key={payment.id} className={styles.dispatchCard}>
                  <div className={styles.dispatchHead}>
                    <div className={styles.paymentMetaRow}>
                      <strong className={styles.moneyCell}>
                        {formatCurrency(payment.amount ?? 0, order.currency)}
                      </strong>
                      <span>· {PAYMENT_METHOD_LABELS[payment.method]}</span>
                      <span
                        className={
                          payment.status === 'VOIDED'
                            ? styles.statusChipVoided
                            : styles.statusChipActive
                        }
                      >
                        {PAYMENT_RECORD_STATUS_LABELS[payment.status]}
                      </span>
                    </div>

                    <div className={styles.paymentMetaRow}>
                      <span>
                        Fecha:{' '}
                        {new Date(payment.paymentDate).toLocaleDateString('es-GT')}
                        {payment.reference ? ` · Ref: ${payment.reference}` : ''}
                        {payment.registeredBy
                          ? ` · Por: ${payment.registeredBy.fullName}`
                          : ''}
                      </span>

                      {canManagePayments && payment.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          className={styles.voidBtn}
                          onClick={() => {
                            setVoidTarget(payment);
                            setVoidReason('');
                          }}
                        >
                          Anular abono
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {payment.notes ? (
                    <p className={styles.dispatchNotes}>{payment.notes}</p>
                  ) : null}

                  {payment.receiptImageUrl ? (
                    <div>
                      <a
                        href={payment.receiptImageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={payment.receiptImageUrl}
                          alt={`Comprobante ${payment.reference || payment.id}`}
                          className={styles.receiptThumb}
                        />
                      </a>
                    </div>
                  ) : null}

                  {payment.status === 'VOIDED' && payment.voidReason ? (
                    <p className={styles.voidNotice}>
                      Anulado: {payment.voidReason}
                      {payment.voidedBy
                        ? ` (${payment.voidedBy.fullName})`
                        : ''}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {order.type === 'CONSIGNMENT' ? (
        <section
          className={styles.card}
          aria-label="Devoluciones de consignación"
        >
          <div className={styles.sectionTop}>
            <h2>Control de Consignación y Devoluciones</h2>
            {canManageConsignments &&
            order.approvalStatus === 'CONFIRMED' &&
            hasReturnableUnits ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={openReturnModal}
              >
                <RotateCcw size={16} /> Registrar devolución
              </button>
            ) : null}
          </div>

          {(order.consignmentReturns || []).length === 0 ? (
            <p className={styles.emptyText}>
              No se han registrado devoluciones de mercadería no vendida para
              esta consignación.
            </p>
          ) : (
            <div className={styles.dispatchList}>
              {(order.consignmentReturns || []).map((ret) => (
                <article key={ret.id} className={styles.dispatchCard}>
                  <div className={styles.dispatchHead}>
                    <strong>Devolución #{ret.returnNumber}</strong>
                    <span>
                      {new Date(ret.returnedAt).toLocaleString('es-GT')}
                      {ret.receivedBy
                        ? ` · Recibió: ${ret.receivedBy.fullName}`
                        : ''}
                      {ret.totalCredit !== null
                        ? ` · Crédito: ${formatCurrency(ret.totalCredit, order.currency)}`
                        : ''}
                    </span>
                  </div>
                  {ret.notes ? (
                    <p className={styles.dispatchNotes}>{ret.notes}</p>
                  ) : null}
                  <div className={styles.dispatchItemsGrid}>
                    {ret.items.map((ri) => (
                      <div key={ri.id} className={styles.dispatchItemRow}>
                        <span>
                          <strong>{ri.orderItem.productName}</strong> (
                          {ri.orderItem.productPrimaryCode})
                        </span>
                        <span>
                          Devuelto: <strong>{ri.quantityReturned} uds.</strong>
                          {ri.lineCredit !== null ? (
                            <>
                              {' '}
                              · Crédito:{' '}
                              <strong className={styles.moneyCell}>
                                {formatCurrency(ri.lineCredit, order.currency)}
                              </strong>
                            </>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className={styles.card} aria-label="Historial de despachos">
        <h2>Historial de Entregas y Despachos</h2>
        {(order.dispatches || []).length === 0 ? (
          <p className={styles.emptyText}>
            Aún no se han registrado despachos para este pedido.
          </p>
        ) : (
          <div className={styles.dispatchList}>
            {(order.dispatches || []).map((disp) => (
              <article key={disp.id} className={styles.dispatchCard}>
                <div className={styles.dispatchHead}>
                  <strong>Despacho #{disp.dispatchNumber}</strong>
                  <div className={styles.paymentMetaRow}>
                    <span>
                      {new Date(disp.dispatchedAt).toLocaleString('es-GT')}
                      {disp.carrier ? ` · ${disp.carrier}` : ''}
                      {disp.dispatchedBy
                        ? ` · Por: ${disp.dispatchedBy.fullName}`
                        : ''}
                    </span>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={downloadingDoc === `delivery:${disp.id}`}
                      onClick={() =>
                        void handleDownloadExcel('delivery', disp.id)
                      }
                    >
                      <FileSpreadsheet size={14} /> Nota #{disp.dispatchNumber}{' '}
                      .xlsx
                    </button>
                  </div>
                </div>
                {disp.notes ? (
                  <p className={styles.dispatchNotes}>{disp.notes}</p>
                ) : null}
                <div className={styles.dispatchItemsGrid}>
                  {disp.items.map((di) => (
                    <div key={di.id} className={styles.dispatchItemRow}>
                      <span>
                        <strong>{di.orderItem.productName}</strong> (
                        {di.orderItem.productPrimaryCode})
                      </span>
                      <span>
                        Entregado: <strong>{di.quantityDispatched}</strong> ·
                        Acumulado: {di.cumulativeDispatched}/
                        {di.orderItem.quantityOrdered} · Pendiente:{' '}
                        <strong>{di.remainingPending}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={confirmOpen}
        title="Confirmar pedido de cliente"
        message={`¿Confirmas el pedido ${order.orderNumber} para habilitar empaque y despacho?`}
        confirmLabel="Confirmar pedido"
        isSubmitting={confirmMutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => confirmMutation.mutate()}
      />

      <Modal
        isOpen={packOpen}
        title="Empacar mercadería por delta"
        onClose={() => setPackOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPackOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pack-order-form"
              className={styles.primaryBtn}
              disabled={packMutation.isPending}
            >
              {packMutation.isPending ? 'Guardando...' : 'Guardar empaque'}
            </button>
          </>
        }
      >
        <form
          id="pack-order-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            packMutation.mutate();
          }}
        >
          <p className={styles.modalHelp}>
            El inventario se ajusta únicamente por la diferencia (delta) respecto
            a lo ya empacado.
          </p>
          {order.items.map((item) => {
            const target = Math.max(
              0,
              Math.floor(Number(packInputs[item.id] ?? item.quantityPacked) || 0),
            );
            const delta = target - item.quantityPacked;
            return (
              <div key={item.id} className={styles.modalItemCard}>
                <div className={styles.modalItemTop}>
                  <strong>{item.productName}</strong>
                  <span>
                    Pedido: {item.quantityOrdered} · Despachado:{' '}
                    {item.quantityDispatched} · Stock actual:{' '}
                    {item.currentStock ?? 0}
                  </span>
                </div>
                <div className={styles.modalItemControls}>
                  <div className={styles.field}>
                    <label htmlFor={`pack-${item.id}`}>Total empacado</label>
                    <input
                      id={`pack-${item.id}`}
                      type="number"
                      min={item.quantityDispatched}
                      max={item.quantityOrdered}
                      required
                      value={packInputs[item.id] ?? String(item.quantityPacked)}
                      onChange={(e) =>
                        setPackInputs((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <span className={styles.deltaBadge}>
                    {delta > 0
                      ? `Delta: -${delta} de stock`
                      : delta < 0
                        ? `Delta: +${Math.abs(delta)} a stock`
                        : 'Sin variación'}
                  </span>
                </div>
              </div>
            );
          })}
          <div className={styles.field}>
            <label htmlFor="pack-notes">Nota de empaque (opcional)</label>
            <input
              id="pack-notes"
              type="text"
              placeholder="Ej. Caja 1 y 2 listas en bodega"
              value={packNotes}
              onChange={(e) => setPackNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={dispatchOpen}
        title="Registrar despacho parcial o total"
        onClose={() => setDispatchOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setDispatchOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="dispatch-order-form"
              className={styles.primaryBtn}
              disabled={dispatchMutation.isPending}
            >
              {dispatchMutation.isPending
                ? 'Registrando...'
                : 'Registrar despacho'}
            </button>
          </>
        }
      >
        <form
          id="dispatch-order-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            dispatchMutation.mutate();
          }}
        >
          {order.items
            .filter((item) => item.quantityPacked - item.quantityDispatched > 0)
            .map((item) => {
              const maxDispatch =
                item.quantityPacked - item.quantityDispatched;
              return (
                <div key={item.id} className={styles.modalItemCard}>
                  <div className={styles.modalItemTop}>
                    <strong>{item.productName}</strong>
                    <span>
                      Listo para despachar: {maxDispatch} uds. (Pedido:{' '}
                      {item.quantityOrdered}, Ya despachado:{' '}
                      {item.quantityDispatched})
                    </span>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor={`disp-${item.id}`}>
                      Cantidad a despachar ahora
                    </label>
                    <input
                      id={`disp-${item.id}`}
                      type="number"
                      min={0}
                      max={maxDispatch}
                      required
                      value={dispatchInputs[item.id] ?? '0'}
                      onChange={(e) =>
                        setDispatchInputs((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          <div className={styles.field}>
            <label htmlFor="dispatch-carrier">Transporte / Mensajero</label>
            <input
              id="dispatch-carrier"
              type="text"
              placeholder="Ej. Guatex, Cargo Expreso, Transporte propio..."
              value={dispatchCarrier}
              onChange={(e) => setDispatchCarrier(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="dispatch-notes">Notas del despacho</label>
            <textarea
              id="dispatch-notes"
              rows={2}
              placeholder="Guía de envío u observaciones"
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={paymentOpen}
        title="Registrar abono o pago"
        onClose={() => setPaymentOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPaymentOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="register-payment-form"
              className={styles.primaryBtn}
              disabled={paymentMutation.isPending || uploadingReceipt}
            >
              {paymentMutation.isPending ? 'Guardando...' : 'Guardar abono'}
            </button>
          </>
        }
      >
        <form
          id="register-payment-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            paymentMutation.mutate();
          }}
        >
          <p className={styles.modalHelp}>
            Saldo pendiente actual:{' '}
            <strong>
              {formatCurrency(order.amountPending ?? 0, order.currency)}
            </strong>
          </p>

          <div className={styles.field}>
            <label htmlFor="pay-amount">Monto del abono ({order.currency})</label>
            <input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={order.amountPending ?? undefined}
              required
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="pay-method">Método de pago</label>
            <select
              id="pay-method"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="pay-date">Fecha real del pago</label>
            <input
              id="pay-date"
              type="date"
              required
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="pay-reference">
              Número de boleta / transferencia / cheque
            </label>
            <input
              id="pay-reference"
              type="text"
              placeholder="Ej. BOL-784512 o CHQ-104"
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="pay-receipt-file">
              Foto de comprobante (opcional)
            </label>
            <div className={styles.uploadRow}>
              <label htmlFor="pay-receipt-file" className={styles.secondaryBtn}>
                <Upload size={15} />{' '}
                {uploadingReceipt ? 'Subiendo...' : 'Subir imagen'}
              </label>
              <input
                id="pay-receipt-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void handleReceiptFileChange(e)}
                style={{ display: 'none' }}
              />
              {payReceiptUrl ? (
                <img
                  src={payReceiptUrl}
                  alt="Vista previa comprobante"
                  className={styles.receiptThumb}
                />
              ) : null}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="pay-notes">Notas del pago (opcional)</label>
            <textarea
              id="pay-notes"
              rows={2}
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(voidTarget)}
        title="Anular abono registrado"
        onClose={() => setVoidTarget(null)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setVoidTarget(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="void-payment-form"
              className={styles.dangerBtn}
              disabled={voidPaymentMutation.isPending}
            >
              {voidPaymentMutation.isPending
                ? 'Anulando...'
                : 'Confirmar anulación'}
            </button>
          </>
        }
      >
        <form
          id="void-payment-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            voidPaymentMutation.mutate();
          }}
        >
          <p className={styles.modalHelp}>
            El pago quedará marcado como <strong>Anulado</strong> conservando la
            auditoría y se recalculará el saldo pendiente del pedido.
          </p>
          <div className={styles.field}>
            <label htmlFor="void-reason">Motivo de anulación</label>
            <textarea
              id="void-reason"
              required
              minLength={3}
              rows={3}
              placeholder="Ej. Monto duplicado o boleta rechazada..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={returnOpen}
        title="Registrar devolución de consignación"
        onClose={() => setReturnOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setReturnOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="consignment-return-form"
              className={styles.primaryBtn}
              disabled={returnMutation.isPending}
            >
              {returnMutation.isPending
                ? 'Registrando...'
                : 'Registrar devolución'}
            </button>
          </>
        }
      >
        <form
          id="consignment-return-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            returnMutation.mutate();
          }}
        >
          <p className={styles.modalHelp}>
            Las unidades devueltas reingresarán automáticamente al stock mediante
            Kardex y reducirán el saldo pendiente de esta consignación.
          </p>
          {order.items
            .filter(
              (item) =>
                item.quantityDispatched - (item.quantityReturned ?? 0) > 0,
            )
            .map((item) => {
              const maxReturn =
                item.quantityDispatched - (item.quantityReturned ?? 0);
              const qty = Math.max(
                0,
                Math.floor(Number(returnInputs[item.id] ?? 0) || 0),
              );
              return (
                <div key={item.id} className={styles.modalItemCard}>
                  <div className={styles.modalItemTop}>
                    <strong>{item.productName}</strong>
                    <span>
                      Entregadas en tienda: {item.quantityDispatched} · Ya
                      devueltas: {item.quantityReturned ?? 0} · Disponibles para
                      devolver: {maxReturn}
                    </span>
                  </div>
                  <div className={styles.modalItemControls}>
                    <div className={styles.field}>
                      <label htmlFor={`ret-${item.id}`}>
                        Cantidad a devolver
                      </label>
                      <input
                        id={`ret-${item.id}`}
                        type="number"
                        min={0}
                        max={maxReturn}
                        required
                        value={returnInputs[item.id] ?? '0'}
                        onChange={(e) =>
                          setReturnInputs((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <span className={styles.deltaBadge}>
                      {qty > 0 ? `+${qty} a stock` : 'Sin devolución'}
                    </span>
                  </div>
                </div>
              );
            })}

          <div className={styles.field}>
            <label htmlFor="return-notes">Notas de recepción (opcional)</label>
            <textarea
              id="return-notes"
              rows={2}
              placeholder="Ej. Producto devuelto en buen estado"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={cancelOpen}
        title="Cancelar pedido (borrado lógico)"
        onClose={() => setCancelOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setCancelOpen(false)}
            >
              Volver
            </button>
            <button
              type="submit"
              form="cancel-order-form"
              className={styles.dangerBtn}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending
                ? 'Cancelando...'
                : 'Confirmar cancelación'}
            </button>
          </>
        }
      >
        <form
          id="cancel-order-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            cancelMutation.mutate();
          }}
        >
          <p className={styles.modalHelp}>
            Si hay unidades empacadas sin despachar, regresarán automáticamente
            al stock mediante Kardex.
          </p>
          <div className={styles.field}>
            <label htmlFor="cancel-reason">Motivo de cancelación</label>
            <textarea
              id="cancel-reason"
              required
              minLength={3}
              rows={3}
              placeholder="Describe el motivo para conservar la trazabilidad..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <AppShell requiredPermission="orders.read">
      <OrderDetailContent />
    </AppShell>
  );
}
