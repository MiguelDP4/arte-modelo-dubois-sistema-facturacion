'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar/Topbar';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import styles from '../auth.module.scss';

function VerifyAccountContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    tokenFromUrl ? 'loading' : 'error',
  );
  const [message, setMessage] = useState(
    tokenFromUrl
      ? 'Verificando tu correo electrónico...'
      : 'No se encontró un token de verificación en el enlace.',
  );

  useEffect(() => {
    if (!tokenFromUrl) return;

    let cancelled = false;
    apiClient
      .post('/auth/verify', { token: tokenFromUrl })
      .then((res) => {
        if (!cancelled) {
          setStatus('success');
          setMessage(res.data.message || 'Cuenta verificada correctamente.');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('error');
          setMessage(
            getApiErrorMessage(err, 'El enlace de verificación no es válido.'),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tokenFromUrl]);

  return (
    <section className={styles.card}>
      <div className={styles.brandHeader}>
        <img
          src="/logo-arte-modelo.png"
          alt="Escudo Arte Modelo Dubois"
          width={64}
          height={64}
        />
        <h1>Verificación de Cuenta</h1>
      </div>

      {status === 'loading' ? (
        <p role="status">{message}</p>
      ) : status === 'success' ? (
        <div className={styles.alertSuccess} role="status">
          <strong>{message}</strong>
          <Link href="/login" className={styles.submitBtn}>
            Iniciar sesión
          </Link>
        </div>
      ) : (
        <div className={styles.alertError} role="alert">
          {message}
        </div>
      )}

      <div className={styles.links}>
        <Link href="/login">Volver al inicio de sesión</Link>
      </div>
    </section>
  );
}

export default function VerifyAccountPage() {
  return (
    <>
      <Topbar onToggleSidebar={() => {}} showMenuButton={false} />
      <main className={styles.page}>
        <Suspense fallback={<section className={styles.card}>Cargando...</section>}>
          <VerifyAccountContent />
        </Suspense>
      </main>
    </>
  );
}
