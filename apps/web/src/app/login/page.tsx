'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar/Topbar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/lib/api-client';
import styles from '../auth.module.scss';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      showToast('Bienvenido a Arte Modelo Dubois.', 'success');
      router.push('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo iniciar sesión.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Topbar onToggleSidebar={() => {}} showMenuButton={false} />
      <main className={styles.page}>
        <section className={styles.card}>
          <div className={styles.brandHeader}>
            <img
              src="/logo-arte-modelo.png"
              alt="Escudo Arte Modelo Dubois"
              width={64}
              height={64}
            />
            <h1>Iniciar Sesión</h1>
            <p>Portal B2B de Pedidos y Facturación</p>
          </div>

          {error ? (
            <div className={styles.alertError} role="alert">
              {error}
            </div>
          ) : null}

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="login-email">Correo electrónico</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="correo@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className={styles.links}>
            <span>
              ¿Aún no tienes cuenta de cliente?{' '}
              <Link href="/registro">Crear cuenta</Link>
            </span>
          </div>
        </section>
      </main>
    </>
  );
}
