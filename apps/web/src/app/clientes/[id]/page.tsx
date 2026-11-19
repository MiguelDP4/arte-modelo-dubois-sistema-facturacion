'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COUNTRIES,
  COUNTRY_CURRENCY,
  COUNTRY_LABELS,
  COUNTRY_TAX_LABEL,
  type CountryCode,
} from '@arte-modelo/shared';
import { ArrowLeft, Link2, Pencil, Unlink } from 'lucide-react';
import { AppShell } from '@/components/AppShell/AppShell';
import { Modal } from '@/components/Modal/Modal';
import { ConfirmModal } from '@/components/Modal/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { CustomerDetailResponse, LinkedUserDto } from '@/types/customer';
import styles from './detalle.module.scss';

function ClienteDetalleContent() {
  const params = useParams<{ id: string }>();
  const customerId = String(params?.id || '');
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const canManage = hasPermission('customers.manage');

  const [selectedUserId, setSelectedUserId] = useState('');
  const [confirmUnlinkUser, setConfirmUnlinkUser] =
    useState<LinkedUserDto | null>(null);

  // Quick edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<CountryCode>('GT');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const detailQuery = useQuery({
    queryKey: ['customer-detail', customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const res = await apiClient.get(`/customers/${customerId}`);
      return res.data as CustomerDetailResponse;
    },
  });

  const unlinkedUsersQuery = useQuery({
    queryKey: ['customers-unlinked-users'],
    enabled: canManage,
    queryFn: async () => {
      const res = await apiClient.get('/customers/unlinked-users');
      return (res.data.users || []) as LinkedUserDto[];
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/customers/${customerId}/users`, {
        userId: selectedUserId,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Usuario vinculado.', 'success');
      setSelectedUserId('');
      void queryClient.invalidateQueries({
        queryKey: ['customer-detail', customerId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['customers-unlinked-users'],
      });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      showToast(
        getApiErrorMessage(err, 'No se pudo vincular la cuenta de usuario.'),
        'error',
      );
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.delete(
        `/customers/${customerId}/users/${userId}`,
      );
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Usuario desvinculado.', 'success');
      setConfirmUnlinkUser(null);
      void queryClient.invalidateQueries({
        queryKey: ['customer-detail', customerId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['customers-unlinked-users'],
      });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      showToast(
        getApiErrorMessage(err, 'No se pudo desvincular al usuario.'),
        'error',
      );
      setConfirmUnlinkUser(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch(`/customers/${customerId}`, {
        companyName: companyName.trim(),
        managerName: managerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        country,
        taxId: taxId.trim(),
        address: address.trim(),
        notes: notes.trim() || null,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Cliente actualizado.', 'success');
      setEditOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ['customer-detail', customerId],
      });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo actualizar el cliente.'), 'error');
    },
  });

  if (detailQuery.isLoading) {
    return <p role="status">Cargando ficha del cliente...</p>;
  }

  const customer = detailQuery.data?.customer;
  if (!customer) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2>Cliente no encontrado</h2>
          <Link href="/clientes" className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Volver a Clientes
          </Link>
        </div>
      </div>
    );
  }

  const openEdit = () => {
    setCompanyName(customer.companyName);
    setManagerName(customer.managerName);
    setPhone(customer.phone);
    setEmail(customer.email);
    setCountry(customer.country);
    setTaxId(customer.taxId);
    setAddress(customer.address);
    setNotes(customer.notes || '');
    setEditOpen(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{customer.companyName}</h1>
        <div className={styles.headerActions}>
          <Link href="/clientes" className={styles.secondaryBtn}>
            <ArrowLeft size={16} /> Volver
          </Link>
          {canManage ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={openEdit}
            >
              <Pencil size={16} /> Editar ficha
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card} aria-label="Datos fiscales y regionales">
          <h2>Información Fiscal y Regional</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span>País y Moneda</span>
              <strong>
                {customer.countryLabel} ({customer.currency})
              </strong>
            </div>
            <div className={styles.infoItem}>
              <span>{customer.taxLabel}</span>
              <strong>{customer.taxId}</strong>
            </div>
            <div className={styles.infoItem}>
              <span>Encargado</span>
              <strong>{customer.managerName}</strong>
            </div>
            <div className={styles.infoItem}>
              <span>Teléfono</span>
              <strong>{customer.phone}</strong>
            </div>
            <div className={styles.infoItem}>
              <span>Correo</span>
              <strong>{customer.email}</strong>
            </div>
            <div className={styles.infoItem}>
              <span>Estado</span>
              <strong>{customer.isActive ? 'Activo' : 'Inactivo'}</strong>
            </div>
            <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
              <span>Dirección</span>
              <strong>{customer.address}</strong>
            </div>
            {customer.notes ? (
              <div className={styles.infoItem} style={{ gridColumn: '1 / -1' }}>
                <span>Notas</span>
                <strong>{customer.notes}</strong>
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.card} aria-label="Cuentas vinculadas">
          <h2>Cuentas de Usuario Vinculadas</h2>

          {canManage && customer.isActive ? (
            <form
              className={styles.linkForm}
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedUserId) linkMutation.mutate();
              }}
            >
              <div className={styles.field}>
                <label htmlFor="link-user-select">
                  Vincular cuenta con rol Cliente
                </label>
                <select
                  id="link-user-select"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Selecciona un usuario disponible...</option>
                  {(unlinkedUsersQuery.data || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={!selectedUserId || linkMutation.isPending}
              >
                <Link2 size={16} /> Vincular
              </button>
            </form>
          ) : null}

          {(customer.users || []).length === 0 ? (
            <p className={styles.emptyText}>
              Ninguna cuenta de usuario vinculada todavía a esta empresa.
            </p>
          ) : (
            <div className={styles.usersList}>
              {(customer.users || []).map((u) => (
                <div key={u.id} className={styles.userRow}>
                  <div className={styles.userMeta}>
                    <strong>{u.fullName}</strong>
                    <span>
                      {u.email} {u.phone ? `· ${u.phone}` : ''}
                    </span>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      onClick={() => setConfirmUnlinkUser(u)}
                    >
                      <Unlink size={15} /> Desvincular
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          className={`${styles.card} ${styles.fullWidthCard}`}
          aria-label="Historial de pedidos"
        >
          <h2>Historial de Pedidos y Consignaciones</h2>
          <p className={styles.emptyText}>
            Este módulo se conectará automáticamente con el historial de
            pedidos y saldos del cliente en la Fase 4 y Fase 5.
          </p>
        </section>
      </div>

      <Modal
        isOpen={editOpen}
        title="Editar ficha de cliente"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="customer-detail-edit-form"
              className={styles.primaryBtn}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        <form
          id="customer-detail-edit-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
        >
          <div className={styles.field}>
            <label htmlFor="det-company">Empresa</label>
            <input
              id="det-company"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label htmlFor="det-manager">Encargado</label>
              <input
                id="det-manager"
                type="text"
                required
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="det-phone">Teléfono</label>
              <input
                id="det-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="det-email">Correo</label>
            <input
              id="det-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label htmlFor="det-country">
                País ({COUNTRY_CURRENCY[country]})
              </label>
              <select
                id="det-country"
                value={country}
                onChange={(e) => setCountry(e.target.value as CountryCode)}
              >
                {COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {COUNTRY_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="det-tax">{COUNTRY_TAX_LABEL[country]}</label>
              <input
                id="det-tax"
                type="text"
                required
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor="det-address">Dirección</label>
            <input
              id="det-address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="det-notes">Notas</label>
            <textarea
              id="det-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(confirmUnlinkUser)}
        title="Desvincular cuenta de usuario"
        message={`¿Deseas desvincular la cuenta "${confirmUnlinkUser?.fullName}" de ${customer.companyName}?`}
        confirmLabel="Desvincular"
        variant="danger"
        isSubmitting={unlinkMutation.isPending}
        onCancel={() => setConfirmUnlinkUser(null)}
        onConfirm={() => {
          if (confirmUnlinkUser) {
            unlinkMutation.mutate(confirmUnlinkUser.id);
          }
        }}
      />
    </div>
  );
}

export default function ClienteDetallePage() {
  return (
    <AppShell requiredPermission="customers.read">
      <ClienteDetalleContent />
    </AppShell>
  );
}
