'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Topbar } from '@/components/Topbar/Topbar';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import styles from '../auth.module.scss';

function InvitedRegisterContent() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [token, setToken] = useState(initialToken);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/auth/complete-invitation', {
        token: token.trim(),
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
      });
      showToast('Cuenta activada. Ahora puedes iniciar sesión.', 'success');
      router.push('/login');
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudo completar tu registro de invitación.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.brandHeader}>
        <img
          src="/logo-arte-modelo.png"
          alt="Escudo Arte Modelo Dubois"
          width={64}
          height={64}
        />
        <h1>Activar Invitación</h1>
        <p>Define tu contraseña para ingresar al sistema</p>
      </div>

      {error ? (
        <div className={styles.alertError} role="alert">
          {error}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        {!initialToken ? (
          <div className={styles.field}>
            <label htmlFor="inv-token">Código de invitación</label>
            <input
              id="inv-token"
              type="text"
              required
              placeholder="Pega aquí el token recibido"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="inv-name">Nombre completo (opcional)</label>
          <input
            id="inv-name"
            type="text"
            placeholder="Confirma o corrige tu nombre"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="inv-phone">Teléfono (opcional)</label>
          <input
            id="inv-phone"
            type="tel"
            placeholder="+502 5555-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="inv-password">Nueva contraseña</label>
          <input
            id="inv-password"
            type="password"
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres, mayúscula y número"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="inv-confirm">Confirmar contraseña</label>
          <input
            id="inv-confirm"
            type="password"
            required
            minLength={8}
            placeholder="Repite tu contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {submitting ? 'Activando cuenta...' : 'Completar registro'}
        </button>
      </form>

      <div className={styles.links}>
        <Link href="/login">Volver a iniciar sesión</Link>
      </div>
    </section>
  );
}

export default function InvitedRegisterPage() {
  return (
    <>
      <Topbar onToggleSidebar={() => {}} showMenuButton={false} />
      <main className={styles.page}>
        <Suspense fallback={<section className={styles.card}>Cargando...</section>}>
          <InvitedRegisterContent />
        </Suspense>
      </main>
    </>
  );
}
