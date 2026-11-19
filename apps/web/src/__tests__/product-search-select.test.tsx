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
import { ProductSearchSelect } from '@/components/Orders/ProductSearchSelect';
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

describe('ProductSearchSelect', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not fetch on mount, displays thumbnail + local currency price for staff, and filters excluded IDs', async () => {
    const onSelect = vi.fn();
    mockedApi.get.mockResolvedValue({
      data: {
        products: [
          {
            id: 'prod-1',
            name: 'Marco Clásico Azul',
            priceGTQ: 185,
            priceHNL: 610,
            stock: 12,
            codes: [{ code: 'AMD-MC-01', label: 'Interno', isPrimary: true }],
            images: [{ url: '/seed/marco-clasico.svg', altText: 'Marco' }],
          },
          {
            id: 'prod-excluded',
            name: 'Producto Ya Agregado',
            priceGTQ: 99,
            priceHNL: 300,
            stock: 5,
            codes: [{ code: 'AMD-EX-02', label: 'Interno', isPrimary: true }],
            images: [],
          },
        ],
      },
    });

    renderSelect(
      <ProductSearchSelect
        id="prod-select-1"
        value={null}
        excludedProductIds={['prod-excluded']}
        currency="HNL"
        isCustomerMode={false}
        onSelect={onSelect}
      />,
    );

    expect(mockedApi.get).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('combobox'));
    expect(
      screen.getByPlaceholderText('Buscar un producto...'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/products', {
        params: {
          page: 1,
          pageSize: 10,
          excludeIds: 'prod-excluded',
        },
      });
    });

    expect(await screen.findByText('Marco Clásico Azul')).toBeInTheDocument();
    expect(screen.getByAltText('Marco Clásico Azul')).toHaveAttribute(
      'src',
      '/seed/marco-clasico.svg',
    );
    expect(screen.getByText(/L\s*610\.00/)).toBeInTheDocument();
    expect(screen.queryByText('Producto Ya Agregado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /Marco Clásico Azul/i }));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'prod-1',
        name: 'Marco Clásico Azul',
        primaryCode: 'AMD-MC-01',
        imageUrl: '/seed/marco-clasico.svg',
        priceHNL: 610,
      }),
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('waits 1000ms debounce before sending typed search requests to the API', async () => {
    vi.useFakeTimers();
    mockedApi.get.mockResolvedValue({ data: { products: [] } });

    renderSelect(
      <ProductSearchSelect
        value={null}
        excludedProductIds={[]}
        currency="GTQ"
        isCustomerMode={false}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(mockedApi.get).toHaveBeenCalledTimes(1);

    const searchInput = screen.getByPlaceholderText('Buscar un producto...');
    fireEvent.change(searchInput, { target: { value: 'Espejo' } });
    expect(
      screen.getByText('Esperando 1 segundo para buscar...'),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(950);
    });
    expect(mockedApi.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
    expect(mockedApi.get).toHaveBeenLastCalledWith('/products', {
      params: {
        page: 1,
        pageSize: 10,
        search: 'Espejo',
      },
    });
  });

  it('queries /catalog without prices/stock in customer mode and closes on Escape or outside click', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        products: [
          {
            id: 'prod-1',
            name: 'Marco Público',
            codes: [{ code: 'AMD-PUB-1', label: 'Interno', isPrimary: true }],
            images: [],
          },
        ],
      },
    });

    renderSelect(
      <ProductSearchSelect
        value={null}
        excludedProductIds={[]}
        currency="GTQ"
        isCustomerMode
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/catalog', {
        params: { page: 1, pageSize: 10 },
      });
    });

    expect(await screen.findByText('Marco Público')).toBeInTheDocument();
    expect(screen.queryByText(/Stock:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin precio/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByPlaceholderText('Buscar un producto...')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByPlaceholderText('Buscar un producto...'),
    ).not.toBeInTheDocument();
  });
});
