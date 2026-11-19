import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import CatalogoPage from '@/app/catalogo/page';
import ProductosPage from '@/app/productos/page';
import { compressImageFile } from '@/lib/image-compress';
import { apiClient } from '@/lib/api-client';
import { setMockPathname } from './setup';

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
    permissions: [
      'products.read',
      'products.read_prices',
      'products.manage',
    ],
  },
};

const sampleStaffProducts = [
  {
    id: 'prod-1',
    name: 'Marco Clásico Azul',
    description: 'Acabado fino',
    category: 'Marcos',
    isActive: true,
    deletedAt: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    priceGTQ: 185,
    priceHNL: 610,
    priceNIO: 890,
    priceUSD: 24,
    stock: 4,
    lowStockThreshold: 8,
    isLowStock: true,
    codes: [
      { id: 'c1', code: 'AMD-001', label: 'Interno', isPrimary: true },
      { id: 'c2', code: 'PROV-99', label: 'Proveedor', isPrimary: false },
    ],
    images: [
      { id: 'i1', url: '/seed/marco-clasico.svg', altText: 'Vista 1', sortOrder: 0 },
      { id: 'i2', url: '/seed/cuadro-moderno.svg', altText: 'Vista 2', sortOrder: 1 },
    ],
  },
];

describe('Catalogo & Productos pages + image compression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compresses image files safely even in fallback environments without canvas rendering', async () => {
    const fakeFile = new File(['hello-image'], 'foto.png', {
      type: 'image/png',
    });
    const result = await compressImageFile(fakeFile);
    expect(result.fileName).toBe('foto.png');
    expect(result.mimeType).toBe('image/png');
    expect(result.dataBase64).toContain('data:');
  });

  it('renders /catalogo publicly without prices/stock and opens gallery modal', async () => {
    setMockPathname('/catalogo');
    mockedApi.post.mockRejectedValue(new Error('No session'));
    mockedApi.get.mockResolvedValue({
      data: {
        categories: ['Marcos'],
        products: [
          {
            id: 'prod-1',
            name: 'Marco Público',
            description: 'Sin precio visible',
            category: 'Marcos',
            codes: [{ code: 'AMD-001', label: 'Interno', isPrimary: true }],
            images: [
              { url: '/seed/marco-clasico.svg', altText: 'Foto 1' },
              { url: '/seed/cuadro-moderno.svg', altText: 'Foto 2' },
            ],
            createdAt: '2026-01-01',
          },
        ],
      },
    });

    renderApp(<CatalogoPage />);

    await waitFor(() => {
      expect(screen.getByText('Marco Público')).toBeInTheDocument();
    });

    expect(mockedApi.get).toHaveBeenCalledWith('/catalog', { params: {} });
    expect(screen.queryByText(/Existencia:/i)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver galería de Marco Público' }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('renders /catalogo for staff with prices and stock visible', async () => {
    setMockPathname('/catalogo');
    mockedApi.post.mockResolvedValue(staffSession);
    mockedApi.get.mockResolvedValue({
      data: {
        categories: ['Marcos'],
        products: sampleStaffProducts,
      },
    });

    renderApp(<CatalogoPage />);

    await waitFor(() => {
      expect(screen.getByText('Marco Clásico Azul')).toBeInTheDocument();
    });
    expect(screen.getByText(/Existencia: 4 uds./i)).toBeInTheDocument();
  });

  it('manages /productos: create with multiple codes, Kardex movement, and archive confirmation', async () => {
    setMockPathname('/productos');
    mockedApi.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh-token') return staffSession;
      if (url === '/products') return { data: { message: 'Producto creado.' } };
      if (url.includes('/stock-movements')) {
        return {
          data: {
            message: 'Movimiento registrado.',
            product: { ...sampleStaffProducts[0], stock: 14, isLowStock: false },
          },
        };
      }
      return { data: {} };
    });

    mockedApi.get.mockImplementation(async (url: string) => {
      if (url.includes('/stock-movements')) {
        return {
          data: {
            productId: 'prod-1',
            productName: 'Marco Clásico Azul',
            currentStock: 4,
            lowStockThreshold: 8,
            movements: [
              {
                id: 'm1',
                productId: 'prod-1',
                type: 'INITIAL',
                quantityDelta: 4,
                previousStock: 0,
                newStock: 4,
                reason: 'Inicial',
                reference: null,
                createdAt: '2026-01-01',
                performedBy: null,
              },
            ],
          },
        };
      }
      return {
        data: {
          categories: ['Marcos'],
          products: sampleStaffProducts,
        },
      };
    });

    mockedApi.delete.mockResolvedValue({
      data: { message: 'Producto archivado correctamente.' },
    });

    renderApp(<ProductosPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Marco Clásico Azul').length).toBeGreaterThanOrEqual(1);
    });

    // Open New Product modal and submit with 2 codes
    fireEvent.click(screen.getByRole('button', { name: /Nuevo producto/i }));
    fireEvent.change(screen.getByLabelText('Nombre del producto'), {
      target: { value: 'Moldura Nueva' },
    });
    fireEvent.change(screen.getByLabelText('Código 1'), {
      target: { value: 'AMD-NEW-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Agregar código/i }));
    fireEvent.change(screen.getByLabelText('Código 2'), {
      target: { value: 'PROV-NEW-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/products',
        expect.objectContaining({
          name: 'Moldura Nueva',
          codes: expect.arrayContaining([
            expect.objectContaining({ code: 'AMD-NEW-1' }),
            expect.objectContaining({ code: 'PROV-NEW-2' }),
          ]),
        }),
      );
    });

    // Open Kardex modal and submit movement
    fireEvent.click(screen.getAllByRole('button', { name: /Kardex/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('Inicial')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'Compra proveedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar movimiento' }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/products/prod-1/stock-movements',
        expect.objectContaining({ quantity: 10, reason: 'Compra proveedor' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    // Open confirm archive modal
    fireEvent.click(screen.getAllByRole('button', { name: /Archivar/i })[0]);
    const confirmBtns = screen.getAllByRole('button', { name: 'Archivar' });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith('/products/prod-1');
    });
  });
});
