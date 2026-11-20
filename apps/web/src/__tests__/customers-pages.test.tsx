import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import ClientesPage from '@/app/clientes/page';
import ClienteDetallePage from '@/app/clientes/[id]/page';
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
      isActive: true,
      isVerified: true,
      createdAt: '2026-01-01',
    },
    permissions: ['customers.read', 'customers.manage'],
  },
};

const sampleCustomer = {
  id: 'cust-1',
  companyName: 'Decoraciones El Quetzal, S.A.',
  managerName: 'Carlos Méndez',
  phone: '+502 2360-4411',
  email: 'compras@elquetzal.gt',
  country: 'GT',
  countryLabel: 'Guatemala',
  currency: 'GTQ',
  taxLabel: 'NIT',
  address: 'Zona 10, Guatemala',
  taxId: '4589123-4',
  notes: 'Cliente VIP',
  isActive: true,
  deletedAt: null,
  linkedUsersCount: 1,
  users: [
    {
      id: 'u-cust-1',
      fullName: 'Cliente Demo',
      email: 'cliente@artemodelo.gt',
      phone: '+502 5555-0003',
      isVerified: true,
    },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('Clientes & ClienteDetalle pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders /clientes, dynamically switches tax label by country on creation, and confirms deactivation', async () => {
    setMockPathname('/clientes');
    mockedApi.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh-token') return staffSession;
      if (url === '/customers') return { data: { message: 'Cliente creado.' } };
      return { data: {} };
    });

    mockedApi.get.mockResolvedValue({
      data: {
        customers: [sampleCustomer],
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

    mockedApi.delete.mockResolvedValue({
      data: { message: 'Cliente desactivado correctamente.' },
    });

    renderApp(<ClientesPage />);

    await waitFor(() => {
      expect(
        screen.getAllByText('Decoraciones El Quetzal, S.A.').length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Nuevo cliente/i }));

    const dialog = within(screen.getByRole('dialog'));
    // Initially GT -> NIT, change to HN -> RTN
    expect(dialog.getByLabelText('NIT')).toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText('País'), {
      target: { value: 'HN' },
    });
    expect(dialog.getByLabelText('RTN')).toBeInTheDocument();
    expect(dialog.getByText('HNL')).toBeInTheDocument();

    fireEvent.change(dialog.getByLabelText('Nombre de empresa'), {
      target: { value: 'Galería Sula' },
    });
    fireEvent.change(dialog.getByLabelText('Encargado / Contacto'), {
      target: { value: 'Maritza' },
    });
    fireEvent.change(dialog.getByLabelText('Teléfono'), {
      target: { value: '+504 2550-0000' },
    });
    fireEvent.change(dialog.getByLabelText('Correo electrónico'), {
      target: { value: 'info@sula.hn' },
    });
    fireEvent.change(dialog.getByLabelText('RTN'), {
      target: { value: '05019012345678' },
    });
    fireEvent.change(dialog.getByLabelText('Dirección de entrega / fiscal'), {
      target: { value: 'San Pedro Sula' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar cliente' }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/customers',
        expect.objectContaining({ country: 'HN', taxId: '05019012345678' }),
      );
    });

    // Deactivate confirmation modal
    fireEvent.click(screen.getAllByRole('button', { name: /Desactivar/i })[0]);
    const confirmBtns = screen.getAllByRole('button', { name: 'Desactivar' });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith('/customers/cust-1');
    });
  });

  it('renders /clientes/[id] fiscal card and links/unlinks CUSTOMER accounts', async () => {
    setMockPathname('/clientes/cust-1');
    setMockParams({ id: 'cust-1' });

    mockedApi.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh-token') return staffSession;
      if (url === '/customers/cust-1/users') {
        return { data: { message: 'Usuario vinculado correctamente.' } };
      }
      return { data: {} };
    });

    mockedApi.get.mockImplementation(async (url: string) => {
      if (url === '/customers/unlinked-users') {
        return {
          data: {
            users: [
              {
                id: 'u-free',
                fullName: 'Sofía Regional',
                email: 'sofia@hn.com',
                phone: null,
                isVerified: true,
              },
            ],
          },
        };
      }
      return {
        data: {
          customer: sampleCustomer,
          orders: [
            {
              id: 'ord-1',
              orderNumber: 'PED-2026-0001',
              type: 'CONSIGNMENT',
              approvalStatus: 'CONFIRMED',
              fulfillmentStatus: 'PARTIALLY_DISPATCHED',
              paymentStatus: 'PARTIALLY_PAID',
              currency: 'GTQ',
              totalAmount: 1610,
              amountPending: 800,
              consignmentDueDate: null,
              createdAt: '2026-01-10',
            },
          ],
        },
      };
    });

    mockedApi.delete.mockResolvedValue({
      data: { message: 'Usuario desvinculado correctamente.' },
    });

    renderApp(<ClienteDetallePage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Decoraciones El Quetzal, S.A.' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('PED-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Consignación')).toBeInTheDocument();
    expect(screen.getByText('Despacho parcial')).toBeInTheDocument();
    expect(screen.getByText('Guatemala (GTQ)')).toBeInTheDocument();
    expect(screen.getByText('4589123-4')).toBeInTheDocument();

    // Link available user
    fireEvent.change(
      screen.getByLabelText('Vincular cuenta con rol Cliente'),
      { target: { value: 'u-free' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Vincular$/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/customers/cust-1/users', {
        userId: 'u-free',
      });
    });

    // Unlink existing user
    fireEvent.click(screen.getByRole('button', { name: /Desvincular/i }));
    const confirmUnlink = screen.getAllByRole('button', { name: 'Desvincular' });
    fireEvent.click(confirmUnlink[confirmUnlink.length - 1]);

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith(
        '/customers/cust-1/users/u-cust-1',
      );
    });
  });
});
