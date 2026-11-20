'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  formatCurrency,
  SEARCH_DEBOUNCE_MS,
  type Currency,
  type PaginationMeta,
} from '@arte-modelo/shared';
import { ChevronDown, Package, Search } from 'lucide-react';
import { SearchingIndicator } from '@/components/SearchingIndicator/SearchingIndicator';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient } from '@/lib/api-client';
import type { CatalogProduct, StaffProduct } from '@/types/catalog';
import styles from './SearchSelect.module.scss';

export interface SelectedProductOption {
  id: string;
  name: string;
  primaryCode: string;
  imageUrl: string | null;
  priceGTQ?: number | null;
  priceHNL?: number | null;
  priceNIO?: number | null;
  priceUSD?: number | null;
  stock?: number;
}

interface ProductSearchSelectProps {
  id?: string;
  value: SelectedProductOption | null;
  excludedProductIds: string[];
  currency: Currency;
  isCustomerMode: boolean;
  disabled?: boolean;
  onSelect: (product: SelectedProductOption) => void;
}

function getLocalPrice(
  product: CatalogProduct | StaffProduct,
  currency: Currency,
): number | null {
  if (!('priceGTQ' in product)) return null;
  switch (currency) {
    case 'GTQ':
      return product.priceGTQ ?? null;
    case 'HNL':
      return product.priceHNL ?? null;
    case 'NIO':
      return product.priceNIO ?? null;
    case 'USD':
      return product.priceUSD ?? null;
  }
}

export function ProductSearchSelect({
  id,
  value,
  excludedProductIds,
  currency,
  isCustomerMode,
  disabled = false,
  onSelect,
}: ProductSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const excludedKey = useMemo(
    () => [...excludedProductIds].sort().join(','),
    [excludedProductIds],
  );
  const excludedSet = useMemo(
    () => new Set(excludedProductIds),
    [excludedProductIds],
  );

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const productsQuery = useInfiniteQuery({
    queryKey: [
      'order-product-search',
      isCustomerMode ? 'catalog' : 'products',
      debouncedSearch,
      excludedKey,
    ],
    initialPageParam: 1,
    enabled: isOpen,
    queryFn: async ({ pageParam }) => {
      const endpoint = isCustomerMode ? '/catalog' : '/products';
      const params: Record<string, string | number> = {
        page: Number(pageParam) || 1,
        pageSize: 10,
      };
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      if (excludedKey) {
        params.excludeIds = excludedKey;
      }

      const res = await apiClient.get(endpoint, { params });
      return {
        products: (res.data.products || []) as Array<
          CatalogProduct | StaffProduct
        >,
        pagination: res.data.pagination as PaginationMeta | undefined,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasNext ? lastPage.pagination.page + 1 : undefined,
  });

  const options = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<CatalogProduct | StaffProduct> = [];
    for (const pageData of productsQuery.data?.pages ?? []) {
      for (const item of pageData.products) {
        if (!excludedSet.has(item.id) && !seen.has(item.id)) {
          seen.add(item.id);
          list.push(item);
        }
      }
    }
    return list;
  }, [productsQuery.data, excludedSet]);

  const isWaitingDebounce = search.trim() !== debouncedSearch.trim();
  const isInitialLoading =
    isWaitingDebounce ||
    productsQuery.isPending ||
    (productsQuery.isFetching && !productsQuery.isFetchingNextPage);

  const handleListScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (
      el.scrollTop > 0 &&
      distanceToBottom <= 2 &&
      productsQuery.hasNextPage &&
      !productsQuery.isFetchingNextPage
    ) {
      void productsQuery.fetchNextPage();
    }
  };

  const handleChoose = (item: CatalogProduct | StaffProduct) => {
    const primaryCode = item.codes[0]?.code ?? '';
    const imageUrl = item.images[0]?.url ?? null;
    const chosen: SelectedProductOption = {
      id: item.id,
      name: item.name,
      primaryCode,
      imageUrl,
      ...('priceGTQ' in item
        ? {
            priceGTQ: item.priceGTQ ?? null,
            priceHNL: item.priceHNL ?? null,
            priceNIO: item.priceNIO ?? null,
            priceUSD: item.priceUSD ?? null,
            stock: item.stock,
          }
        : {}),
    };
    onSelect(chosen);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={styles.wrapper}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        className={`${styles.trigger} ${!value ? styles.placeholderTrigger : ''}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
      >
        {value ? (
          <span className={styles.selectedContent}>
            {value.imageUrl ? (
              <img
                src={value.imageUrl}
                alt={value.name}
                className={styles.thumbSmall}
              />
            ) : (
              <span className={styles.thumbPlaceholderSmall} aria-hidden="true">
                <Package size={15} />
              </span>
            )}
            <span className={styles.selectedText}>
              <span className={styles.selectedName}>{value.name}</span>
              {value.primaryCode ? (
                <span className={styles.selectedCode}>
                  [{value.primaryCode}]
                </span>
              ) : null}
            </span>
          </span>
        ) : (
          <span className={styles.placeholderContent}>
            <Search size={16} />
            <span>Buscar un producto...</span>
          </span>
        )}
        <ChevronDown size={16} className={styles.chevron} />
      </button>

      {isOpen ? (
        <div className={styles.dropdown}>
          <div className={styles.searchBox}>
            <Search size={15} className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="search"
              placeholder="Buscar un producto..."
              aria-label="Buscar un producto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isInitialLoading ? (
            <div className={styles.statusRow}>
              <SearchingIndicator label="Buscando..." />
            </div>
          ) : options.length === 0 ? (
            <div className={styles.statusRow}>
              No hay productos disponibles con esa búsqueda.
            </div>
          ) : (
            <ul
              role="listbox"
              aria-label="Resultados de productos"
              className={styles.optionsList}
              onScroll={handleListScroll}
            >
              {options.map((item) => {
                const localPrice = getLocalPrice(item, currency);
                const thumb = item.images[0]?.url;
                const primaryCode = item.codes[0]?.code ?? '';

                return (
                  <li key={item.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value?.id === item.id}
                      className={styles.optionBtn}
                      onClick={() => handleChoose(item)}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={item.name}
                          className={styles.optionThumb}
                        />
                      ) : (
                        <span
                          className={styles.optionThumbPlaceholder}
                          aria-hidden="true"
                        >
                          <Package size={18} />
                        </span>
                      )}

                      <span className={styles.optionInfo}>
                        <strong>{item.name}</strong>
                        <span className={styles.optionMeta}>
                          {primaryCode ? primaryCode : 'Sin código'}
                          {!isCustomerMode && 'stock' in item
                            ? ` · Stock: ${item.stock}`
                            : ''}
                        </span>
                      </span>

                      {!isCustomerMode ? (
                        <span className={styles.optionPrice}>
                          {localPrice !== null
                            ? formatCurrency(localPrice, currency)
                            : 'Sin precio'}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}

              {productsQuery.isFetchingNextPage ? (
                <li role="presentation" className={styles.loadMoreRow}>
                  <SearchingIndicator compact label="Buscando..." />
                </li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
