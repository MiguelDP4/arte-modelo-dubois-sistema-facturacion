'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { ROLE_LABELS } from '@arte-modelo/shared';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import styles from './Topbar.module.scss';

interface TopbarProps {
  onToggleSidebar: () => void;
  showMenuButton?: boolean;
}

export function Topbar({ onToggleSidebar, showMenuButton = true }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    showToast('Sesión cerrada correctamente.', 'info');
    router.push('/login');
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        {showMenuButton ? (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onToggleSidebar}
            aria-label="Abrir o contraer menú lateral"
          >
            <Menu size={20} />
          </button>
        ) : null}

        <Link href="/" className={styles.brand}>
          <img
            src="/logo-arte-modelo.png"
            alt="Escudo Arte Modelo Dubois"
            className={styles.logo}
            width={40}
            height={40}
          />
          <span className={styles.brandText}>Arte Modelo Dubois</span>
        </Link>
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={toggleTheme}
          aria-label={
            theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'
          }
          title={theme === 'light' ? 'Tema oscuro' : 'Tema claro'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {isAuthenticated && user ? (
          <>
            <div className={styles.userChip}>
              <span className={styles.userName}>{user.fullName}</span>
              <span className={styles.userRole}>{ROLE_LABELS[user.role]}</span>
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleLogout}
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
              <span className={styles.btnLabel}>Salir</span>
            </button>
          </>
        ) : (
          <Link href="/login" className={styles.iconBtn}>
            <LogIn size={18} />
            <span className={styles.btnLabel}>Ingresar</span>
          </Link>
        )}
      </div>
    </header>
  );
}
