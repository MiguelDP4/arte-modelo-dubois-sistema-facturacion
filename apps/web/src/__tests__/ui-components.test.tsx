import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/Modal/Modal';
import { ConfirmModal } from '@/components/Modal/ConfirmModal';
import { ResponsiveTable } from '@/components/ResponsiveTable/ResponsiveTable';
import { Topbar } from '@/components/Topbar/Topbar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { AppShell } from '@/components/AppShell/AppShell';
import { setMockPathname, mockPush, mockReplace } from './setup';

const mockAuthState = {
  user: {
    id: 'u1',
    email: 'admin@artemodelo.gt',
    fullName: 'Admin Demo',
    phone: null,
    role: 'ADMIN' as const,
    isActive: true,
    isVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  permissions: ['users.read', 'permissions.manage'] as string[],
  isLoading: false,
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  refreshSession: vi.fn().mockResolvedValue(undefined),
  updateSessionUser: vi.fn(),
  hasPermission: (code: string) => mockAuthState.permissions.includes(code),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function ThemeTester() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('light')}>Light</button>
    </div>
  );
}

function ToastTester() {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast('Guardado con éxito', 'success')}>
      Notify
    </button>
  );
}

describe('Design system & shell components', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.permissions = ['users.read', 'permissions.manage'];
    setMockPathname('/');
  });

  it('toggles and persists light/dark theme', () => {
    render(
      <ThemeProvider>
        <ThemeTester />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme-val')).toHaveTextContent('light');
    fireEvent.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('theme-val')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByText('Light'));
    expect(screen.getByTestId('theme-val')).toHaveTextContent('light');
  });

  it('shows and dismisses toasts', () => {
    render(
      <ToastProvider>
        <ToastTester />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Notify'));
    expect(screen.getByText('Guardado con éxito')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cerrar notificación'));
    expect(screen.queryByText('Guardado con éxito')).not.toBeInTheDocument();
  });

  it('renders Modal and ConfirmModal with Escape and button actions', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <>
        <Modal isOpen title="Mi Modal" onClose={onClose} footer={<span>Pie</span>}>
          <p>Contenido modal</p>
        </Modal>
        <ConfirmModal
          isOpen
          title="Confirmar acción"
          message="¿Deseas continuar?"
          variant="danger"
          onConfirm={onConfirm}
          onCancel={onClose}
        />
      </>,
    );

    expect(screen.getByText('Contenido modal')).toBeInTheDocument();
    expect(screen.getByText('¿Deseas continuar?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders ResponsiveTable both with rows and empty state', () => {
    const { rerender } = render(
      <ResponsiveTable
        columns={[
          { key: 'name', header: 'Nombre', render: (r: { id: string; name: string }) => r.name },
        ]}
        data={[{ id: '1', name: 'Arte Modelo' }]}
        rowKey={(r) => r.id}
      />,
    );

    expect(screen.getAllByText('Arte Modelo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('responsive-table-cards')).toBeInTheDocument();

    rerender(
      <ResponsiveTable
        columns={[{ key: 'name', header: 'Nombre', render: (r: { id: string; name: string }) => r.name }]}
        data={[]}
        rowKey={(r) => r.id}
        emptyMessage="Sin registros"
      />,
    );
    expect(screen.getByText('Sin registros')).toBeInTheDocument();
  });

  it('renders Topbar, Sidebar and handles logout', async () => {
    const onToggle = vi.fn();
    const onCloseMobile = vi.fn();

    render(
      <ThemeProvider>
        <ToastProvider>
          <Topbar onToggleSidebar={onToggle} />
          <Sidebar mobileOpen desktopCollapsed={false} onCloseMobile={onCloseMobile} />
        </ToastProvider>
      </ThemeProvider>,
    );

    const logo = screen.getByAltText('Escudo Arte Modelo Dubois');
    expect(logo).toHaveAttribute('src', '/logo-arte-modelo.png');

    fireEvent.click(screen.getByLabelText('Abrir o contraer menú lateral'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Usuarios')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Cerrar sesión'));
    expect(mockAuthState.logout).toHaveBeenCalled();
  });

  it('guards routes in AppShell for loading, unauthenticated and forbidden permissions', () => {
    mockAuthState.isLoading = true;
    const { rerender } = render(
      <ThemeProvider>
        <ToastProvider>
          <AppShell>
            <div>Contenido privado</div>
          </AppShell>
        </ToastProvider>
      </ThemeProvider>,
    );
    expect(screen.getByText('Cargando sesión...')).toBeInTheDocument();

    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = false;
    rerender(
      <ThemeProvider>
        <ToastProvider>
          <AppShell>
            <div>Contenido privado</div>
          </AppShell>
        </ToastProvider>
      </ThemeProvider>,
    );
    expect(mockReplace).toHaveBeenCalledWith('/login');

    mockAuthState.isAuthenticated = true;
    mockAuthState.permissions = [];
    rerender(
      <ThemeProvider>
        <ToastProvider>
          <AppShell requiredPermission="users.read">
            <div>Contenido privado</div>
          </AppShell>
        </ToastProvider>
      </ThemeProvider>,
    );
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();

    mockAuthState.permissions = ['users.read'];
    rerender(
      <ThemeProvider>
        <ToastProvider>
          <AppShell requiredPermission="users.read">
            <div>Contenido privado</div>
          </AppShell>
        </ToastProvider>
      </ThemeProvider>,
    );
    expect(screen.getByText('Contenido privado')).toBeInTheDocument();
  });
});
