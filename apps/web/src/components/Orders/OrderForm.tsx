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
import { ArrowLeft, Info, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { CatalogProduct, StaffProduct } from '@/types/catalog';
import type { CustomerDto } from '@/types/customer';
import type { LastPriceResponse, OrderDto } from '@/types/order';
import styles from './OrderForm.module.scss';

interface DraftLine {
  key: string;
  productId: string;
  quantityOrdered: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  minPacked: number;
  priceEditedManually: boolean;
}

interface OrderFormProps {
  mode: 'create' | 'edit';
  initialOrder?: OrderDto;
  initialCustomerId?: string;
}

function getProductCurrencyPrice(
  product: StaffProduct | undefined,
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
    quantityOrdered: '1',
    unitPrice: '0',
    discountType: 'FIXED',
    discountValue: '0',
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
        quantityOrdered: String(item.quantityOrdered),
        unitPrice: String(item.unitPrice ?? 0),
        discountType: item.discountType,
        discountValue: String(item.discountValue ?? 0),
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

  const customersQuery = useQuery({
    queryKey: ['orders-form-customers'],
    enabled: !isCustomerUser && mode === 'create',
    queryFn: async () => {
      const res = await apiClient.get('/customers', {
        params: { pageSize: 0 },
      });
      return (res.data.customers || []) as CustomerDto[];
    },
  });

  const productsQuery = useQuery({
    queryKey: ['orders-form-products', isCustomerUser],
    queryFn: async () => {
      if (isCustomerUser) {
        const res = await apiClient.get('/catalog', {
          params: { pageSize: 0 },
        });
        return (res.data.products || []) as CatalogProduct[];
      }
      const res = await apiClient.get('/products', {
        params: { pageSize: 0 },
      });
      return (res.data.products || []) as StaffProduct[];
    },
  });

  const selectedCustomer = useMemo(() => {
    if (initialOrder) {
      return initialOrder.customer;
    }
    return (customersQuery.data || []).find((c) => c.id === customerId) ?? null;
  }, [customersQuery.data, customerId, initialOrder]);

  const activeCurrency: Currency = selectedCustomer?.currency ?? 'GTQ';

  const productLookup = useMemo(() => {
    const map = new Map<string, CatalogProduct | StaffProduct>();
    for (const p of productsQuery.data || []) {
      map.set(p.id, p);
    }
    return map;
  }, [productsQuery.data]);

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

  const handleCustomerChange = (nextCustomerId: string) => {
    setCustomerId(nextCustomerId);
    const nextCust = (customersQuery.data || []).find(
      (c) => c.id === nextCustomerId,
    );
    const nextCurr = nextCust?.currency ?? 'GTQ';
    setLines((prev) =>
      prev.map((line) => {
        if (!line.productId || line.priceEditedManually) return line;
        const prod = productLookup.get(line.productId) as StaffProduct | undefined;
        return {
          ...line,
          unitPrice: String(getProductCurrencyPrice(prod, nextCurr)),
        };
      }),
    );
  };

  const handleProductChange = (lineKey: string, nextProductId: string) => {
    const prod = productLookup.get(nextProductId) as StaffProduct | undefined;
    const defaultPrice = isCustomerUser
      ? '0'
      : String(getProductCurrencyPrice(prod, activeCurrency));

    setLines((prev) =>
      prev.map((line) =>
        line.key === lineKey
          ? {
              ...line,
              productId: nextProductId,
              unitPrice: defaultPrice,
              priceEditedManually: false,
            }
          : line,
      ),
    );

    if (!isCustomerUser && customerId && nextProductId) {
      void fetchLastPriceForPair(customerId, nextProductId, lineKey);
    }
  };

  const updateLineField = (
    lineKey: string,
    patch: Partial<DraftLine>,
  ) => {
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
            quantityOrdered: Math.max(1, Math.floor(Number(l.quantityOrdered) || 1)),
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
          quantityOrdered: Math.max(1, Math.floor(Number(l.quantityOrdered) || 1)),
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
                <select
                  id="order-customer"
                  required
                  value={customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                >
                  <option value="">Selecciona un cliente...</option>
                  {(customersQuery.data || [])
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.countryLabel} · {c.currency})
                      </option>
                    ))}
                </select>
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
            onClick={() => setLines((prev) => [...prev, createEmptyLine(prev.length)])}
          >
            <Plus size={16} /> Agregar producto
          </button>
        </div>

        <div className={styles.linesList}>
          {lines.map((line, index) => {
            const calc = lineComputations[index];
            const cacheKey =
              customerId && line.productId ? `${customerId}:${line.productId}` : '';
            const lastPriceInfo = cacheKey ? lastPriceMap[cacheKey] : undefined;
            const prod = line.productId
              ? (productLookup.get(line.productId) as StaffProduct | undefined)
              : undefined;
            const catalogPrice =
              lastPriceInfo?.catalogPrice ??
              getProductCurrencyPrice(prod, activeCurrency);

            return (
              <div key={line.key} className={styles.lineCard}>
                <div className={styles.lineHeader}>
                  <strong>Línea #{index + 1}</strong>
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      className={styles.dangerSmallBtn}
                      disabled={line.minPacked > 0}
                      title={
                        line.minPacked > 0
                          ? 'No puedes eliminar un ítem que ya tiene unidades empacadas'
                          : 'Quitar línea'
                      }
                      onClick={() =>
                        setLines((prev) => prev.filter((item) => item.key !== line.key))
                      }
                    >
                      <Trash2 size={15} /> Quitar
                    </button>
                  ) : null}
                </div>

                <div
                  className={
                    isCustomerUser ? styles.customerLineGrid : styles.staffLineGrid
                  }
                >
                  <div className={styles.field}>
                    <label htmlFor={`line-prod-${index}`}>Producto</label>
                    <select
                      id={`line-prod-${index}`}
                      required
                      value={line.productId}
                      disabled={line.minPacked > 0}
                      onChange={(e) => handleProductChange(line.key, e.target.value)}
                    >
                      <option value="">Selecciona un producto...</option>
                      {(productsQuery.data || []).map((p) => {
                        const primaryCode = p.codes[0]?.code ?? '';
                        const staffStock =
                          !isCustomerUser && 'stock' in p ? ` · Stock: ${p.stock}` : '';
                        return (
                          <option key={p.id} value={p.id}>
                            {primaryCode ? `[${primaryCode}] ` : ''}
                            {p.name}
                            {staffStock}
                          </option>
                        );
                      })}
                    </select>
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
                        Mínimo {line.minPacked} uds. ya empacadas
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
                          {line.productId && customerId ? (
                            <button
                              type="button"
                              className={styles.tooltipToggleBtn}
                              aria-label={`Ver último precio línea ${index + 1}`}
                              onClick={() =>
                                setActiveTooltipKey((curr) =>
                                  curr === line.key ? null : line.key,
                                )
                              }
                            >
                              <Info size={15} />
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
                          onFocus={() => setActiveTooltipKey(line.key)}
                          onMouseEnter={() => {
                            if (line.productId && customerId) {
                              setActiveTooltipKey(line.key);
                            }
                          }}
                          onChange={(e) =>
                            updateLineField(line.key, {
                              unitPrice: e.target.value,
                              priceEditedManually: true,
                            })
                          }
                        />

                        {line.productId && customerId && lastPriceInfo ? (
                          <div
                            role="tooltip"
                            className={`${styles.priceTooltip} ${
                              activeTooltipKey === line.key
                                ? styles.priceTooltipActive
                                : ''
                            }`}
                          >
                            {lastPriceInfo.hasHistory &&
                            lastPriceInfo.lastPrice !== null ? (
                              <>
                                <span>
                                  Último precio aplicado a este cliente:{' '}
                                  <strong>
                                    {formatCurrency(
                                      lastPriceInfo.lastPrice,
                                      activeCurrency,
                                    )}
                                  </strong>{' '}
                                  ({lastPriceInfo.lastOrderNumber})
                                </span>
                                <span className={styles.catalogSubHint}>
                                  Catálogo:{' '}
                                  {catalogPrice !== null
                                    ? formatCurrency(catalogPrice, activeCurrency)
                                    : 'No definido'}
                                </span>
                                <button
                                  type="button"
                                  className={styles.applyLastPriceBtn}
                                  onClick={() =>
                                    updateLineField(line.key, {
                                      unitPrice: String(lastPriceInfo.lastPrice),
                                      priceEditedManually: true,
                                    })
                                  }
                                >
                                  Usar último precio
                                </button>
                              </>
                            ) : (
                              <span>
                                Último precio aplicado a este cliente: sin historial
                                · Catálogo:{' '}
                                <strong>
                                  {catalogPrice !== null
                                    ? formatCurrency(catalogPrice, activeCurrency)
                                    : 'No definido'}
                                </strong>
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>

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

                      <div className={styles.lineTotalBox}>
                        <span>Total línea</span>
                        <strong>
                          {formatCurrency(calc.lineTotal, activeCurrency)}
                        </strong>
                      </div>
                    </>
                  ) : null}
                </div>
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
              <label htmlFor="order-shipping">Flete / Envío ({activeCurrency})</label>
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
              <span>Flete ({formatCurrency(totals.shippingCost, activeCurrency)} - desc. {formatCurrency(totals.shippingDiscount, activeCurrency)})</span>
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
