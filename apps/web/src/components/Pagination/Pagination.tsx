'use client';

import React from 'react';
import { PAGE_SIZE_OPTIONS, type PaginationMeta } from '@arte-modelo/shared';
import styles from './Pagination.module.scss';

interface PaginationProps {
  pagination: PaginationMeta;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

export function Pagination({
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'registros',
}: PaginationProps) {
  const { page, total, totalPages, hasPrev, hasNext } = pagination;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <nav className={styles.bar} aria-label="Paginación de resultados">
      <span className={styles.summary}>
        {total === 0
          ? `0 ${itemLabel}`
          : `Mostrando ${start}–${end} de ${total} ${itemLabel}`}
      </span>

      <div className={styles.controls}>
        <label className={styles.pageSizeLabel}>
          <span>Por página</span>
          <select
            aria-label="Registros por página"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.navGroup}>
          <button
            type="button"
            className={styles.navBtn}
            disabled={!hasPrev}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </button>

          <span className={styles.pageInfo}>
            Página {page} de {totalPages}
          </span>

          <button
            type="button"
            className={styles.navBtn}
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </nav>
  );
}
