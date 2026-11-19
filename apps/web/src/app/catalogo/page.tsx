'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@arte-modelo/shared';
import { AppShell } from '@/components/AppShell/AppShell';
import { Topbar } from '@/components/Topbar/Topbar';
import { Modal } from '@/components/Modal/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import type { CatalogProduct, StaffProduct } from '@/types/catalog';
import styles from './catalogo.module.scss';

type CatalogItem = CatalogProduct | StaffProduct;

function isStaffItem(item: CatalogItem): item is StaffProduct {
  return 'stock' in item || 'priceGTQ' in item;
}

function CatalogContent({ showStaffPrices }: { showStaffPrices: boolean }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [galleryProduct, setGalleryProduct] = useState<CatalogItem | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const catalogQuery = useQuery({
    queryKey: ['public-catalog', showStaffPrices, search, category],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (category !== 'ALL') params.category = category;

      const endpoint = showStaffPrices ? '/products' : '/catalog';
      const res = await apiClient.get(endpoint, { params });
      return res.data as {
        products: CatalogItem[];
        categories: string[];
      };
    },
  });

  const openGallery = (product: CatalogItem) => {
    if (product.images.length === 0) return;
    setGalleryProduct(product);
    setGalleryIndex(0);
  };

  const activeImage = galleryProduct?.images[galleryIndex];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Catálogo Arte Modelo Dubois</h1>
          <p className={styles.subtitle}>
            Explora productos disponibles por categoría o cualquiera de sus códigos
            de referencia.
          </p>
        </div>

        {showStaffPrices ? (
          <Link href="/productos" className={styles.primaryBtn}>
            Administrar Productos
          </Link>
        ) : null}
      </div>

      <section className={styles.noticeCard}>
        {showStaffPrices ? (
          <span>
            Vista interna de personal: ves precios multimoneda y existencias. Los
            visitantes públicos y clientes ven el catálogo sin precios ni stock.
          </span>
        ) : (
          <span>
            Por política comercial de precios diferenciados, el catálogo público no
            muestra precios ni existencias en línea.
          </span>
        )}
      </section>

      <section className={styles.filtersCard} aria-label="Filtros del catálogo">
        <div className={styles.field}>
          <label htmlFor="catalog-search">Buscar producto o código</label>
          <input
            id="catalog-search"
            type="search"
            placeholder="Nombre, código interno, proveedor o tienda..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="catalog-category">Categoría</label>
          <select
            id="catalog-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="ALL">Todas las categorías</option>
            {(catalogQuery.data?.categories || []).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </section>

      {catalogQuery.isLoading ? (
        <div className={styles.emptyCard} role="status">
          Cargando catálogo...
        </div>
      ) : (catalogQuery.data?.products || []).length === 0 ? (
        <div className={styles.emptyCard}>
          No se encontraron productos con los filtros actuales.
        </div>
      ) : (
        <section className={styles.grid} aria-label="Productos del catálogo">
          {(catalogQuery.data?.products || []).map((product) => (
            <article key={product.id} className={styles.productCard}>
              {product.images.length > 0 ? (
                <button
                  type="button"
                  className={styles.thumbBtn}
                  onClick={() => openGallery(product)}
                  aria-label={`Ver galería de ${product.name}`}
                >
                  <img
                    src={product.images[0].url}
                    alt={product.images[0].altText || product.name}
                  />
                  {product.images.length > 1 ? (
                    <span className={styles.imageCountBadge}>
                      {product.images.length} fotos
                    </span>
                  ) : null}
                </button>
              ) : (
                <div className={styles.imagePlaceholder}>Sin fotografía</div>
              )}

              <div className={styles.cardBody}>
                {product.category ? (
                  <span className={styles.categoryLabel}>{product.category}</span>
                ) : null}

                <h2 className={styles.productTitle}>{product.name}</h2>

                {product.description ? (
                  <p className={styles.productDesc}>{product.description}</p>
                ) : null}

                <div className={styles.codesRow} aria-label="Códigos del producto">
                  {product.codes.map((c) => (
                    <span
                      key={c.code}
                      className={`${styles.codeChip} ${
                        c.isPrimary ? styles.codePrimary : ''
                      }`}
                    >
                      {c.label}: {c.code}
                    </span>
                  ))}
                </div>

                {showStaffPrices && isStaffItem(product) ? (
                  <div className={styles.staffPricingBox}>
                    <div className={styles.pricesGrid}>
                      {product.priceGTQ != null ? (
                        <span>GT: {formatCurrency(product.priceGTQ, 'GTQ')}</span>
                      ) : null}
                      {product.priceHNL != null ? (
                        <span>HN: {formatCurrency(product.priceHNL, 'HNL')}</span>
                      ) : null}
                      {product.priceNIO != null ? (
                        <span>NI: {formatCurrency(product.priceNIO, 'NIO')}</span>
                      ) : null}
                      {product.priceUSD != null ? (
                        <span>SV: {formatCurrency(product.priceUSD, 'USD')}</span>
                      ) : null}
                    </div>
                    {typeof product.stock === 'number' ? (
                      <span
                        className={`${styles.stockLine} ${
                          product.isLowStock ? styles.lowStockLine : ''
                        }`}
                      >
                        Existencia: {product.stock} uds.
                        {product.isLowStock ? ' (Stock bajo)' : ''}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      )}

      <Modal
        isOpen={Boolean(galleryProduct && activeImage)}
        title={galleryProduct?.name || 'Galería'}
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
        {galleryProduct && activeImage ? (
          <div className={styles.galleryWrap}>
            <img
              src={activeImage.url}
              alt={activeImage.altText || galleryProduct.name}
              className={styles.galleryImage}
            />
            {galleryProduct.images.length > 1 ? (
              <div className={styles.galleryControls}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() =>
                    setGalleryIndex((prev) =>
                      prev === 0 ? galleryProduct.images.length - 1 : prev - 1,
                    )
                  }
                >
                  Anterior
                </button>
                <span>
                  {galleryIndex + 1} / {galleryProduct.images.length}
                </span>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() =>
                    setGalleryIndex((prev) =>
                      prev === galleryProduct.images.length - 1 ? 0 : prev + 1,
                    )
                  }
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default function CatalogoPage() {
  const { isAuthenticated, hasPermission } = useAuth();
  const canViewPrices = hasPermission('products.read_prices');

  if (isAuthenticated) {
    return (
      <AppShell>
        <CatalogContent showStaffPrices={canViewPrices} />
      </AppShell>
    );
  }

  return (
    <>
      <Topbar onToggleSidebar={() => {}} showMenuButton={false} />
      <main className={styles.publicMain}>
        <CatalogContent showStaffPrices={false} />
      </main>
    </>
  );
}
