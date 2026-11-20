'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell/AppShell';
import { OrderForm } from '@/components/Orders/OrderForm';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api-client';
import type { OrderDto } from '@/types/order';
import styles from './editar.module.scss';

function EditarPedidoContent() {
  const params = useParams<{ id: string }>();
  const orderId = String(params?.id || '');
  const { user } = useAuth();

  const orderQuery = useQuery({
    queryKey: ['order-detail', orderId],
    enabled: Boolean(orderId) && user?.role !== 'CUSTOMER',
    queryFn: async () => {
      const res = await apiClient.get(`/orders/${orderId}`);
      return res.data.order as OrderDto;
    },
  });

  if (user?.role === 'CUSTOMER') {
    return (
      <div className={styles.page}>
        <section className={styles.card}>
          <h1>Edición no disponible</h1>
          <p>
            Los pedidos no pueden editarse directamente después de enviarse.
            Comunícate con Arte Modelo Dubois si necesitas ajustar algo.
          </p>
          <Link href={`/pedidos/${orderId}`} className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Volver al pedido
          </Link>
        </section>
      </div>
    );
  }

  if (orderQuery.isLoading) {
    return <p role="status">Cargando pedido...</p>;
  }

  if (!orderQuery.data) {
    return (
      <div className={styles.page}>
        <section className={styles.card}>
          <h1>Pedido no encontrado</h1>
          <Link href="/pedidos" className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Volver a pedidos
          </Link>
        </section>
      </div>
    );
  }

  if (orderQuery.data.approvalStatus === 'CANCELLED') {
    return (
      <div className={styles.page}>
        <section className={styles.card}>
          <h1>Pedido cancelado</h1>
          <p>No es posible editar un pedido que ya fue cancelado.</p>
          <Link href={`/pedidos/${orderId}`} className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Volver al pedido
          </Link>
        </section>
      </div>
    );
  }

  return <OrderForm mode="edit" initialOrder={orderQuery.data} />;
}

export default function EditarPedidoPage() {
  return (
    <AppShell requiredPermission="orders.manage">
      <EditarPedidoContent />
    </AppShell>
  );
}
