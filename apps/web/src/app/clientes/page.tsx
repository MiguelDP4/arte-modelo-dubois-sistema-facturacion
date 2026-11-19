'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  COUNTRIES,
  COUNTRY_CURRENCY,
  COUNTRY_LABELS,
  COUNTRY_TAX_LABEL,
  type CountryCode,
} from '@arte-modelo/shared';
import { Building2, Eye, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { AppShell } from '@/components/AppShell/AppShell';
import {
  ResponsiveTable,
  type TableColumn,
} from '@/components/ResponsiveTable/ResponsiveTable';
import { Modal } from '@/components/Modal/Modal';
import { ConfirmModal } from '@/components/Modal/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { CustomerDto } from '@/types/customer';
import styles from './clientes.module.scss';

function ClientesContent() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const canManage = hasPermission('customers.manage');

  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [includeInactive, setIncludeInactive] = useState(false);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDto | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<CountryCode>('GT');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Confirm deactivate / reactivate
  const [confirmTarget, setConfirmTarget] = useState<CustomerDto | null>(null);

  const customersQuery = useQuery({
    queryKey: ['customers', search, countryFilter, includeInactive],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (countryFilter !== 'ALL') params.country = countryFilter;
      if (includeInactive) params.includeInactive = 'true';
      const res = await apiClient.get('/customers', { params });
      return (res.data.customers || []) as CustomerDto[];
    },
  });

  const openCreateModal = () => {
    setEditingCustomer(null);
    setCompanyName('');
    setManagerName('');
    setPhone('');
    setEmail('');
    setCountry('GT');
    setTaxId('');
    setAddress('');
    setNotes('');
    setFormOpen(true);
  };

  const openEditModal = (c: CustomerDto) => {
    setEditingCustomer(c);
    setCompanyName(c.companyName);
    setManagerName(c.managerName);
    setPhone(c.phone);
    setEmail(c.email);
    setCountry(c.country);
    setTaxId(c.taxId);
    setAddress(c.address);
    setNotes(c.notes || '');
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        companyName: companyName.trim(),
        managerName: managerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        country,
        taxId: taxId.trim(),
        address: address.trim(),
        notes: notes.trim() || null,
      };
      if (editingCustomer) {
        const res = await apiClient.patch(`/customers/${editingCustomer.id}`, payload);
        return res.data as { message: string };
      }
      const res = await apiClient.post('/customers', payload);
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Cliente guardado.', 'success');
      setFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo guardar el cliente.'), 'error');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (target: CustomerDto) => {
      if (target.isActive) {
        const res = await apiClient.delete(`/customers/${target.id}`);
        return res.data as { message: string };
      }
      const res = await apiClient.patch(`/customers/${target.id}`, {
        isActive: true,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Estado actualizado.', 'success');
      setConfirmTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      showToast(
        getApiErrorMessage(err, 'No se pudo actualizar el estado del cliente.'),
        'error',
      );
      setConfirmTarget(null);
    },
  });

  const dynamicTaxLabel = COUNTRY_TAX_LABEL[country];
  const dynamicCurrency = COUNTRY_CURRENCY[country];

  const columns = useMemo<TableColumn<CustomerDto>[]>(
    () => [
      {
        key: 'company',
        header: 'Empresa y Encargado',
        render: (c) => (
          <div>
            <strong>{c.companyName}</strong>
            <div>Encargado: {c.managerName}</div>
            {!c.isActive ? (
              <span className={`${styles.badge} ${styles.inactiveBadge}`}>
                Inactivo
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'country',
        header: 'País y Moneda',
        render: (c) => (
          <div>
            <div>{c.countryLabel}</div>
            <span className={`${styles.badge} ${styles.currencyBadge}`}>
              {c.currency}
            </span>
          </div>
        ),
      },
      {
        key: 'taxId',
        header: 'ID Fiscal',
        render: (c) => (
          <div>
            <strong>{c.taxLabel}:</strong> {c.taxId}
          </div>
        ),
      },
      {
        key: 'contact',
        header: 'Contacto',
        render: (c) => (
          <div>
            <div>{c.phone}</div>
            <div>{c.email}</div>
          </div>
        ),
      },
      {
        key: 'users',
        header: 'Cuentas',
        render: (c) => `${c.linkedUsersCount} vinculada(s)`,
      },
      {
        key: 'actions',
        header: 'Acciones',
        render: (c) => (
          <div className={styles.actionsCell}>
            <Link href={`/clientes/${c.id}`} className={styles.actionBtn}>
              <Eye size={15} /> Ver detalle
            </Link>
            {canManage ? (
              <>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => openEditModal(c)}
                >
                  <Pencil size={15} /> Editar
                </button>
                <button
                  type="button"
                  className={c.isActive ? styles.actionDangerBtn : styles.actionBtn}
                  onClick={() => setConfirmTarget(c)}
                >
                  {c.isActive ? (
                    <>
                      <UserX size={15} /> Desactivar
                    </>
                  ) : (
                    <>
                      <UserCheck size={15} /> Reactivar
                    </>
                  )}
                </button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [canManage],
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Cartera Regional de Clientes</h1>
        {canManage ? (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={openCreateModal}
          >
            <Plus size={18} /> Nuevo cliente
          </button>
        ) : null}
      </div>

      <section className={styles.filtersCard} aria-label="Filtros de clientes">
        <div className={styles.field}>
          <label htmlFor="cust-search">Buscar cliente</label>
          <input
            id="cust-search"
            type="search"
            placeholder="Empresa, encargado, NIT/RTN/RUC, correo o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="cust-country-filter">País</label>
          <select
            id="cust-country-filter"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="ALL">Todos los países</option>
            {COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {COUNTRY_LABELS[code]} ({COUNTRY_CURRENCY[code]})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.checkboxRow}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Mostrar clientes desactivados
          </label>
        </div>
      </section>

      {customersQuery.isLoading ? (
        <p role="status">Cargando clientes...</p>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={customersQuery.data || []}
          rowKey={(c) => c.id}
          emptyMessage="No hay clientes registrados con los filtros actuales."
          ariaLabel="Listado regional de clientes"
        />
      )}

      <Modal
        isOpen={formOpen}
        title={editingCustomer ? 'Editar cliente' : 'Nuevo cliente regional'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="customer-form"
              className={styles.primaryBtn}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </>
        }
      >
        <form
          id="customer-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className={styles.field}>
            <label htmlFor="cust-company">Nombre de empresa</label>
            <input
              id="cust-company"
              type="text"
              required
              minLength={2}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label htmlFor="cust-manager">Encargado / Contacto</label>
              <input
                id="cust-manager"
                type="text"
                required
                minLength={2}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="cust-phone">Teléfono</label>
              <input
                id="cust-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="cust-email">Correo electrónico</label>
            <input
              id="cust-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.field}>
              <label htmlFor="cust-country">País</label>
              <select
                id="cust-country"
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
              <label htmlFor="cust-taxid">{dynamicTaxLabel}</label>
              <input
                id="cust-taxid"
                type="text"
                required
                placeholder={`Número de ${dynamicTaxLabel}`}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.currencyHint} role="status">
            <Building2 size={15} style={{ verticalAlign: 'text-bottom' }} />{' '}
            Moneda automática de facturación: <strong>{dynamicCurrency}</strong>
          </div>

          <div className={styles.field}>
            <label htmlFor="cust-address">Dirección de entrega / fiscal</label>
            <input
              id="cust-address"
              type="text"
              required
              minLength={4}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="cust-notes">Notas operativas (opcional)</label>
            <textarea
              id="cust-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(confirmTarget)}
        title={
          confirmTarget?.isActive ? 'Desactivar cliente' : 'Reactivar cliente'
        }
        message={
          confirmTarget?.isActive
            ? `¿Seguro que deseas desactivar a "${confirmTarget.companyName}"? Si tiene cuentas vinculadas deberás desvincularlas antes.`
            : `¿Deseas reactivar a "${confirmTarget?.companyName}"?`
        }
        confirmLabel={confirmTarget?.isActive ? 'Desactivar' : 'Reactivar'}
        variant={confirmTarget?.isActive ? 'danger' : 'primary'}
        isSubmitting={toggleActiveMutation.isPending}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) {
            toggleActiveMutation.mutate(confirmTarget);
          }
        }}
      />
    </div>
  );
}

export default function ClientesPage() {
  return (
    <AppShell requiredPermission="customers.read">
      <ClientesContent />
    </AppShell>
  );
}
