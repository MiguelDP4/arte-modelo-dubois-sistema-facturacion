import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import PedidosPage from '@/app/pedidos/page';
import NuevoPedidoPage from '@/app/pedidos/nuevo/page';
import OrderDetailPage from '@/app/pedidos/[id]/page';
import EditarPedidoPage from '@/app/pedidos/[id]/editar/page';
import HomePage from '@/app/page';
import { apiClient } from '@/lib/api-client';
import {
  mockPush,
  setMockParams,
  setMockPathname,
  setMockSearchParams,
} from './setup';

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>(
    '@/lib/api-client',
  );
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const mockedApi = vi.mocked(apiClient, true);

function renderApp(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>{ui}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const staffSession = {
  data: {
    accessToken: 'staff-token',
    user: {
      id: 'admin-1',
      email: 'admin@artemodelo.gt',
      fullName: 'Admin Dubois',
      phone: null,
      role: 'ADMIN',
      customerId: null,
      isActive: true,
      isVerified: true,
      createdAt: '2026-01-01',
    },
    permissions: [
      'orders.read',
      'orders.create',
      'orders.confirm',
      'orders.manage',
      'orders.cancel',
      'products.read',
      'products.read_prices',
      'customers.read',
    ],
  },
};

const customerSession = {
  data: {
    accessToken: 'cust-token',
    user: {
      id: 'user-cust-1',
      email: 'cliente@elquetzal.gt',
      fullName: 'Cliente Quetzal',
      phone: null,
      role: 'CUSTOMER',
      customerId: 'cust-1',
      isActive: true,
      isVerified: true,
      createdAt: '2026-01-01',
    },
    permissions: ['orders.read', 'orders.create'],
  },
};

const sampleOrder = {
  id: 'ord-1',
  orderNumber: 'PED-2026-0001',
  customerId: 'cust-1',
  customer: {
    id: 'cust-1',
    companyName: 'Decoraciones El Quetzal, S.A.',
    managerName: 'Carlos Méndez',
    phone: '+502 2360-4411',
    email: 'compras@elquetzal.gt',
    country: 'GT',
    countryLabel: 'Guatemala',
    currency: 'GTQ',
    address: 'Zona 10, Guatemala',
    taxId: '4589123-4',
  },
  type: 'REGULAR',
  approvalStatus: 'PENDING_CONFIRMATION',
  fulfillmentStatus: 'PENDING_PACKING',
  paymentStatus: 'PENDING_PAYMENT',
  currency: 'GTQ',
  pricesVisible: true,
  subtotal: 700,
  itemsDiscountTotal: 0,
  shippingCost: 40,
  shippingDiscount: 10,
  totalAmount: 730,
  amountPaid: 0,
  amountPending: 730,
  consignmentDueDate: null,
  notes: 'Entregar en bodega',
  createdBy: { id: 'user-cust-1', fullName: 'Cliente Quetzal' },
  confirmedBy: null,
  confirmedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  cancelReason: null,
  itemsCount: 1,
  dispatchesCount: 0,
  items: [
    {
      id: 'oi-1',
      orderId: 'ord-1',
      productId: 'prod-1',
      productName: 'Marco Clásico Azul',
      productPrimaryCode: 'AMD-MC-01',
      quantityOrdered: 4,
      quantityPacked: 0,
      quantityDispatched: 0,
      quantityPendingDispatch: 4,
      currentStock: 10,
      unitPrice: 175,
      discountType: 'FIXED',
      discountValue: 0,
      discountAmount: 0,
      lineTotal: 700,
    },
  ],
  dispatches: [],
  createdAt: '2026-01-10',
  updatedAt: '2026-01-10',
};

describe('Orders Module Pages (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    setMockSearchParams({});
    setMockParams({});
  });

  it('lists orders with 3 decoupled badges and supports pageSize=0 (Todos) pagination', async () => {
    setMockPathname('/pedidos');
    mockedApi.post.mockResolvedValue(staffSession);
    mockedApi.get.mockResolvedValue({
      data: {
        orders: [sampleOrder],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
      },
    });

    renderApp(<PedidosPage />);

    await waitFor(() => {
      expect(screen.getAllByText('PED-2026-0001').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Por confirmar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Por empacar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pendiente de pago').length).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByLabelText('Registros por página'), {
      target: { value: '0' },
    });

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/orders', {
        params: expect.objectContaining({ page: 1, pageSize: 0 }),
      });
    });
  });

  it('renders /pedidos/nuevo for staff with last-price tooltip and creates confirmed order', async () => {
    setMockPathname('/pedidos/nuevo');
    mockedApi.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh-token') return staffSession;
      if (url === '/orders') {
        return { data: { order: sampleOrder, message: 'Pedido creado y confirmado.' } };
      }
      return { data: {} };
    });

    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/customers') {
        return {
          data: {
            customers: [
              {
                id: 'cust-1',
                companyName: 'Decoraciones El Quetzal, S.A.',
                managerName: 'Carlos Méndez',
                countryLabel: 'Guatemala',
                currency: 'GTQ',
                taxLabel: 'NIT',
                taxId: '4589123-4',
                isActive: true,
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
              hasPrev: false,
              hasNext: false,
            },
          },
        };
      }
      if (url === '/products') {
        return {
          data: {
            products: [
              {
                id: 'prod-1',
                name: 'Marco Clásico Azul',
                priceGTQ: 185,
                priceHNL: 610,
                priceNIO: 890,
                priceUSD: 24,
                stock: 15,
                codes: [{ code: 'AMD-MC-01', label: 'Interno', isPrimary: true }],
                images: [{ url: '/seed/marco-clasico.svg', altText: 'Marco' }],
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
              hasPrev: false,
              hasNext: false,
            },
          },
        };
      }
      if (url === '/orders/last-price') {
        return {
          data: {
            customerId: 'cust-1',
            productId: 'prod-1',
            currency: 'GTQ',
            catalogPrice: 185,
            lastPrice: 175,
            lastOrderNumber: 'PED-2026-0000',
            lastOrderDate: '2026-01-01',
            hasHistory: true,
          },
        };
      }
      return { data: {} };
    });

    renderApp(<NuevoPedidoPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Cliente')).toBeInTheDocument();
    });

    expect(mockedApi.get).not.toHaveBeenCalledWith('/customers', expect.anything());
    expect(screen.queryByText(/Línea #1/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar producto' })).toHaveTextContent('');
    expect(screen.queryByLabelText('Tipo descuento')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Cliente'));
    fireEvent.click(
      await screen.findByRole('option', { name: /Decoraciones El Quetzal/i }),
    );
    expect(mockedApi.get).toHaveBeenCalledWith('/customers', {
      params: { page: 1, pageSize: 10 },
    });

    fireEvent.click(screen.getByLabelText('Producto'));
    fireEvent.click(
      await screen.findByRole('option', { name: /Marco Clásico Azul/i }),
    );

    const tooltipBtn = await screen.findByRole('button', {
      name: 'Ver último precio línea 1',
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    const priceInput = screen.getByLabelText(/Precio unit\./i);
    fireEvent.mouseEnter(priceInput);
    fireEvent.focus(priceInput);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(tooltipBtn);
    expect(
      screen.getByText(/Último precio aplicado a este cliente:/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/PED-2026-0000/i)).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(tooltipBtn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(tooltipBtn);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar último precio' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descuento de línea' }));
    expect(screen.getByLabelText('Tipo descuento')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '4' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Crear y confirmar pedido' }),
    );

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/orders',
        expect.objectContaining({
          customerId: 'cust-1',
          items: expect.arrayContaining([
            expect.objectContaining({
              productId: 'prod-1',
              quantityOrdered: 4,
              unitPrice: 175,
            }),
          ]),
        }),
      );
    });
    expect(mockPush).toHaveBeenCalledWith('/pedidos/ord-1');
  });

  it('renders /pedidos/nuevo for CUSTOMER without prices or shipping and submits pending order', async () => {
    setMockPathname('/pedidos/nuevo');
    mockedApi.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh-token') return customerSession;
      if (url === '/orders') {
        return { data: { order: sampleOrder, message: 'Pedido enviado.' } };
      }
      return { data: {} };
    });
    mockedApi.get.mockResolvedValue({
      data: {
        products: [
          {
            id: 'prod-1',
            name: 'Marco Clásico Azul',
            codes: [{ code: 'AMD-MC-01', label: 'Interno', isPrimary: true }],
            images: [],
          },
        ],
      },
    });

    renderApp(<NuevoPedidoPage />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    expect(screen.queryByLabelText('Cliente')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Flete/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Precio unit\./i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Descuento de línea' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(
      await screen.findByRole('option', { name: /Marco Clásico Azul/i }),
    );
    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar pedido para confirmación' }),
    );

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/orders', {
        notes: null,
        items: [{ productId: 'prod-1', quantityOrdered: 3 }],
      });
    });
  });

  it('supports confirm, delta pack, partial dispatch, and logical cancellation on /pedidos/[id]', async () => {
    setMockPathname('/pedidos/ord-1');
    setMockParams({ id: 'ord-1' });

    const confirmedOrder = {
      ...sampleOrder,
      approvalStatus: 'CONFIRMED',
      items: [{ ...sampleOrder.items[0], quantityPacked: 2 }],
    };

    mockedApi.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh-token') return staffSession;
      if (url.endsWith('/confirm')) return { data: { message: 'Confirmado.' } };
      if (url.endsWith('/pack')) return { data: { message: 'Empacado.' } };
      if (url.endsWith('/dispatches')) return { data: { message: 'Despachado.' } };
      if (url.endsWith('/cancel')) return { data: { message: 'Cancelado.' } };
      return { data: {} };
    });

    let detailCallCount = 0;
    mockedApi.get.mockImplementation(async () => {
      detailCallCount += 1;
      return {
        data: {
          order: detailCallCount <= 2 ? sampleOrder : confirmedOrder,
        },
      };
    });

    renderApp(<OrderDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'PED-2026-0001' }),
      ).toBeInTheDocument();
    });

    // Confirm pending order via ConfirmModal
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pedido/i }));
    const confirmDialog = within(screen.getByRole('dialog'));
    fireEvent.click(
      confirmDialog.getByRole('button', { name: 'Confirmar pedido' }),
    );

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/orders/ord-1/confirm', {});
    });

    // Cancel pending order modal (testing cancel flow before switching to confirmed view)
    fireEvent.click(screen.getByRole('button', { name: /Cancelar pedido/i }));
    const cancelDialog = within(screen.getByRole('dialog'));
    fireEvent.change(cancelDialog.getByLabelText('Motivo de cancelación'), {
      target: { value: 'Prueba de cancelación lógica' },
    });
    fireEvent.click(
      cancelDialog.getByRole('button', { name: 'Confirmar cancelación' }),
    );

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/orders/ord-1/cancel', {
        cancelReason: 'Prueba de cancelación lógica',
      });
    });

    // Pack modal with delta badge & Dispatch modal on confirmed order
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Empacar/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Empacar/i }));
    const packDialog = within(screen.getByRole('dialog'));
    fireEvent.change(packDialog.getByLabelText('Total empacado'), {
      target: { value: '4' },
    });
    expect(packDialog.getByText('Delta: -2 de stock')).toBeInTheDocument();
    fireEvent.click(packDialog.getByRole('button', { name: 'Guardar empaque' }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/orders/ord-1/pack', {
        items: [{ orderItemId: 'oi-1', quantityPacked: 4 }],
        notes: null,
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /Despachar/i }));
    const dispDialog = within(screen.getByRole('dialog'));
    fireEvent.change(dispDialog.getByLabelText('Transporte / Mensajero'), {
      target: { value: 'Guatex' },
    });
    fireEvent.click(
      dispDialog.getByRole('button', { name: 'Registrar despacho' }),
    );

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/orders/ord-1/dispatches', {
        carrier: 'Guatex',
        notes: null,
        items: [{ orderItemId: 'oi-1', quantityToDispatch: 2 }],
      });
    });
  });

  it('masks prices for CUSTOMER pending orders, blocks CUSTOMER on /editar, and allows staff PATCH on /editar', async () => {
    setMockPathname('/pedidos/ord-1/editar');
    setMockParams({ id: 'ord-1' });
    mockedApi.post.mockResolvedValue(customerSession);

    const { unmount } = renderApp(<EditarPedidoPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Acceso restringido' }),
      ).toBeInTheDocument();
    });
    unmount();

    // Staff edits order on /pedidos/[id]/editar
    mockedApi.post.mockResolvedValue(staffSession);
    mockedApi.patch.mockResolvedValue({
      data: { order: sampleOrder, message: 'Pedido actualizado.' },
    });
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/orders/ord-1') {
        return { data: { order: sampleOrder } };
      }
      if (url === '/products') {
        return {
          data: {
            products: [
              {
                id: 'prod-1',
                name: 'Marco Clásico Azul',
                priceGTQ: 185,
                stock: 15,
                codes: [{ code: 'AMD-MC-01', label: 'Interno', isPrimary: true }],
              },
            ],
          },
        };
      }
      return {
        data: {
          hasHistory: true,
          lastPrice: 175,
          catalogPrice: 185,
          lastOrderNumber: 'PED-2026-0001',
        },
      };
    });

    const editRender = renderApp(<EditarPedidoPage />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Editar Pedido PED-2026-0001/i }),
      ).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Flete \/ Envío/i), {
      target: { value: '60' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar cambios del pedido' }),
    );
    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/orders/ord-1',
        expect.objectContaining({ shippingCost: 60 }),
      );
    });
    editRender.unmount();

    setMockPathname('/pedidos/ord-1');
    mockedApi.post.mockResolvedValue(customerSession);
    mockedApi.get.mockResolvedValue({
      data: {
        order: {
          ...sampleOrder,
          pricesVisible: false,
          subtotal: null,
          totalAmount: null,
          amountPending: null,
          items: [
            {
              ...sampleOrder.items[0],
              unitPrice: null,
              lineTotal: null,
            },
          ],
        },
      },
    });

    renderApp(<OrderDetailPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/estarán disponibles en cuanto un asesor/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Empacar/i })).not.toBeInTheDocument();
  });

  it('handles edge cases across Dashboard, CONSIGNMENT lines, unlinked customers, and /editar states', async () => {
    setMockPathname('/');
    mockedApi.post.mockResolvedValue(staffSession);
    const dash = renderApp(<HomePage />);
    await waitFor(() => {
      expect(screen.getByText('Pedidos y Despachos')).toBeInTheDocument();
      expect(screen.getByText('Productos e Inventario')).toBeInTheDocument();
      expect(screen.getByText('Cartera de Clientes')).toBeInTheDocument();
    });
    dash.unmount();

    // Unlinked CUSTOMER notice on /pedidos/nuevo
    setMockPathname('/pedidos/nuevo');
    mockedApi.post.mockResolvedValue({
      data: {
        ...customerSession.data,
        user: { ...customerSession.data.user, customerId: null },
      },
    });
    mockedApi.get.mockResolvedValue({ data: { products: [] } });
    const unlinked = renderApp(<NuevoPedidoPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/Tu cuenta aún no está vinculada/i),
      ).toBeInTheDocument();
    });
    unlinked.unmount();

    // Staff CONSIGNMENT toggle + add/remove lines + no tooltip when hasHistory=false + initialCustomerId preload
    setMockSearchParams({ customerId: 'cust-1' });
    mockedApi.post.mockResolvedValue(staffSession);
    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/customers/cust-1') {
        return {
          data: {
            customer: {
              id: 'cust-1',
              companyName: 'Decoraciones El Quetzal, S.A.',
              managerName: 'Carlos Méndez',
              countryLabel: 'Guatemala',
              currency: 'GTQ',
              taxLabel: 'NIT',
              taxId: '4589123-4',
              isActive: true,
            },
          },
        };
      }
      if (url === '/customers') {
        return {
          data: {
            customers: [
              {
                id: 'cust-1',
                companyName: 'Decoraciones El Quetzal, S.A.',
                managerName: 'Carlos Méndez',
                countryLabel: 'Guatemala',
                currency: 'GTQ',
                taxLabel: 'NIT',
                taxId: '4589123-4',
                isActive: true,
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
              hasPrev: false,
              hasNext: false,
            },
          },
        };
      }
      if (url === '/products') {
        return {
          data: {
            products: [
              {
                id: 'prod-new',
                name: 'Espejo Nuevo',
                priceGTQ: 320,
                stock: 8,
                codes: [{ code: 'AMD-ESP', label: 'Interno', isPrimary: true }],
                images: [],
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              total: 1,
              totalPages: 1,
              hasPrev: false,
              hasNext: false,
            },
          },
        };
      }
      if (url === '/orders/last-price') {
        return {
          data: {
            customerId: 'cust-1',
            productId: 'prod-new',
            currency: 'GTQ',
            catalogPrice: 320,
            lastPrice: null,
            lastOrderNumber: null,
            lastOrderDate: null,
            hasHistory: false,
          },
        };
      }
      return { data: {} };
    });
    const newStaff = renderApp(<NuevoPedidoPage />);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/customers/cust-1');
      expect(screen.getByText('[Guatemala · GTQ]')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Cliente'));
    fireEvent.click(
      await screen.findByRole('option', { name: /Decoraciones El Quetzal/i }),
    );
    fireEvent.click(screen.getByLabelText('Producto'));
    fireEvent.click(
      await screen.findByRole('option', { name: /Espejo Nuevo/i }),
    );
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/orders/last-price',
        expect.anything(),
      );
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText(/sin historial/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Último precio aplicado a este cliente:/i),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Tipo de pedido'), {
      target: { value: 'CONSIGNMENT' },
    });
    expect(
      screen.getByLabelText('Fecha sugerida de revisión'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Agregar producto/i }));
    expect(screen.getAllByRole('button', { name: 'Quitar producto' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Quitar producto' })[1]);
    expect(screen.getAllByRole('button', { name: 'Quitar producto' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Quitar producto' })).toBeDisabled();
    newStaff.unmount();

    // EditarPedidoPage: CANCELLED and not-found states
    setMockPathname('/pedidos/ord-cancelled/editar');
    setMockParams({ id: 'ord-cancelled' });
    mockedApi.get.mockResolvedValue({
      data: { order: { ...sampleOrder, approvalStatus: 'CANCELLED' } },
    });
    const cancelledEdit = renderApp(<EditarPedidoPage />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Pedido cancelado' }),
      ).toBeInTheDocument();
    });
    cancelledEdit.unmount();

    mockedApi.get.mockResolvedValue({ data: { order: null } });
    const missingEdit = renderApp(<EditarPedidoPage />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Pedido no encontrado' }),
      ).toBeInTheDocument();
    });
    missingEdit.unmount();

    // Customer who somehow has orders.manage gets blocked by EditarPedidoContent guard too
    mockedApi.post.mockResolvedValue({
      data: {
        ...customerSession.data,
        permissions: ['orders.read', 'orders.manage'],
      },
    });
    const custGuard = renderApp(<EditarPedidoPage />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Edición no disponible' }),
      ).toBeInTheDocument();
    });
    custGuard.unmount();
  });
});
