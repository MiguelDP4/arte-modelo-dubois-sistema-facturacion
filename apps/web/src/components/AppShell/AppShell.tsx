'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PermissionCode } from '@arte-modelo/shared';
import { useAuth } from '@/contexts/AuthContext';
import { Topbar } from '@/components/Topbar/Topbar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import styles from './AppShell.module.scss';

interface AppShellProps {
  children: React.ReactNode;
  requiredPermission?: PermissionCode;
}

export function AppShell({ children, requiredPermission }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const { isLoading, isAuthenticated, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setDesktopCollapsed((prev) => !prev);
    } else {
      setMobileOpen((prev) => !prev);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.stateBox} role="status">
          <h2>Cargando sesión...</h2>
          <p>Verificando tus credenciales de acceso.</p>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className={styles.stateBox}>
          <h2>Redirigiendo a inicio de sesión...</h2>
        </div>
      );
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
      return (
        <div className={styles.stateBox} role="alert">
          <h2>Acceso restringido</h2>
          <p>No tienes permisos asignados para acceder a este módulo.</p>
          <Link href="/" className={styles.backBtn}>
            Volver al inicio
          </Link>
        </div>
      );
    }

    return children;
  };

  return (
    <div className={styles.shell}>
      <Topbar onToggleSidebar={handleToggleSidebar} />
      <Sidebar
        mobileOpen={mobileOpen}
        desktopCollapsed={desktopCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <main
        className={`${styles.main} ${desktopCollapsed ? styles.collapsed : ''}`}
      >
        {renderContent()}
      </main>
    </div>
  );
}
