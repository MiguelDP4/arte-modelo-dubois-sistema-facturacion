'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calculateOrderLine,
  calculateOrderTotals,
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_LABELS,
  formatCurrency,
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  type Currency,
  type DiscountType,
  type OrderType,
} from '@arte-modelo/shared';
import { ArrowLeft, Info, Percent, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { CustomerDto } from '@/types/customer';
import type { LastPriceResponse, OrderDto } from '@/types/order';
import {
  CustomerSearchSelect,
  type SelectedCustomerOption,
} from './CustomerSearchSelect';
import {
  ProductSearchSelect,
  type SelectedProductOption,
} from './ProductSearchSelect';
import styles from './OrderForm.module.scss';

interface DraftLine {
  key: string;
  productId: string;
  selectedProduct: SelectedProductOption | null;
  quantityOrdered: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  showDiscount: boolean;
  minPacked: number;
  priceEditedManually: boolean;
}

interface OrderFormProps {
  mode: 'create' | 'edit';
  initialOrder?: OrderDto;
  initialCustomerId?: string;
}

function getOptionCurrencyPrice(
  product: SelectedProductOption | null,
  currency: Currency,
): number {
  if (!product) return 0;
  switch (currency) {
    case 'GTQ':
      return product.priceGTQ ?? 0;
    case 'HNL':
      return product.priceHNL ?? 0;
    case 'NIO':
      return product.priceNIO ?? 0;
    case 'USD':
      return product.priceUSD ?? 0;
  }
}

function createEmptyLine(index: number): DraftLine {
  return {
    key: `line-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    productId: '',
    selectedProduct: null,
    quantityOrdered: '1',
    unitPrice: '0',
    discountType: 'FIXED',
    discountValue: '0',
    showDiscount: false,
    minPacked: 0,
    priceEditedManually: false,
  };
}

export function OrderForm({
  mode,
  initialOrder,
  initialCustomerId,
}: OrderFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const isCustomerUser = user?.role === 'CUSTOMER';

  const [customerId, setCustomerId] = useState(
    initialOrder?.customerId ?? initialCustomerId ?? '',
  );
  const [orderType, setOrderType] = useState<OrderType>(
    initialOrder?.type ?? 'REGULAR',
  );
  const [consignmentDueDate, setConsignmentDueDate] = useState(
    initialOrder?.consignmentDueDate
      ? initialOrder.consignmentDueDate.slice(0, 10)
      : '',
  );
  const [shippingCost, setShippingCost] = useState(
    initialOrder ? String(initialOrder.shippingCost ?? 0) : '0',
  );
  const [shippingDiscount, setShippingDiscount] = useState(
    initialOrder ? String(initialOrder.shippingDiscount ?? 0) : '0',
  );
  const [notes, setNotes] = useState(initialOrder?.notes ?? '');
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (initialOrder && initialOrder.items.length > 0) {
      return initialOrder.items.map((item, idx) => ({
        key: `init-${item.id || idx}`,
        productId: item.productId,
        selectedProduct: {
          id: item.productId,
          name: item.productName,
          primaryCode: item.productPrimaryCode,
          imageUrl: item.productImageUrl ?? null,
          stock: item.currentStock ?? undefined,
        },
        quantityOrdered: String(item.quantityOrdered),
        unitPrice: String(item.unitPrice ?? 0),
        discountType: item.discountType,
        discountValue: String(item.discountValue ?? 0),
        showDiscount: (item.discountValue ?? 0) > 0,
        minPacked: item.quantityPacked,
        priceEditedManually: true,
      }));
    }
    return [createEmptyLine(0)];
  });

  const [activeTooltipKey, setActiveTooltipKey] = useState<string | null>(null);
  const [lastPriceMap, setLastPriceMap] = useState<
    Record<string, LastPriceResponse>
  >({});

  const [selectedCustomerState, setSelectedCustomerState] =
    useState<SelectedCustomerOption | null>(() =>
      initialOrder
        ? {
            id: initialOrder.customer.id,
            companyName: initialOrder.customer.companyName,
            managerName: initialOrder.customer.managerName,
            countryLabel: initialOrder.customer.countryLabel,
            currency: initialOrder.customer.currency,
            taxId: initialOrder.customer.taxId,
          }
        : null,
    );

  const initialCustomerQuery = useQuery({
    queryKey: ['orders-form-initial-customer', initialCustomerId],
    enabled:
      mode === 'create' &&
      !isCustomerUser &&
      Boolean(initialCustomerId) &&
      !selectedCustomerState,
    queryFn: async () => {
      const res = await apiClient.get(`/customers/${initialCustomerId}`);
      const c = (res.data.customer || res.data) as CustomerDto;
      return {
        id: c.id,
        companyName: c.companyName,
        managerName: c.managerName,
        countryLabel: c.countryLabel,
        currency: c.currency,
        taxLabel: c.taxLabel,
        taxId: c.taxId,
      } satisfies SelectedCustomerOption;
    },
  });

  const selectedCustomer =
    selectedCustomerState ?? initialCustomerQuery.data ?? null;

  const activeCurrency: Currency = selectedCustomer?.currency ?? 'GTQ';

  const fetchLastPriceForPair = async (
    targetCustomerId: string,
    targetProductId: string,
    lineKey?: string,
  ) => {
    if (isCustomerUser || !targetCustomerId || !targetProductId) return;
    const cacheKey = `${targetCustomerId}:${targetProductId}`;
    try {
      const res = await apiClient.get('/orders/last-price', {
        params: { customerId: targetCustomerId, productId: targetProductId },
      });
      const info = res.data as LastPriceResponse;
      setLastPriceMap((prev) => ({ ...prev, [cacheKey]: info }));

      if (lineKey) {
        setLines((prev) =>
          prev.map((line) => {
            if (line.key !== lineKey || line.priceEditedManually) return line;
            const suggested = info.lastPrice ?? info.catalogPrice ?? 0;
            return { ...line, unitPrice: String(suggested) };
          }),
        );
      }
    } catch {
      // Silencioso si no hay historial; conserva el precio de catálogo
    }
  };

  useEffect(() => {
    if (!activeTooltipKey) return;

    const handleOutside = (e: MouseEvent) => {
      const targetEl =
        e.target instanceof Element
          ? e.target
          : (e.target as Node | null)?.parentElement ?? null;
      if (
        targetEl?.closest('[data-tooltip-popover="true"]') ||
        targetEl?.closest(`[data-tooltip-toggle="${activeTooltipKey}"]`)
      ) {
        return;
      }
      setActiveTooltipKey(null);
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTooltipKey(null);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [activeTooltipKey]);

  useEffect(() => {
    if (isCustomerUser || !customerId) return;
    for (const line of lines) {
      if (!line.productId) continue;
      const cacheKey = `${customerId}:${line.productId}`;
      if (!lastPriceMap[cacheKey]) {
        void fetchLastPriceForPair(customerId, line.productId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, lines.map((l) => l.productId).join('|'), isCustomerUser]);

  const handleCustomerSelect = (nextCust: SelectedCustomerOption) => {
    setCustomerId(nextCust.id);
    setSelectedCustomerState(nextCust);
    setActiveTooltipKey(null);
    const nextCurr = nextCust.currency;
    setLines((prev) =>
      prev.map((line) => {
        if (!line.productId || line.priceEditedManually) return line;
        return {
          ...line,
          unitPrice: String(
            getOptionCurrencyPrice(line.selectedProduct, nextCurr),
          ),
        };
      }),
    );

    for (const line of lines) {
      if (line.productId) {
        void fetchLastPriceForPair(nextCust.id, line.productId, line.key);
      }
    }
  };

  const handleProductSelect = (
    lineKey: string,
    chosen: SelectedProductOption,
  ) => {
    const defaultPrice = isCustomerUser
      ? '0'
      : String(getOptionCurrencyPrice(chosen, activeCurrency));

    setLines((prev) =>
      prev.map((line) =>
        line.key === lineKey
          ? {
              ...line,
              productId: chosen.id,
              selectedProduct: chosen,
              unitPrice: defaultPrice,
              priceEditedManually: false,
            }
          : line,
      ),
    );

    if (!isCustomerUser && customerId && chosen.id) {
      void fetchLastPriceForPair(customerId, chosen.id, lineKey);
    }
  };

  const updateLineField = (lineKey: string, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === lineKey ? { ...l, ...patch } : l)),
    );
  };

  const lineComputations = useMemo(() => {
    return lines.map((line) => {
      const qty = Math.max(0, Number(line.quantityOrdered) || 0);
      const price = Math.max(0, Number(line.unitPrice) || 0);
      const discVal = Math.max(0, Number(line.discountValue) || 0);
      return calculateOrderLine({
        quantityOrdered: qty,
        unitPrice: price,
        discountType: line.discountType,
        discountValue: discVal,
      });
    });
  }, [lines]);

  const totals = useMemo(() => {
    return calculateOrderTotals({
      items: lineComputations,
      shippingCost: Math.max(0, Number(shippingCost) || 0),
      shippingDiscount: Math.max(0, Number(shippingDiscount) || 0),
      amountPaid: initialOrder?.amountPaid ?? 0,
    });
  }, [
    lineComputations,
    shippingCost,
    shippingDiscount,
    initialOrder?.amountPaid,
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const chosenProducts = lines.map((l) => l.productId).filter(Boolean);
      if (chosenProducts.length === 0 || chosenProducts.length !== lines.length) {
        throw new Error('Selecciona un producto válido en todas las líneas.');
      }
      if (new Set(chosenProducts).size !== chosenProducts.length) {
        throw new Error(
          'No repitas el mismo producto en líneas distintas; suma la cantidad en una sola línea.',
        );
      }

      if (isCustomerUser) {
        const res = await apiClient.post('/orders', {
          notes: notes.trim() || null,
          items: lines.map((l) => ({
            productId: l.productId,
            quantityOrdered: Math.max(
              1,
              Math.floor(Number(l.quantityOrdered) || 1),
            ),
          })),
        });
        return res.data as { order: OrderDto; message: string };
      }

      if (!customerId) {
        throw new Error('Debes seleccionar un cliente.');
      }

      const payload = {
        ...(mode === 'create' ? { customerId } : {}),
        type: orderType,
        shippingCost: Math.max(0, Number(shippingCost) || 0),
        shippingDiscount: Math.max(0, Number(shippingDiscount) || 0),
        consignmentDueDate:
          orderType === 'CONSIGNMENT' && consignmentDueDate
            ? consignmentDueDate
            : null,
        notes: notes.trim() || null,
        items: lines.map((l) => ({
          productId: l.productId,
          quantityOrdered: Math.max(
            1,
            Math.floor(Number(l.quantityOrdered) || 1),
          ),
          unitPrice: Math.max(0, Number(l.unitPrice) || 0),
          discountType: l.discountType,
          discountValue: Math.max(0, Number(l.discountValue) || 0),
        })),
      };

      if (mode === 'create') {
        const res = await apiClient.post('/orders', payload);
        return res.data as { order: OrderDto; message: string };
      }
      const res = await apiClient.patch(`/orders/${initialOrder!.id}`, payload);
      return res.data as { order: OrderDto; message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Pedido guardado correctamente.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (initialOrder?.id) {
        void queryClient.invalidateQueries({
          queryKey: ['order-detail', initialOrder.id],
        });
      }
      router.push(`/pedidos/${data.order.id}`);
    },
    onError: (err) => {
      const msg =
        err instanceof Error && !(err as { isAxiosError?: boolean }).isAxiosError
          ? err.message
          : getApiErrorMessage(err, 'No se pudo guardar el pedido.');
      showToast(msg, 'error');
    },
  });

  if (isCustomerUser && !user?.customerId) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Solicitar Pedido</h1>
          <Link href="/pedidos" className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Volver
          </Link>
        </div>
        <section className={styles.card}>
          <p className={styles.warningText}>
            Tu cuenta aún no está vinculada a una empresa cliente. Comunícate
            con Arte Modelo Dubois para habilitar la creación de pedidos.
          </p>
        </section>
      </div>
    );
  }

  return (
    <form
      className={styles.page}
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
    >
      <div className={styles.header}>
        <div>
          <h1>
            {mode === 'edit'
              ? `Editar Pedido ${initialOrder?.orderNumber ?? ''}`
              : isCustomerUser
                ? 'Solicitar Nuevo Pedido'
                : 'Nuevo Pedido B2B'}
          </h1>
          <p className={styles.subtitle}>
            {isCustomerUser
              ? 'Selecciona los productos y cantidades requeridas. Nuestro equipo confirmará tu pedido a la brevedad.'
              : 'Precios congelados por pedido con sugerencia automática del último precio aplicado al cliente.'}
          </p>
        </div>

        <Link
          href={
            mode === 'edit' && initialOrder
              ? `/pedidos/${initialOrder.id}`
              : '/pedidos'
          }
          className={styles.secondaryBtn}
        >
          <ArrowLeft size={16} /> Volver
        </Link>
      </div>

      {!isCustomerUser ? (
        <section className={styles.card} aria-label="Datos generales del pedido">
          <div className={styles.topGrid}>
            <div className={styles.field}>
              <label htmlFor="order-customer">Cliente</label>
              {mode === 'edit' && initialOrder ? (
                <input
                  id="order-customer"
                  type="text"
                  readOnly
                  value={`${initialOrder.customer.companyName} (${initialOrder.currency})`}
                />
              ) : (
                <CustomerSearchSelect
                  id="order-customer"
                  value={selectedCustomer}
                  onSelect={handleCustomerSelect}
                />
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="order-type">Tipo de pedido</label>
              <select
                id="order-type"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as OrderType)}
              >
                {ORDER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ORDER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {orderType === 'CONSIGNMENT' ? (
              <div className={styles.field}>
                <label htmlFor="order-consignment-date">
                  Fecha sugerida de revisión
                </label>
                <input
                  id="order-consignment-date"
                  type="date"
                  value={consignmentDueDate}
                  onChange={(e) => setConsignmentDueDate(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className={styles.card} aria-label="Productos del pedido">
        <div className={styles.sectionHeader}>
          <h2>Productos del Pedido</h2>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() =>
              setLines((prev) => [...prev, createEmptyLine(prev.length)])
            }
          >
            <Plus size={16} /> Agregar producto
          </button>
        </div>

        <div className={styles.linesList}>
          {lines.map((line, index) => {
            const calc = lineComputations[index];
            const cacheKey =
              customerId && line.productId
                ? `${customerId}:${line.productId}`
                : '';
            const lastPriceInfo = cacheKey ? lastPriceMap[cacheKey] : undefined;
            const hasLastPriceHistory = Boolean(
              !isCustomerUser &&
                customerId &&
                line.productId &&
                lastPriceInfo?.hasHistory &&
                lastPriceInfo.lastPrice !== null,
            );
            const excludedOtherIds = lines
              .filter((other) => other.key !== line.key && other.productId)
              .map((other) => other.productId);
            const canRemove = lines.length > 1 && line.minPacked === 0;

            return (
              <div key={line.key} className={styles.lineCard}>
                <div
                  className={
                    isCustomerUser ? styles.customerLineGrid : styles.staffLineGrid
                  }
                >
                  <div className={styles.field}>
                    <label htmlFor={`line-prod-${index}`}>Producto</label>
                    <ProductSearchSelect
                      id={`line-prod-${index}`}
                      value={line.selectedProduct}
                      excludedProductIds={excludedOtherIds}
                      currency={activeCurrency}
                      isCustomerMode={isCustomerUser}
                      disabled={line.minPacked > 0}
                      onSelect={(chosen) => handleProductSelect(line.key, chosen)}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor={`line-qty-${index}`}>Cantidad</label>
                    <input
                      id={`line-qty-${index}`}
                      type="number"
                      min={Math.max(1, line.minPacked)}
                      required
                      value={line.quantityOrdered}
                      onChange={(e) =>
                        updateLineField(line.key, {
                          quantityOrdered: e.target.value,
                        })
                      }
                    />
                    {line.minPacked > 0 ? (
                      <span className={styles.fieldHint}>
                        Mín. {line.minPacked} empacadas
                      </span>
                    ) : null}
                  </div>

                  {!isCustomerUser ? (
                    <>
                      <div className={styles.priceFieldWrap}>
                        <div className={styles.priceLabelRow}>
                          <label htmlFor={`line-price-${index}`}>
                            Precio unit. ({activeCurrency})
                          </label>
                          {hasLastPriceHistory ? (
                            <button
                              type="button"
                              className={styles.tooltipToggleBtn}
                              data-tooltip-toggle={line.key}
                              aria-expanded={activeTooltipKey === line.key}
                              aria-label={`Ver último precio línea ${index + 1}`}
                              onClick={() =>
                                setActiveTooltipKey((curr) =>
                                  curr === line.key ? null : line.key,
                                )
                              }
                            >
                              <Info size={16} />
                            </button>
                          ) : null}
                        </div>

                        <input
                          id={`line-price-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLineField(line.key, {
                              unitPrice: e.target.value,
                              priceEditedManually: true,
                            })
                          }
                        />

                        {hasLastPriceHistory &&
                        lastPriceInfo &&
                        activeTooltipKey === line.key ? (
                          <div
                            role="tooltip"
                            data-tooltip-popover="true"
                            className={styles.priceTooltip}
                          >
                            <span>
                              Último precio aplicado a este cliente:{' '}
                              <strong>
                                {formatCurrency(
                                  lastPriceInfo.lastPrice!,
                                  activeCurrency,
                                )}
                              </strong>{' '}
                              ({lastPriceInfo.lastOrderNumber})
                            </span>
                            <button
                              type="button"
                              className={styles.applyLastPriceBtn}
                              onClick={() => {
                                updateLineField(line.key, {
                                  unitPrice: String(lastPriceInfo.lastPrice),
                                  priceEditedManually: true,
                                });
                                setActiveTooltipKey(null);
                              }}
                            >
                              Usar último precio
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className={styles.lineTotalBox}>
                        <span>Subtotal</span>
                        <strong>
                          {formatCurrency(calc.lineTotal, activeCurrency)}
                        </strong>
                      </div>
                    </>
                  ) : null}

                  <div className={styles.lineActions}>
                    {!isCustomerUser ? (
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${
                          line.showDiscount || Number(line.discountValue) > 0
                            ? styles.iconBtnActive
                            : ''
                        }`}
                        aria-label="Descuento de línea"
                        aria-expanded={line.showDiscount}
                        title="Agregar o editar descuento"
                        onClick={() =>
                          updateLineField(line.key, {
                            showDiscount: !line.showDiscount,
                          })
                        }
                      >
                        <Percent size={16} />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className={styles.iconDangerBtn}
                      aria-label="Quitar producto"
                      title={
                        line.minPacked > 0
                          ? 'No puedes eliminar un ítem con unidades empacadas'
                          : 'Quitar producto'
                      }
                      disabled={!canRemove}
                      onClick={() =>
                        setLines((prev) =>
                          prev.filter((item) => item.key !== line.key),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {!isCustomerUser && line.showDiscount ? (
                  <div className={styles.discountDrawer}>
                    <div className={styles.field}>
                      <label htmlFor={`line-disc-type-${index}`}>
                        Tipo descuento
                      </label>
                      <select
                        id={`line-disc-type-${index}`}
                        value={line.discountType}
                        onChange={(e) =>
                          updateLineField(line.key, {
                            discountType: e.target.value as DiscountType,
                          })
                        }
                      >
                        {DISCOUNT_TYPES.map((dt) => (
                          <option key={dt} value={dt}>
                            {DISCOUNT_TYPE_LABELS[dt]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label htmlFor={`line-disc-val-${index}`}>Descuento</label>
                      <input
                        id={`line-disc-val-${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max={line.discountType === 'PERCENT' ? 100 : undefined}
                        value={line.discountValue}
                        onChange={(e) =>
                          updateLineField(line.key, {
                            discountValue: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section
        className={styles.card}
        aria-label={
          isCustomerUser ? 'Notas y envío del pedido' : 'Flete, notas y resumen'
        }
      >
        {!isCustomerUser ? (
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label htmlFor="order-shipping">
                Flete / Envío ({activeCurrency})
              </label>
              <input
                id="order-shipping"
                type="number"
                step="0.01"
                min="0"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="order-shipping-discount">
                Descuento al flete ({activeCurrency})
              </label>
              <input
                id="order-shipping-discount"
                type="number"
                step="0.01"
                min="0"
                value={shippingDiscount}
                onChange={(e) => setShippingDiscount(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="order-notes">Notas / indicaciones de entrega</label>
          <textarea
            id="order-notes"
            rows={3}
            placeholder="Dirección especial, transporte preferido o instrucciones de empaque..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {!isCustomerUser ? (
          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span>Subtotal bruto productos</span>
              <strong>{formatCurrency(totals.subtotal, activeCurrency)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Descuentos en ítems</span>
              <strong>
                - {formatCurrency(totals.itemsDiscountTotal, activeCurrency)}
              </strong>
            </div>
            <div className={styles.summaryRow}>
              <span>
                Flete ({formatCurrency(totals.shippingCost, activeCurrency)} -
                desc. {formatCurrency(totals.shippingDiscount, activeCurrency)})
              </span>
              <strong>
                {formatCurrency(
                  totals.shippingCost - totals.shippingDiscount,
                  activeCurrency,
                )}
              </strong>
            </div>
            <div className={`${styles.summaryRow} ${styles.summaryGrand}`}>
              <span>Total del Pedido</span>
              <strong>{formatCurrency(totals.totalAmount, activeCurrency)}</strong>
            </div>
          </div>
        ) : null}

        <div className={styles.submitRow}>
          <button
            type="submit"
            className={styles.primaryBtn}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? 'Guardando...'
              : mode === 'edit'
                ? 'Guardar cambios del pedido'
                : isCustomerUser
                  ? 'Enviar pedido para confirmación'
                  : 'Crear y confirmar pedido'}
          </button>
        </div>
      </section>
    </form>
  );
}
