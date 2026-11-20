import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import LoginPage from '@/app/login/page';
import RegisterPage from '@/app/registro/page';
import VerifyAccountPage from '@/app/verificar-cuenta/page';
import InvitedRegisterPage from '@/app/registro-invitado/page';
import HomePage from '@/app/page';
import { apiClient } from '@/lib/api-client';
import { mockPush, setMockSearchParams } from './setup';

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

function renderWithProviders(ui: React.ReactNode) {
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

describe('Auth pages and Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockSearchParams({});
    mockedApi.post.mockRejectedValue(new Error('No session'));
    mockedApi.get.mockResolvedValue({ data: {} });
  });

  it('submits login form and navigates to home on success', async () => {
    mockedApi.post
      .mockRejectedValueOnce(new Error('No session'))
      .mockResolvedValueOnce({
        data: {
          accessToken: 'abc',
          user: {
            id: '1',
            email: 'admin@artemodelo.gt',
            fullName: 'Admin',
            phone: null,
            role: 'ADMIN',
            isActive: true,
            isVerified: true,
            createdAt: '2026-01-01',
          },
          permissions: ['users.read'],
        },
      });

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'admin@artemodelo.gt' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('registers a customer and validates password mismatch', async () => {
    mockedApi.post
      .mockRejectedValueOnce(new Error('No session'))
      .mockResolvedValueOnce({
        data: {
          message: 'Registro exitoso.',
          devVerificationUrl: 'http://localhost:3000/verificar-cuenta?token=abc',
        },
      });

    renderWithProviders(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('Nombre completo'), {
      target: { value: 'Ana Cliente' },
    });
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'ana@cliente.gt' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'Different123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(screen.getByText('Registro exitoso.')).toBeInTheDocument();
    });
  });

  it('verifies account token from URL on /verificar-cuenta', async () => {
    setMockSearchParams({ token: 'a'.repeat(32) });
    mockedApi.post.mockImplementation(async (url: string) => {
      if (url === '/auth/verify') {
        return { data: { message: 'Cuenta verificada.' } };
      }
      throw new Error('No session');
    });

    renderWithProviders(<VerifyAccountPage />);

    await waitFor(() => {
      expect(screen.getByText('Cuenta verificada.')).toBeInTheDocument();
    });
  });

  it('completes invitation on /registro-invitado', async () => {
    setMockSearchParams({ token: 'b'.repeat(32) });
    mockedApi.post
      .mockRejectedValueOnce(new Error('No session'))
      .mockResolvedValueOnce({
        data: { message: 'Registro completado.' },
      });

    renderWithProviders(<InvitedRegisterPage />);

    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Completar registro' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders dashboard home when authenticated', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        accessToken: 'abc',
        user: {
          id: '1',
          email: 'admin@artemodelo.gt',
          fullName: 'Miguel Admin',
          phone: null,
          role: 'ADMIN',
          isActive: true,
          isVerified: true,
          createdAt: '2026-01-01',
        },
        permissions: ['users.read', 'permissions.manage'],
      },
    });

    renderWithProviders(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Bienvenido, Miguel Admin')).toBeInTheDocument();
    });
    expect(screen.getByText('Administrar Usuarios')).toBeInTheDocument();
  });
});
