'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { ToastItem } from '@/contexts/ToastContext';
import styles from './ToastContainer.module.scss';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className={styles.container}
      role="region"
      aria-label="Notificaciones"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`${styles.toast} ${styles[toast.variant]}`}
        >
          <span className={styles.message}>{toast.message}</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => onDismiss(toast.id)}
            aria-label="Cerrar notificación"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
