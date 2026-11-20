'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  SEARCH_DEBOUNCE_MS,
  type Currency,
  type PaginationMeta,
} from '@arte-modelo/shared';
import { Building2, ChevronDown, Search } from 'lucide-react';
import { SearchingIndicator } from '@/components/SearchingIndicator/SearchingIndicator';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient } from '@/lib/api-client';
import type { CustomerDto } from '@/types/customer';
import styles from './SearchSelect.module.scss';

export interface SelectedCustomerOption {
  id: string;
  companyName: string;
  managerName?: string;
  countryLabel: string;
  currency: Currency;
  taxLabel?: string;
  taxId?: string;
}

interface CustomerSearchSelectProps {
  id?: string;
  value: SelectedCustomerOption | null;
  disabled?: boolean;
  onSelect: (customer: SelectedCustomerOption) => void;
}

export function CustomerSearchSelect({
  id,
  value,
  disabled = false,
  onSelect,
}: CustomerSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const customersQuery = useInfiniteQuery({
    queryKey: ['order-customer-search', debouncedSearch],
    initialPageParam: 1,
    enabled: isOpen,
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string | number> = {
        page: Number(pageParam) || 1,
        pageSize: 10,
      };
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const res = await apiClient.get('/customers', { params });
      return {
        customers: (res.data.customers || []) as CustomerDto[],
        pagination: res.data.pagination as PaginationMeta | undefined,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasNext ? lastPage.pagination.page + 1 : undefined,
  });

  const options = useMemo(() => {
    const seen = new Set<string>();
    const list: CustomerDto[] = [];
    for (const pageData of customersQuery.data?.pages ?? []) {
      for (const customer of pageData.customers) {
        if (customer.isActive !== false && !seen.has(customer.id)) {
          seen.add(customer.id);
          list.push(customer);
        }
      }
    }
    return list;
  }, [customersQuery.data]);

  const isWaitingDebounce = search.trim() !== debouncedSearch.trim();
  const isInitialLoading =
    isWaitingDebounce ||
    customersQuery.isPending ||
    (customersQuery.isFetching && !customersQuery.isFetchingNextPage);

  const handleListScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (
      el.scrollTop > 0 &&
      distanceToBottom <= 2 &&
      customersQuery.hasNextPage &&
      !customersQuery.isFetchingNextPage
    ) {
      void customersQuery.fetchNextPage();
    }
  };

  const handleChoose = (customer: CustomerDto) => {
    onSelect({
      id: customer.id,
      companyName: customer.companyName,
      managerName: customer.managerName,
      countryLabel: customer.countryLabel,
      currency: customer.currency,
      taxLabel: customer.taxLabel,
      taxId: customer.taxId,
    });
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
            <span className={styles.thumbPlaceholderSmall} aria-hidden="true">
              <Building2 size={15} />
            </span>
            <span className={styles.selectedText}>
              <span className={styles.selectedName}>{value.companyName}</span>
              <span className={styles.selectedCode}>
                [{value.countryLabel} · {value.currency}]
              </span>
            </span>
          </span>
        ) : (
          <span className={styles.placeholderContent}>
            <Search size={16} />
            <span>Buscar un cliente...</span>
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
              placeholder="Buscar un cliente..."
              aria-label="Buscar un cliente"
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
              No hay clientes disponibles con esa búsqueda.
            </div>
          ) : (
            <ul
              role="listbox"
              aria-label="Resultados de clientes"
              className={styles.optionsList}
              onScroll={handleListScroll}
            >
              {options.map((customer) => (
                <li key={customer.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value?.id === customer.id}
                    className={styles.optionBtn}
                    onClick={() => handleChoose(customer)}
                  >
                    <span
                      className={styles.optionThumbPlaceholder}
                      aria-hidden="true"
                    >
                      <Building2 size={18} />
                    </span>

                    <span className={styles.optionInfo}>
                      <strong>{customer.companyName}</strong>
                      <span className={styles.optionMeta}>
                        {customer.managerName} · {customer.countryLabel}
                        {customer.taxId ? ` · ${customer.taxId}` : ''}
                      </span>
                    </span>

                    <span className={styles.optionBadge}>
                      {customer.currency}
                    </span>
                  </button>
                </li>
              ))}

              {customersQuery.isFetchingNextPage ? (
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
