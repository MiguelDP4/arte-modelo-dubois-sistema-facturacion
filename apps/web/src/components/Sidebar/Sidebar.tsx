'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import type { PermissionCode } from '@arte-modelo/shared';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.scss';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  requiredPermission?: PermissionCode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Inicio',
    icon: <LayoutDashboard size={20} />,
  },
  {
    href: '/catalogo',
    label: 'Catálogo',
    icon: <BookOpen size={20} />,
  },
  {
    href: '/pedidos',
    label: 'Pedidos',
    icon: <ClipboardList size={20} />,
    requiredPermission: 'orders.read',
  },
  {
    href: '/productos',
    label: 'Productos',
    icon: <Boxes size={20} />,
    requiredPermission: 'products.read_prices',
  },
  {
    href: '/clientes',
    label: 'Clientes',
    icon: <Building2 size={20} />,
    requiredPermission: 'customers.read',
  },
  {
    href: '/usuarios',
    label: 'Usuarios',
    icon: <Users size={20} />,
    requiredPermission: 'users.read',
  },
  {
    href: '/configuracion',
    label: 'Configuración',
    icon: <Settings size={20} />,
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  desktopCollapsed: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  mobileOpen,
  desktopCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requiredPermission || hasPermission(item.requiredPermission),
  );

  return (
    <>
      {mobileOpen ? (
        <div
          className={styles.backdrop}
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ''} ${
          desktopCollapsed ? styles.collapsed : ''
        }`}
        aria-label="Navegación principal"
      >
        <nav className={styles.nav}>
          {visibleItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onCloseMobile}
                title={item.label}
              >
                <span className={styles.iconWrap}>{item.icon}</span>
                <span className={styles.label}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>Arte Modelo Dubois v2.0</div>
      </aside>
    </>
  );
}
