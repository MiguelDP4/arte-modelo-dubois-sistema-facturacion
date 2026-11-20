'use client';

import React from 'react';
import {
  APPROVAL_STATUS_LABELS,
  FULFILLMENT_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  type ApprovalStatus,
  type FulfillmentStatus,
  type OrderType,
  type PaymentStatus,
} from '@arte-modelo/shared';
import styles from './OrderStatusBadges.module.scss';

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const tone =
    status === 'CONFIRMED'
      ? styles.success
      : status === 'PENDING_CONFIRMATION'
        ? styles.warning
        : styles.danger;
  return (
    <span className={`${styles.badge} ${tone}`}>
      {APPROVAL_STATUS_LABELS[status]}
    </span>
  );
}

export function FulfillmentBadge({ status }: { status: FulfillmentStatus }) {
  const tone =
    status === 'COMPLETED'
      ? styles.success
      : status === 'PARTIALLY_DISPATCHED' || status === 'READY_TO_DISPATCH'
        ? styles.info
        : status === 'PACKING'
          ? styles.warning
          : styles.neutral;
  return (
    <span className={`${styles.badge} ${tone}`}>
      {FULFILLMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === 'PAID'
      ? styles.success
      : status === 'PARTIALLY_PAID'
        ? styles.warning
        : styles.neutral;
  return (
    <span className={`${styles.badge} ${tone}`}>
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function OrderTypeBadge({ type }: { type: OrderType }) {
  return (
    <span
      className={`${styles.badge} ${
        type === 'CONSIGNMENT' ? styles.brand : styles.neutral
      }`}
    >
      {ORDER_TYPE_LABELS[type]}
    </span>
  );
}
