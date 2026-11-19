'use client';

import React from 'react';
import Link from 'next/link';
import { ROLE_LABELS } from '@arte-modelo/shared';
import { AppShell } from '@/components/AppShell/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import styles from './dashboard.module.scss';

function DashboardContent() {
  const { user, permissions, hasPermission } = useAuth();

  if (!user) return null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Bienvenido, {user.fullName}</h1>
          <p className={styles.subtitle}>
            Sistema de Facturación y Pedidos B2B — Arte Modelo Dubois 2.0
          </p>
        </div>
        <span className={`${styles.roleBadge} ${styles[user.role]}`}>
          {ROLE_LABELS[user.role]}
        </span>
      </div>

      <section className={styles.grid} aria-label="Accesos principales">
        <article className={styles.card}>
          <div>
            <h2>Permisos activos</h2>
            <p className={styles.statValue}>{permissions.length}</p>
            <p>
              Capacidades asignadas actualmente a tu rol ({ROLE_LABELS[user.role]}).
            </p>
          </div>
          <Link href="/configuracion" className={styles.cardAction}>
            Ir a Configuración
          </Link>
        </article>

        {hasPermission('users.read') ? (
          <article className={styles.card}>
            <div>
              <h2>Gestión de Usuarios</h2>
              <p>
                Invita empleados o clientes, gestiona accesos, reenvía invitaciones
                y administra estados de cuenta.
              </p>
            </div>
            <Link href="/usuarios" className={styles.cardAction}>
              Administrar Usuarios
            </Link>
          </article>
        ) : null}

        <article className={styles.card}>
          <div>
            <h2>Mi Perfil y Seguridad</h2>
            <p>
              Actualiza tu nombre, teléfono de contacto y contraseña con sesiones
              seguras httpOnly.
            </p>
          </div>
          <Link href="/configuracion" className={styles.cardAction}>
            Editar Perfil
          </Link>
        </article>
      </section>

      <section className={styles.infoBanner}>
        <h3>Estado de Construcción — Fase 0 y Fase 1 Completadas</h3>
        <p>
          La arquitectura base, el sistema visual Material Design recto (tema claro y
          oscuro), la autenticación con refresh tokens httpOnly y el control de acceso
          RBAC real están operativos. Los módulos de Catálogo, Clientes, Pedidos,
          Pagos, Consignación y Excel se habilitarán en las siguientes fases del
          backlog.
        </p>
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
