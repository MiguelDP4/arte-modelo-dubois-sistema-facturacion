import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import HomePage from '@/app/page';
import ConsignacionesPage from '@/app/consignaciones/page';
import OrderDetailPage from '@/app/pedidos/[id]/page';
import { apiClient } from '@/lib/api-client';
import { setMockParams, setMockPathname } from './setup';

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
      'dashboard.view_staff',
      'orders.read',
      'orders.create',
      'orders.confirm',
      'orders.manage',
      'orders.cancel',
      'payments.read',
      'payments.manage',
      'consignments.manage',
      'reports.read',
      'products.read_prices',
      'customers.read',
      'users.read',
    ],
  },
};

const customerSession = {
  data: {
    accessToken: 'cust-token',
    user: {
      id: 'cust-u-1',
      email: 'cliente@artemodelo.gt',
      fullName: 'Cliente Demo',
      phone: null,
      role: 'CUSTOMER',
      customerId: 'cust-1',
      isActive: true,
      isVerified: true,
      createdAt: '2026-01-01',
    },
    permissions: ['orders.read', 'orders.create', 'payments.read'],
  },
};

const consignmentOrder = {
  id: 'ord-cons-1',
  orderNumber: 'PED-2026-0004',
  customerId: 'cust-ni',
  customer: {
    id: 'cust-ni',
    companyName: 'Muebles Managua',
    managerName: 'Ernesto Solórzano',
    phone: '+505 2278-3340',
    email: 'gerencia@marcosmanagua.ni',
    country: 'NI',
    countryLabel: 'Nicaragua',
    currency: 'NIO',
    address: 'Managua',
    taxId: 'J0310000',
  },
  type: 'CONSIGNMENT',
  approvalStatus: 'CONFIRMED',
  fulfillmentStatus: 'PARTIALLY_DISPATCHED',
  paymentStatus: 'PARTIALLY_PAID',
  currency: 'NIO',
  pricesVisible: true,
  subtotal: 2700,
  itemsDiscountTotal: 0,
  shippingCost: 100,
  shippingDiscount: 0,
  returnedTotal: 900,
  totalAmount: 1900,
  amountPaid: 500,
  amountPending: 1400,
  consignmentDueDate: '2026-12-01',
  notes: null,
  createdBy: { id: 'admin-1', fullName: 'Admin Dubois' },
  confirmedBy: { id: 'admin-1', fullName: 'Admin Dubois' },
  confirmedAt: '2026-11-01',
  cancelledBy: null,
  cancelledAt: null,
  cancelReason: null,
  itemsCount: 1,
  dispatchesCount: 1,
  items: [
    {
      id: 'oi-1',
      orderId: 'ord-cons-1',
      productId: 'prod-1',
      productName: 'Marco Clásico Azul',
      productPrimaryCode: 'AMD-MC-4050',
      quantityOrdered: 3,
      quantityPacked: 3,
      quantityDispatched: 3,
      quantityReturned: 1,
      quantityPendingDispatch: 0,
      quantityNetConsigned: 2,
      quantityAvailableToReturn: 2,
      currentStock: 10,
      unitPrice: 900,
      discountType: 'FIXED',
      discountValue: 0,
      discountAmount: 0,
      lineTotal: 2700,
    },
  ],
  dispatches: [
    {
      id: 'disp-1',
      dispatchNumber: 1,
      dispatchedAt: '2026-11-05',
      carrier: 'TicaBus',
      notes: null,
      dispatchedBy: { id: 'admin-1', fullName: 'Admin Dubois' },
      items: [
        {
          id: 'di-1',
          orderItemId: 'oi-1',
          quantityDispatched: 3,
          cumulativeDispatched: 3,
          remainingPending: 0,
          orderItem: {
            id: 'oi-1',
            productName: 'Marco Clásico Azul',
            productPrimaryCode: 'AMD-MC-4050',
            quantityOrdered: 3,
          },
        },
      ],
    },
  ],
  payments: [
    {
      id: 'pay-1',
      orderId: 'ord-cons-1',
      amount: 500,
      method: 'TRANSFER',
      paymentDate: '2026-11-10',
      reference: 'TRANSF-123',
      receiptImageUrl: null,
      notes: 'Abono inicial',
      status: 'ACTIVE',
      voidReason: null,
      voidedAt: null,
      registeredBy: { id: 'admin-1', fullName: 'Admin Dubois' },
      voidedBy: null,
      createdAt: '2026-11-10',
    },
  ],
  consignmentReturns: [
    {
      id: 'ret-1',
      orderId: 'ord-cons-1',
      returnNumber: 1,
      returnedAt: '2026-11-12',
      notes: 'Unidad sin rotación',
      totalCredit: 900,
      receivedBy: { id: 'admin-1', fullName: 'Admin Dubois' },
      items: [
        {
          id: 'ri-1',
          orderItemId: 'oi-1',
          quantityReturned: 1,
          unitCredit: 900,
          lineCredit: 900,
          orderItem: {
            id: 'oi-1',
            productName: 'Marco Clásico Azul',
            productPrimaryCode: 'AMD-MC-4050',
          },
        },
      ],
    },
  ],
  createdAt: '2026-11-01',
  updatedAt: '2026-11-12',
};

describe('Phase 5 & Phase 6 Pages (Dashboard, Consignaciones, Payments, Returns, Excel)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockParams({});
  });

  it('renders Staff and Customer Dashboard KPIs, multi-currency receivables, consignments, and low stock', async () => {
    setMockPathname('/');
    mockedApi.post.mockResolvedValue(staffSession);
    mockedApi.get.mockResolvedValue({
      data: {
        role: 'ADMIN',
        staffCounts: {
          pendingConfirmationCount: 2,
          pendingPackingCount: 3,
          readyToDispatchCount: 1,
          partiallyDispatchedCount: 1,
        },
        receivableByCurrency: [
          { currency: 'GTQ', ordersWithBalance: 1, totalBilled: 1610, totalPaid: 800, totalPending: 810 },
          { currency: 'HNL', ordersWithBalance: 1, totalBilled: 2480, totalPaid: 0, totalPending: 2480 },
          { currency: 'NIO', ordersWithBalance: 1, totalBilled: 3810, totalPaid: 1200, totalPending: 2610 },
          { currency: 'USD', ordersWithBalance: 1, totalBilled: 144, totalPaid: 0, totalPending: 144 },
        ],
        upcomingConsignments: [
          {
            id: 'ord-cons-1',
            orderNumber: 'PED-2026-0004',
            customerId: 'cust-ni',
            customerName: 'Muebles Managua',
            currency: 'NIO',
            amountPending: 2610,
            fulfillmentStatus: 'COMPLETED',
            consignmentDueDate: '2026-12-01',
            daysRemaining: 11,
            isOverdue: false,
          },
        ],
        lowStockProducts: [
          {
            id: 'prod-low',
            name: 'Espejo Biselado Vino',
            primaryCode: 'AMD-ESP-6090',
            stock: 3,
            lowStockThreshold: 8,
          },
        ],
        recentOrders: [],
      },
    });

    const staffView = renderApp(<HomePage />);
    expect(
      await screen.findByText('Cuentas por Cobrar por Moneda'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Q\s*810\.00/)).toBeInTheDocument();
    expect(screen.getAllByText(/C\$\s*2,610\.00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Espejo Biselado Vino')).toBeInTheDocument();
    expect(screen.getByText(/PED-2026-0004/)).toBeInTheDocument();
    staffView.unmount();

    // Customer dashboard
    mockedApi.post.mockResolvedValue(customerSession);
    mockedApi.get.mockResolvedValue({
      data: {
        role: 'CUSTOMER',
        linked: true,
        customerCounts: { pendingConfirmation: 1, inProgress: 2, delivered: 4 },
        recentOrders: [
          {
            id: 'o1',
            orderNumber: 'PED-2026-0001',
            type: 'REGULAR',
            approvalStatus: 'CONFIRMED',
            fulfillmentStatus: 'COMPLETED',
            paymentStatus: 'PAID',
            currency: 'GTQ',
            pricesVisible: true,
            totalAmount: 1610,
            amountPending: 0,
            consignmentDueDate: null,
            createdAt: '2026-11-01',
          },
        ],
      },
    });

    renderApp(<HomePage />);
    expect(await screen.findByText('Tus Pedidos Recientes')).toBeInTheDocument();
    expect(screen.getByText('Pedidos en proceso')).toBeInTheDocument();
  });

  it('renders /consignaciones consolidated summary, filters, and downloads Excel', async () => {
    setMockPathname('/consignaciones');
    mockedApi.post.mockResolvedValue(staffSession);
    const createObjectUrlSpy = vi.fn(() => 'blob:mock');
    const revokeObjectUrlSpy = vi.fn();
    URL.createObjectURL = createObjectUrlSpy;
    URL.revokeObjectURL = revokeObjectUrlSpy;

    mockedApi.get.mockImplementation(async (url) => {
      if (url === '/orders/consignments') {
        return {
          data: {
            orders: [consignmentOrder],
            byCustomer: [
              {
                customerId: 'cust-ni',
                companyName: 'Muebles Managua',
                country: 'NI',
                countryLabel: 'Nicaragua',
                currency: 'NIO',
                ordersCount: 1,
                unitsOrdered: 3,
                unitsDispatched: 3,
                unitsReturned: 1,
                unitsNetInStore: 2,
                grossTotal: 2700,
                returnedCredit: 900,
                netTotal: 1900,
                amountPaid: 500,
                amountPending: 1400,
                nearestDueDate: '2026-12-01',
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
      return { data: new Blob(['xlsx']) };
    });

    renderApp(<ConsignacionesPage />);
    expect(
      await screen.findByText('Consolidado de Mercadería en Consignación por Cliente'),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText('Muebles Managua')).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2 uds\. en tienda/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByRole('button', { name: /Recibo \.xlsx/i })[0]);
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith(
        '/orders/ord-cons-1/excel',
        expect.objectContaining({
          params: { type: 'consignment' },
          responseType: 'blob',
        }),
      );
    });

    createObjectUrlSpy.mockReset();
    revokeObjectUrlSpy.mockReset();
  });

  it('supports payment registration, voiding, consignment returns, and Excel downloads on /pedidos/[id]', async () => {
    setMockPathname('/pedidos/ord-cons-1');
    setMockParams({ id: 'ord-cons-1' });
    mockedApi.post.mockImplementation(async (url) => {
      if (url === '/auth/refresh-token') return staffSession;
      if (url.endsWith('/payments')) return { data: { message: 'Abono registrado.' } };
      if (url.endsWith('/void')) return { data: { message: 'Abono anulado.' } };
      if (url.endsWith('/consignment-returns')) {
        return { data: { message: 'Devolución registrada.' } };
      }
      return { data: {} };
    });
    mockedApi.get.mockResolvedValue({ data: { order: consignmentOrder } });

    const createObjectUrlSpy = vi.fn(() => 'blob:mock');
    const revokeObjectUrlSpy = vi.fn();
    URL.createObjectURL = createObjectUrlSpy;
    URL.revokeObjectURL = revokeObjectUrlSpy;

    renderApp(<OrderDetailPage />);

    expect(await screen.findByText('Pagos y Abonos')).toBeInTheDocument();
    expect(screen.getByText('Control de Consignación y Devoluciones')).toBeInTheDocument();

    // Register payment
    fireEvent.click(screen.getByRole('button', { name: /Registrar abono/i }));
    const payDialog = within(screen.getByRole('dialog'));
    fireEvent.change(payDialog.getByLabelText(/Método de pago/i), {
      target: { value: 'CASH' },
    });
    fireEvent.change(payDialog.getByLabelText(/Monto del abono/i), {
      target: { value: '300' },
    });
    fireEvent.click(payDialog.getByRole('button', { name: 'Guardar abono' }));
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/orders/ord-cons-1/payments',
        expect.objectContaining({ amount: 300, method: 'CASH' }),
      );
    });

    // Void active payment
    fireEvent.click(screen.getByRole('button', { name: 'Anular abono' }));
    const voidDialog = within(screen.getByRole('dialog'));
    fireEvent.change(voidDialog.getByLabelText('Motivo de anulación'), {
      target: { value: 'Error de captura' },
    });
    fireEvent.click(voidDialog.getByRole('button', { name: 'Confirmar anulación' }));
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/orders/ord-cons-1/payments/pay-1/void',
        { voidReason: 'Error de captura' },
      );
    });

    // Consignment return
    fireEvent.click(screen.getByRole('button', { name: /Registrar devolución/i }));
    const retDialog = within(screen.getByRole('dialog'));
    fireEvent.change(retDialog.getByLabelText('Cantidad a devolver'), {
      target: { value: '1' },
    });
    fireEvent.click(retDialog.getByRole('button', { name: 'Registrar devolución' }));
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/orders/ord-cons-1/consignment-returns',
        expect.objectContaining({
          items: [{ orderItemId: 'oi-1', quantityReturned: 1 }],
        }),
      );
    });

    // Excel buttons
    fireEvent.click(screen.getByRole('button', { name: 'Factura .xlsx' }));
    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/orders/ord-cons-1/excel', {
        params: { type: 'invoice' },
        responseType: 'blob',
      });
    });

    createObjectUrlSpy.mockReset();
    revokeObjectUrlSpy.mockReset();
  });
});
