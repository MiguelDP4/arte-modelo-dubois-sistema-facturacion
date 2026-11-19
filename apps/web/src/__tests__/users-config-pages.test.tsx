import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import UsuariosPage from '@/app/usuarios/page';
import ConfiguracionPage from '@/app/configuracion/page';
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

const adminSession = {
  data: {
    accessToken: 'admin-token',
    user: {
      id: 'admin-1',
      email: 'admin@artemodelo.gt',
      fullName: 'Admin Dubois',
      phone: '+502 5555-0001',
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
      createdAt: '2026-01-01',
    },
    permissions: [
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      'permissions.manage',
    ],
  },
};

describe('Usuarios & Configuracion pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists users, invites a new user, edits and confirms deactivation without native confirm()', async () => {
    setMockPathname('/usuarios');
    mockedApi.post.mockImplementation(async (url: string) => {
      if (url === '/auth/refresh-token') return adminSession;
      if (url === '/users/invite') {
        return {
          data: {
            message: 'Invitación enviada a nuevo@artemodelo.gt.',
            devInvitationUrl: 'http://localhost:3000/registro-invitado?token=xyz',
          },
        };
      }
      if (url.includes('/resend-invitation')) {
        return { data: { message: 'Invitación reenviada.' } };
      }
      return { data: {} };
    });

    mockedApi.get.mockResolvedValue({
      data: {
        users: [
          {
            id: 'admin-1',
            email: 'admin@artemodelo.gt',
            fullName: 'Admin Dubois',
            phone: '+502 5555-0001',
            role: 'ADMIN',
            isActive: true,
            isVerified: true,
            hasPendingInvitation: false,
            createdAt: '2026-01-01',
          },
          {
            id: 'emp-1',
            email: 'emp@artemodelo.gt',
            fullName: 'Carlos Operador',
            phone: null,
            role: 'EMPLOYEE',
            isActive: true,
            isVerified: false,
            hasPendingInvitation: true,
            createdAt: '2026-01-02',
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 2,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        },
      },
    });

    mockedApi.patch.mockResolvedValue({
      data: { message: 'Usuario actualizado correctamente.' },
    });

    renderApp(<UsuariosPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Carlos Operador').length).toBeGreaterThanOrEqual(1);
    });

    // Open invite modal and submit
    fireEvent.click(screen.getByRole('button', { name: /Invitar usuario/i }));
    fireEvent.change(screen.getByLabelText('Nombre completo'), {
      target: { value: 'Nuevo Empleado' },
    });
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'nuevo@artemodelo.gt' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        '/users/invite',
        expect.objectContaining({ email: 'nuevo@artemodelo.gt' }),
      );
    });

    // Click Reenviar for pending user
    fireEvent.click(screen.getAllByRole('button', { name: /Reenviar/i })[0]);
    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/users/emp-1/resend-invitation');
    });

    // Open confirm modal to deactivate Carlos
    fireEvent.click(screen.getAllByRole('button', { name: /Desactivar/i })[0]);
    expect(screen.getByText(/¿Seguro que deseas desactivar a Carlos Operador/i)).toBeInTheDocument();
    const confirmBtns = screen.getAllByRole('button', { name: 'Desactivar' });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith('/users/emp-1', { isActive: false });
    });
  });

  it('updates own profile and toggles role permissions matrix on /configuracion', async () => {
    setMockPathname('/configuracion');
    mockedApi.post.mockResolvedValue(adminSession);
    mockedApi.patch.mockResolvedValue({
      data: {
        ...adminSession.data,
        user: { ...adminSession.data.user, fullName: 'Admin Actualizado' },
        message: 'Perfil actualizado correctamente.',
      },
    });

    const matrixData = {
      roles: ['ADMIN', 'EMPLOYEE', 'CUSTOMER'],
      lockedAdminPermissions: ['permissions.manage'],
      permissions: [
        {
          id: 'p1',
          code: 'users.read',
          module: 'Usuarios',
          name: 'Ver usuarios',
          description: 'Listar usuarios del sistema.',
          grants: { ADMIN: true, EMPLOYEE: false, CUSTOMER: false },
        },
      ],
    };

    mockedApi.get.mockResolvedValue({ data: matrixData });
    mockedApi.put.mockResolvedValue({
      data: {
        ...matrixData,
        permissions: [
          {
            ...matrixData.permissions[0],
            grants: { ADMIN: true, EMPLOYEE: true, CUSTOMER: false },
          },
        ],
        message: 'Permisos actualizados.',
      },
    });

    renderApp(<ConfiguracionPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Admin Dubois')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Nombre completo'), {
      target: { value: 'Admin Actualizado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));

    await waitFor(() => {
      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/auth/me',
        expect.objectContaining({ fullName: 'Admin Actualizado' }),
      );
    });

    // Switch to permissions tab
    fireEvent.click(screen.getByRole('tab', { name: 'Permisos por Rol' }));

    await waitFor(() => {
      expect(screen.getByText('Ver usuarios')).toBeInTheDocument();
    });

    const permSwitch = screen.getByRole('switch', {
      name: 'Ver usuarios para Empleado',
    });
    expect(permSwitch).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(permSwitch);

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith('/permissions/role/EMPLOYEE', {
        permissions: [{ code: 'users.read', granted: true }],
      });
    });
  });
});
