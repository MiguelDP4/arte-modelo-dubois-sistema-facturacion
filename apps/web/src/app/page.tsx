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
            <h2>Catálogo de Productos</h2>
            <p>
              Consulta nuestro catálogo completo por nombre o cualquiera de sus
              códigos de referencia con galería visual.
            </p>
          </div>
          <Link href="/catalogo" className={styles.cardAction}>
            Ver Catálogo
          </Link>
        </article>

        {hasPermission('products.read_prices') ? (
          <article className={styles.card}>
            <div>
              <h2>Productos e Inventario</h2>
              <p>
                Administra precios multimoneda (GTQ, HNL, NIO, USD), códigos
                múltiples, imágenes y movimientos de Kardex.
              </p>
            </div>
            <Link href="/productos" className={styles.cardAction}>
              Gestionar Productos
            </Link>
          </article>
        ) : null}

        {hasPermission('customers.read') ? (
          <article className={styles.card}>
            <div>
              <h2>Cartera de Clientes</h2>
              <p>
                Administra empresas de Guatemala, Honduras, Nicaragua y El
                Salvador, datos fiscales y cuentas vinculadas.
              </p>
            </div>
            <Link href="/clientes" className={styles.cardAction}>
              Gestionar Clientes
            </Link>
          </article>
        ) : null}

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
            <h2>Configuración y Permisos</h2>
            <p>
              Actualiza tu perfil, contraseña y (si eres administrador) la matriz
              de {permissions.length} permisos activos de tu rol.
            </p>
          </div>
          <Link href="/configuracion" className={styles.cardAction}>
            Ir a Configuración
          </Link>
        </article>
      </section>

      <section className={styles.infoBanner}>
        <h3>Estado de Construcción — Fases 0, 1, 2 y 3 Activas</h3>
        <p>
          El sistema ya cuenta con Catálogo público (sin precios/stock),
          administración multimoneda con múltiples códigos y Kardex de inventario,
          y Cartera Regional de Clientes con vinculación de cuentas. Las Fases 4
          y 5 habilitarán Pedidos, Pagos, Consignación y exportación Excel.
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
