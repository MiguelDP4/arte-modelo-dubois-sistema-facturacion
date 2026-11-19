'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell/AppShell';
import { OrderForm } from '@/components/Orders/OrderForm';

function NuevoPedidoInner() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId') || '';
  return <OrderForm mode="create" initialCustomerId={customerId} />;
}

export default function NuevoPedidoPage() {
  return (
    <AppShell requiredPermission="orders.create">
      <Suspense fallback={<p role="status">Cargando formulario...</p>}>
        <NuevoPedidoInner />
      </Suspense>
    </AppShell>
  );
}
