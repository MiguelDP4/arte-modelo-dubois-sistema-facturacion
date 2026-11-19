'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/Topbar/Topbar';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/contexts/ToastContext';
import styles from '../auth.module.scss';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/auth/register', {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });

      setSuccessMsg(res.data.message);
      setDevVerifyUrl(res.data.devVerificationUrl || null);
      showToast('Registro enviado. Revisa tu correo para verificar.', 'success');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo completar el registro.'));
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
            <h1>Registro de Cliente</h1>
            <p>Crea tu cuenta para enviar pedidos a Arte Modelo Dubois</p>
          </div>

          {error ? (
            <div className={styles.alertError} role="alert">
              {error}
            </div>
          ) : null}

          {successMsg ? (
            <div className={styles.alertSuccess} role="status">
              <strong>{successMsg}</strong>
              {devVerifyUrl ? (
                <span>
                  Enlace de verificación (modo local):{' '}
                  <Link href={devVerifyUrl} className={styles.devLink}>
                    Verificar ahora
                  </Link>
                </span>
              ) : null}
              <Link href="/login" className={styles.secondaryBtn}>
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label htmlFor="reg-name">Nombre completo</label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  minLength={2}
                  placeholder="Ej. Ana Morales"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="reg-email">Correo electrónico</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  placeholder="correo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="reg-phone">Teléfono (opcional)</label>
                <input
                  id="reg-phone"
                  type="tel"
                  placeholder="+502 5555-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="reg-password">Contraseña</label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres, mayúscula y número"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="reg-confirm">Confirmar contraseña</label>
                <input
                  id="reg-confirm"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting}
              >
                {submitting ? 'Registrando...' : 'Crear cuenta'}
              </button>
            </form>
          )}

          <div className={styles.links}>
            <span>
              ¿Ya tienes una cuenta? <Link href="/login">Iniciar sesión</Link>
            </span>
          </div>
        </section>
      </main>
    </>
  );
}
