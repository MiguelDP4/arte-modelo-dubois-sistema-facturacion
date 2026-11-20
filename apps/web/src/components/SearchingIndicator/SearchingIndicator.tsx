'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import styles from './SearchingIndicator.module.scss';

interface SearchingIndicatorProps {
  label?: string;
  compact?: boolean;
}

export function SearchingIndicator({
  label = 'Buscando...',
  compact = false,
}: SearchingIndicatorProps) {
  return (
    <span
      className={`${styles.indicator} ${compact ? styles.compact : ''}`}
      role="status"
      aria-live="polite"
    >
      <Loader2
        size={compact ? 14 : 16}
        className={styles.spinner}
        data-testid="search-spinner"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
