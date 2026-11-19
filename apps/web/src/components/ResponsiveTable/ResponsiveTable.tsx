'use client';

import React from 'react';
import styles from './ResponsiveTable.module.scss';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
}

interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  ariaLabel?: string;
}

export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage = 'No hay registros para mostrar.',
  ariaLabel = 'Tabla de registros',
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return <div className={styles.emptyState}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.mobileCards} data-testid="responsive-table-cards">
        {data.map((row) => (
          <article key={rowKey(row)} className={styles.card}>
            {columns.map((col) => (
              <div key={col.key} className={styles.cardRow}>
                <span className={styles.cardLabel}>{col.header}</span>
                <div className={styles.cardValue}>{col.render(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>

      <table className={styles.desktopTable} aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
