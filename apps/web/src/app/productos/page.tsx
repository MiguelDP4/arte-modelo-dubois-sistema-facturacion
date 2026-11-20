'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_PAGE_SIZE,
  formatCurrency,
  PRODUCT_CODE_LABELS,
  SEARCH_DEBOUNCE_MS,
  STOCK_MOVEMENT_LABELS,
  type PaginationMeta,
} from '@arte-modelo/shared';
import {
  Archive,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell/AppShell';
import {
  ResponsiveTable,
  type TableColumn,
} from '@/components/ResponsiveTable/ResponsiveTable';
import { Pagination } from '@/components/Pagination/Pagination';
import { SearchingIndicator } from '@/components/SearchingIndicator/SearchingIndicator';
import { Modal } from '@/components/Modal/Modal';
import { ConfirmModal } from '@/components/Modal/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { compressImageFile } from '@/lib/image-compress';
import type {
  ProductCodeDto,
  ProductImageDto,
  StaffProduct,
  StockMovementDto,
} from '@/types/catalog';
import styles from './productos.module.scss';

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function ProductosContent() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const canManage = hasPermission('products.manage');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Create / Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StaffProduct | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceGTQ, setPriceGTQ] = useState('');
  const [priceHNL, setPriceHNL] = useState('');
  const [priceNIO, setPriceNIO] = useState('');
  const [priceUSD, setPriceUSD] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [codes, setCodes] = useState<ProductCodeDto[]>([
    { code: '', label: 'Interno', isPrimary: true },
  ]);
  const [images, setImages] = useState<ProductImageDto[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Kardex modal state
  const [kardexProduct, setKardexProduct] = useState<StaffProduct | null>(null);
  const [movementType, setMovementType] = useState<
    'MANUAL_IN' | 'MANUAL_OUT' | 'MANUAL_ADJUST'
  >('MANUAL_IN');
  const [movementQty, setMovementQty] = useState('1');
  const [movementReason, setMovementReason] = useState('');
  const [movementRef, setMovementRef] = useState('');

  // Gallery modal
  const [galleryProduct, setGalleryProduct] = useState<StaffProduct | null>(null);

  // Confirm archive/restore modal
  const [confirmArchiveProduct, setConfirmArchiveProduct] =
    useState<StaffProduct | null>(null);

  const productsQuery = useQuery({
    queryKey: [
      'products',
      debouncedSearch,
      lowStockOnly,
      includeArchived,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (lowStockOnly) params.lowStockOnly = 'true';
      if (includeArchived) params.includeArchived = 'true';
      const res = await apiClient.get('/products', { params });
      return res.data as {
        products: StaffProduct[];
        pagination?: PaginationMeta;
      };
    },
  });

  const kardexQuery = useQuery({
    queryKey: ['stock-movements', kardexProduct?.id],
    enabled: Boolean(kardexProduct),
    queryFn: async () => {
      const res = await apiClient.get(
        `/products/${kardexProduct!.id}/stock-movements`,
      );
      return res.data as {
        productId: string;
        productName: string;
        currentStock: number;
        lowStockThreshold: number;
        movements: StockMovementDto[];
      };
    },
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setPriceGTQ('');
    setPriceHNL('');
    setPriceNIO('');
    setPriceUSD('');
    setInitialStock('0');
    setLowStockThreshold('5');
    setCodes([{ code: '', label: 'Interno', isPrimary: true }]);
    setImages([]);
    setNewImageUrl('');
    setFormOpen(true);
  };

  const openEditModal = (product: StaffProduct) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || '');
    setPriceGTQ(product.priceGTQ != null ? String(product.priceGTQ) : '');
    setPriceHNL(product.priceHNL != null ? String(product.priceHNL) : '');
    setPriceNIO(product.priceNIO != null ? String(product.priceNIO) : '');
    setPriceUSD(product.priceUSD != null ? String(product.priceUSD) : '');
    setLowStockThreshold(String(product.lowStockThreshold ?? 5));
    setCodes(
      product.codes.length > 0
        ? product.codes.map((c) => ({
            code: c.code,
            label: c.label,
            isPrimary: c.isPrimary,
          }))
        : [{ code: '', label: 'Interno', isPrimary: true }],
    );
    setImages(product.images.map((img) => ({ url: img.url, altText: img.altText })));
    setNewImageUrl('');
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        codes: codes.map((c) => ({
          code: c.code.trim(),
          label: c.label.trim() || 'Interno',
          isPrimary: c.isPrimary,
        })),
        priceGTQ: parseOptionalNumber(priceGTQ),
        priceHNL: parseOptionalNumber(priceHNL),
        priceNIO: parseOptionalNumber(priceNIO),
        priceUSD: parseOptionalNumber(priceUSD),
        lowStockThreshold: Number(lowStockThreshold) || 0,
        images: images.map((img) => ({ url: img.url, altText: img.altText ?? null })),
      };

      if (editingProduct) {
        const res = await apiClient.patch(`/products/${editingProduct.id}`, payload);
        return res.data as { message: string };
      }

      const res = await apiClient.post('/products', {
        ...payload,
        initialStock: Number(initialStock) || 0,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Producto guardado.', 'success');
      setFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['public-catalog'] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo guardar el producto.'), 'error');
    },
  });

  const archiveRestoreMutation = useMutation({
    mutationFn: async (product: StaffProduct) => {
      if (product.isActive) {
        const res = await apiClient.delete(`/products/${product.id}`);
        return res.data as { message: string };
      }
      const res = await apiClient.post(`/products/${product.id}/restore`);
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Estado actualizado.', 'success');
      setConfirmArchiveProduct(null);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['public-catalog'] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo cambiar el estado.'), 'error');
      setConfirmArchiveProduct(null);
    },
  });

  const stockMovementMutation = useMutation({
    mutationFn: async () => {
      if (!kardexProduct) return;
      const res = await apiClient.post(
        `/products/${kardexProduct.id}/stock-movements`,
        {
          type: movementType,
          quantity: Number(movementQty) || 0,
          reason: movementReason.trim(),
          reference: movementRef.trim() || undefined,
        },
      );
      return res.data as { message: string; product: StaffProduct };
    },
    onSuccess: (data) => {
      showToast(data?.message || 'Movimiento registrado.', 'success');
      if (data?.product) {
        setKardexProduct(data.product);
      }
      setMovementQty('1');
      setMovementReason('');
      setMovementRef('');
      void queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo registrar el movimiento.'), 'error');
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingImage(true);
    try {
      const payload = await compressImageFile(file);
      const res = await apiClient.post('/uploads/product-image', payload);
      const url = res.data.url as string;
      setImages((prev) => [...prev, { url, altText: name.trim() || file.name }]);
      showToast('Imagen subida correctamente.', 'success');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'No se pudo subir la imagen.'), 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddImageUrl = () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    setImages((prev) => [...prev, { url: trimmed, altText: name.trim() || 'Producto' }]);
    setNewImageUrl('');
  };

  const updateCodeRow = (idx: number, patch: Partial<ProductCodeDto>) => {
    setCodes((prev) =>
      prev.map((row, i) => {
        if (patch.isPrimary) {
          return { ...row, ...(i === idx ? patch : { isPrimary: false }) };
        }
        return i === idx ? { ...row, ...patch } : row;
      }),
    );
  };

  const columns = useMemo<TableColumn<StaffProduct>[]>(
    () => [
      {
        key: 'image',
        header: 'Foto',
        render: (p) =>
          p.images.length > 0 ? (
            <button
              type="button"
              className={styles.thumbBtn}
              onClick={() => setGalleryProduct(p)}
              aria-label={`Ver foto de ${p.name}`}
            >
              <img src={p.images[0].url} alt={p.images[0].altText || p.name} />
            </button>
          ) : (
            <span className={styles.noThumb}>Sin foto</span>
          ),
      },
      {
        key: 'name',
        header: 'Producto y Códigos',
        render: (p) => (
          <div>
            <strong>{p.name}</strong>
            <div className={styles.codesList}>
              {p.codes.map((c) => (
                <span
                  key={c.code}
                  className={`${styles.codeBadge} ${
                    c.isPrimary ? styles.codePrimary : ''
                  }`}
                >
                  {c.label}: {c.code}
                </span>
              ))}
            </div>
          </div>
        ),
      },
      {
        key: 'prices',
        header: 'Precios',
        render: (p) => (
          <div className={styles.pricesCell}>
            {p.priceGTQ != null ? <span>{formatCurrency(p.priceGTQ, 'GTQ')}</span> : null}
            {p.priceHNL != null ? <span>{formatCurrency(p.priceHNL, 'HNL')}</span> : null}
            {p.priceNIO != null ? <span>{formatCurrency(p.priceNIO, 'NIO')}</span> : null}
            {p.priceUSD != null ? <span>{formatCurrency(p.priceUSD, 'USD')}</span> : null}
          </div>
        ),
      },
      {
        key: 'stock',
        header: 'Stock',
        render: (p) => (
          <div>
            <span
              className={`${styles.stockBadge} ${
                p.isLowStock ? styles.stockLow : styles.stockOk
              }`}
            >
              {p.stock ?? 0} uds.{p.isLowStock ? ' (Bajo)' : ''}
            </span>
            {!p.isActive ? (
              <div style={{ marginTop: 6 }}>
                <span className={styles.archivedBadge}>Archivado</span>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'Acciones',
        render: (p) => (
          <div className={styles.actionsCell}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setKardexProduct(p)}
            >
              <History size={15} /> Kardex
            </button>
            {canManage ? (
              <>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => openEditModal(p)}
                >
                  <Pencil size={15} /> Editar
                </button>
                <button
                  type="button"
                  className={p.isActive ? styles.actionDangerBtn : styles.actionBtn}
                  onClick={() => setConfirmArchiveProduct(p)}
                >
                  {p.isActive ? (
                    <>
                      <Archive size={15} /> Archivar
                    </>
                  ) : (
                    <>
                      <RotateCcw size={15} /> Restaurar
                    </>
                  )}
                </button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [canManage],
  );

  const isWaitingDebounce = search.trim() !== debouncedSearch.trim();
  const pagination = productsQuery.data?.pagination;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Productos e Inventario (Kardex)</h1>
        {canManage ? (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={openCreateModal}
          >
            <Plus size={18} /> Nuevo producto
          </button>
        ) : null}
      </div>

      <section className={styles.filtersCard} aria-label="Filtros de productos">
        <div className={styles.field}>
          <label htmlFor="prod-search">Buscar por nombre o cualquier código</label>
          <input
            id="prod-search"
            type="search"
            placeholder="Ej. Marco, AMD-MC-4050, PROV-9910..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {isWaitingDebounce ||
          (productsQuery.isFetching && debouncedSearch.trim().length > 0) ? (
            <SearchingIndicator compact />
          ) : null}
        </div>

        <div className={styles.checkboxRow}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
            />
            Solo stock bajo
          </label>

          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked);
                setPage(1);
              }}
            />
            Mostrar archivados
          </label>
        </div>
      </section>

      {productsQuery.isLoading ? (
        <p role="status">Cargando productos...</p>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={productsQuery.data?.products || []}
          rowKey={(p) => p.id}
          emptyMessage="No hay productos que coincidan con los filtros."
          ariaLabel="Listado de productos e inventario"
        />
      )}

      {pagination ? (
        <Pagination
          pagination={pagination}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
          itemLabel="productos"
        />
      ) : null}

      {/* Modal Crear / Editar Producto */}
      <Modal
        isOpen={formOpen}
        title={editingProduct ? 'Editar producto' : 'Nuevo producto'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="product-form"
              className={styles.primaryBtn}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar producto'}
            </button>
          </>
        }
      >
        <form
          id="product-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className={styles.field}>
            <label htmlFor="prod-name">Nombre del producto</label>
            <input
              id="prod-name"
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label htmlFor="prod-threshold">Alerta stock bajo (uds.)</label>
              <input
                id="prod-threshold"
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </div>

            {!editingProduct ? (
              <div className={styles.field}>
                <label htmlFor="prod-init-stock">Inventario inicial</label>
                <input
                  id="prod-init-stock"
                  type="number"
                  min={0}
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="prod-desc">Descripción</label>
            <textarea
              id="prod-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.subSection}>
            <div className={styles.subHeader}>
              <strong>Precios Multimoneda</strong>
            </div>
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label htmlFor="price-gtq">Precio GTQ (Q)</label>
                <input
                  id="price-gtq"
                  type="number"
                  step="0.01"
                  min={0}
                  value={priceGTQ}
                  onChange={(e) => setPriceGTQ(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="price-hnl">Precio HNL (L)</label>
                <input
                  id="price-hnl"
                  type="number"
                  step="0.01"
                  min={0}
                  value={priceHNL}
                  onChange={(e) => setPriceHNL(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="price-nio">Precio NIO (C$)</label>
                <input
                  id="price-nio"
                  type="number"
                  step="0.01"
                  min={0}
                  value={priceNIO}
                  onChange={(e) => setPriceNIO(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="price-usd">Precio USD ($)</label>
                <input
                  id="price-usd"
                  type="number"
                  step="0.01"
                  min={0}
                  value={priceUSD}
                  onChange={(e) => setPriceUSD(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.subSection}>
            <div className={styles.subHeader}>
              <strong>Códigos del Producto</strong>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() =>
                  setCodes((prev) => [
                    ...prev,
                    { code: '', label: 'Proveedor', isPrimary: false },
                  ])
                }
              >
                <Plus size={14} /> Agregar código
              </button>
            </div>

            {codes.map((row, idx) => (
              <div key={idx} className={styles.codeRow}>
                <input
                  type="text"
                  required
                  placeholder="Código (ej. AMD-001)"
                  aria-label={`Código ${idx + 1}`}
                  className={styles.smallInput}
                  value={row.code}
                  onChange={(e) => updateCodeRow(idx, { code: e.target.value })}
                />
                <select
                  aria-label={`Etiqueta del código ${idx + 1}`}
                  className={styles.smallInput}
                  value={row.label}
                  onChange={(e) => updateCodeRow(idx, { label: e.target.value })}
                >
                  {PRODUCT_CODE_LABELS.map((lbl) => (
                    <option key={lbl} value={lbl}>
                      {lbl}
                    </option>
                  ))}
                </select>
                <label className={styles.checkLabel}>
                  <input
                    type="radio"
                    name="primary-code"
                    checked={row.isPrimary}
                    onChange={() => updateCodeRow(idx, { isPrimary: true })}
                  />
                  Principal
                </label>
                {codes.length > 1 ? (
                  <button
                    type="button"
                    className={styles.actionDangerBtn}
                    aria-label={`Quitar código ${idx + 1}`}
                    onClick={() =>
                      setCodes((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className={styles.subSection}>
            <div className={styles.subHeader}>
              <strong>Fotografías del Producto</strong>
              <label className={styles.actionBtn}>
                <Upload size={14} />
                {uploadingImage ? 'Subiendo...' : 'Subir archivo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={handleFileUpload}
                  disabled={uploadingImage}
                />
              </label>
            </div>

            <div className={styles.codeRow}>
              <input
                type="text"
                placeholder="O pega URL externa de imagen..."
                className={styles.smallInput}
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
              />
              <button
                type="button"
                className={styles.actionBtn}
                onClick={handleAddImageUrl}
              >
                Agregar URL
              </button>
            </div>

            {images.length > 0 ? (
              <div className={styles.imagePreviewList}>
                {images.map((img, idx) => (
                  <div key={`${img.url}-${idx}`} className={styles.imagePreviewRow}>
                    <img src={img.url} alt={img.altText || 'Vista previa'} />
                    <span>{img.url}</span>
                    <button
                      type="button"
                      className={styles.actionDangerBtn}
                      aria-label={`Eliminar imagen ${idx + 1}`}
                      onClick={() =>
                        setImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </form>
      </Modal>

      {/* Modal Kardex de Stock */}
      <Modal
        isOpen={Boolean(kardexProduct)}
        title={`Kardex: ${kardexProduct?.name || ''}`}
        onClose={() => setKardexProduct(null)}
        footer={
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setKardexProduct(null)}
          >
            Cerrar
          </button>
        }
      >
        {kardexProduct ? (
          <div className={styles.modalForm}>
            <div className={styles.kardexSummary}>
              <span>Existencia actual:</span>
              <strong>
                {kardexQuery.data?.currentStock ?? kardexProduct.stock ?? 0}{' '}
                unidades
              </strong>
            </div>

            {canManage ? (
              <form
                className={styles.subSection}
                onSubmit={(e) => {
                  e.preventDefault();
                  stockMovementMutation.mutate();
                }}
              >
                <strong>Registrar movimiento de inventario</strong>
                <div className={styles.twoCol}>
                  <div className={styles.field}>
                    <label htmlFor="kardex-type">Tipo</label>
                    <select
                      id="kardex-type"
                      value={movementType}
                      onChange={(e) =>
                        setMovementType(
                          e.target.value as
                            | 'MANUAL_IN'
                            | 'MANUAL_OUT'
                            | 'MANUAL_ADJUST',
                        )
                      }
                    >
                      <option value="MANUAL_IN">Ingreso (+)</option>
                      <option value="MANUAL_OUT">Salida (-)</option>
                      <option value="MANUAL_ADJUST">Ajuste exacto (=)</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="kardex-qty">
                      {movementType === 'MANUAL_ADJUST'
                        ? 'Nuevo stock total'
                        : 'Cantidad'}
                    </label>
                    <input
                      id="kardex-qty"
                      type="number"
                      min={movementType === 'MANUAL_ADJUST' ? 0 : 1}
                      required
                      value={movementQty}
                      onChange={(e) => setMovementQty(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="kardex-reason">Motivo</label>
                  <input
                    id="kardex-reason"
                    type="text"
                    required
                    minLength={3}
                    placeholder="Ej. Compra de proveedor, conteo físico..."
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="kardex-ref">Referencia (opcional)</label>
                  <input
                    id="kardex-ref"
                    type="text"
                    placeholder="No. factura o nota interna"
                    value={movementRef}
                    onChange={(e) => setMovementRef(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={stockMovementMutation.isPending}
                >
                  {stockMovementMutation.isPending
                    ? 'Registrando...'
                    : 'Registrar movimiento'}
                </button>
              </form>
            ) : null}

            <strong>Historial de movimientos</strong>
            {kardexQuery.isLoading ? (
              <p role="status">Cargando historial...</p>
            ) : (kardexQuery.data?.movements || []).length === 0 ? (
              <p>Sin movimientos registrados todavía.</p>
            ) : (
              <div className={styles.historyList}>
                {(kardexQuery.data?.movements || []).map((m) => (
                  <div key={m.id} className={styles.historyItem}>
                    <div className={styles.historyTop}>
                      <span>{STOCK_MOVEMENT_LABELS[m.type]}</span>
                      <span
                        className={
                          m.quantityDelta >= 0 ? styles.deltaPos : styles.deltaNeg
                        }
                      >
                        {m.quantityDelta >= 0
                          ? `+${m.quantityDelta}`
                          : m.quantityDelta}{' '}
                        ({m.previousStock} → {m.newStock})
                      </span>
                    </div>
                    <span>{m.reason}</span>
                    {m.reference ? <span>Ref: {m.reference}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Modal Galería */}
      <Modal
        isOpen={Boolean(galleryProduct)}
        title={galleryProduct?.name || 'Fotografía'}
        onClose={() => setGalleryProduct(null)}
        footer={
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setGalleryProduct(null)}
          >
            Cerrar
          </button>
        }
      >
        {galleryProduct && galleryProduct.images[0] ? (
          <img
            src={galleryProduct.images[0].url}
            alt={galleryProduct.images[0].altText || galleryProduct.name}
            style={{ width: '100%', maxHeight: 380, objectFit: 'contain' }}
          />
        ) : null}
      </Modal>

      <ConfirmModal
        isOpen={Boolean(confirmArchiveProduct)}
        title={
          confirmArchiveProduct?.isActive
            ? 'Archivar producto'
            : 'Restaurar producto'
        }
        message={
          confirmArchiveProduct?.isActive
            ? `¿Seguro que deseas archivar "${confirmArchiveProduct.name}"? Dejará de mostrarse en el catálogo público.`
            : `¿Deseas restaurar "${confirmArchiveProduct?.name}" al catálogo activo?`
        }
        confirmLabel={
          confirmArchiveProduct?.isActive ? 'Archivar' : 'Restaurar'
        }
        variant={confirmArchiveProduct?.isActive ? 'danger' : 'primary'}
        isSubmitting={archiveRestoreMutation.isPending}
        onCancel={() => setConfirmArchiveProduct(null)}
        onConfirm={() => {
          if (confirmArchiveProduct) {
            archiveRestoreMutation.mutate(confirmArchiveProduct);
          }
        }}
      />
    </div>
  );
}

export default function ProductosPage() {
  return (
    <AppShell requiredPermission="products.read_prices">
      <ProductosContent />
    </AppShell>
  );
}
