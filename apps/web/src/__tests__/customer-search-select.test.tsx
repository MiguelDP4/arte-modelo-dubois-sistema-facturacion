import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerSearchSelect } from '@/components/Orders/CustomerSearchSelect';
import { apiClient } from '@/lib/api-client';

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

function renderSelect(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('CustomerSearchSelect', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not fetch on mount, displays active customers with country/currency, and selects customer', async () => {
    const onSelect = vi.fn();
    mockedApi.get.mockResolvedValue({
      data: {
        customers: [
          {
            id: 'cust-1',
            companyName: 'Decoraciones El Quetzal, S.A.',
            managerName: 'Carlos Méndez',
            country: 'GT',
            countryLabel: 'Guatemala',
            currency: 'GTQ',
            taxLabel: 'NIT',
            taxId: '4589123-4',
            isActive: true,
          },
          {
            id: 'cust-inactive',
            companyName: 'Cliente Inactivo',
            managerName: 'Sin Uso',
            country: 'GT',
            countryLabel: 'Guatemala',
            currency: 'GTQ',
            taxLabel: 'NIT',
            taxId: '999',
            isActive: false,
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
    });

    renderSelect(
      <CustomerSearchSelect id="cust-select-1" value={null} onSelect={onSelect} />,
    );

    expect(mockedApi.get).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('combobox'));
    expect(
      screen.getByPlaceholderText('Buscar un cliente...'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/customers', {
        params: { page: 1, pageSize: 10 },
      });
    });

    expect(
      await screen.findByText('Decoraciones El Quetzal, S.A.'),
    ).toBeInTheDocument();
    expect(screen.getByText('GTQ')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Inactivo')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('option', { name: /Decoraciones El Quetzal/i }),
    );
    expect(onSelect).toHaveBeenCalledWith({
      id: 'cust-1',
      companyName: 'Decoraciones El Quetzal, S.A.',
      managerName: 'Carlos Méndez',
      countryLabel: 'Guatemala',
      currency: 'GTQ',
      taxLabel: 'NIT',
      taxId: '4589123-4',
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows Buscando... with spinner during 1000ms debounce before sending search request', async () => {
    vi.useFakeTimers();
    mockedApi.get.mockResolvedValue({
      data: {
        customers: [],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
      },
    });

    renderSelect(<CustomerSearchSelect value={null} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('combobox'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mockedApi.get).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText('Buscar un cliente...');
    fireEvent.change(searchInput, { target: { value: 'Sula' } });
    expect(screen.getByText('Buscando...')).toBeInTheDocument();
    expect(screen.getByTestId('search-spinner')).toBeInTheDocument();
    expect(screen.queryByText(/Esperando 1/i)).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(950);
    });
    expect(mockedApi.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
    expect(mockedApi.get).toHaveBeenLastCalledWith('/customers', {
      params: { page: 1, pageSize: 10, search: 'Sula' },
    });
  });

  it('lazy loads page 2 when scrolling to the bottom and supports disabled/Escape/outside click', async () => {
    mockedApi.get.mockImplementation(async (_url, config) => {
      const page = (config?.params as { page?: number })?.page ?? 1;
      if (page === 1) {
        return {
          data: {
            customers: [
              {
                id: 'cust-1',
                companyName: 'Cliente Página 1',
                managerName: 'Ana López',
                countryLabel: 'Guatemala',
                currency: 'GTQ',
                taxId: '111-1',
                isActive: true,
              },
            ],
            pagination: {
              page: 1,
              pageSize: 10,
              total: 12,
              totalPages: 2,
              hasPrev: false,
              hasNext: true,
            },
          },
        };
      }
      return {
        data: {
          customers: [
            {
              id: 'cust-11',
              companyName: 'Cliente Página 2',
              managerName: 'Luis Pérez',
              countryLabel: 'Honduras',
              currency: 'HNL',
              taxId: '222-2',
              isActive: true,
            },
          ],
          pagination: {
            page: 2,
            pageSize: 10,
            total: 12,
            totalPages: 2,
            hasPrev: true,
            hasNext: false,
          },
        },
      };
    });

    const { rerender } = renderSelect(
      <CustomerSearchSelect value={null} onSelect={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Cliente Página 1')).toBeInTheDocument();

    const list = screen.getByRole('listbox', {
      name: 'Resultados de clientes',
    });
    Object.defineProperty(list, 'scrollHeight', { value: 600, configurable: true });
    Object.defineProperty(list, 'clientHeight', { value: 280, configurable: true });
    Object.defineProperty(list, 'scrollTop', { value: 310, configurable: true });
    fireEvent.scroll(list);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/customers', {
        params: { page: 2, pageSize: 10 },
      });
    });

    expect(await screen.findByText('Cliente Página 1')).toBeInTheDocument();
    expect(await screen.findByText('Cliente Página 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByPlaceholderText('Buscar un cliente...')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByPlaceholderText('Buscar un cliente...'),
    ).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <CustomerSearchSelect
          value={{
            id: 'cust-1',
            companyName: 'Cliente Página 1',
            countryLabel: 'Guatemala',
            currency: 'GTQ',
          }}
          disabled
          onSelect={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText('[Guatemala · GTQ]')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
