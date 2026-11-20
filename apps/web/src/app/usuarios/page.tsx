'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_PAGE_SIZE,
  ROLE_LABELS,
  ROLES,
  SEARCH_DEBOUNCE_MS,
  type PaginationMeta,
  type Role,
} from '@arte-modelo/shared';
import { Mail, Pencil, UserPlus, UserX, UserCheck } from 'lucide-react';
import { AppShell } from '@/components/AppShell/AppShell';
import {
  ResponsiveTable,
  type TableColumn,
} from '@/components/ResponsiveTable/ResponsiveTable';
import { Pagination } from '@/components/Pagination/Pagination';
import { SearchingIndicator } from '@/components/SearchingIndicator/SearchingIndicator';
import { Modal } from '@/components/Modal/Modal';
import { ConfirmModal } from '@/components/Modal/ConfirmModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { ManagedUser } from '@/types/auth';
import styles from './usuarios.module.scss';

function UsuariosContent() {
  const { user: currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('EMPLOYEE');
  const [lastDevInviteUrl, setLastDevInviteUrl] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<Role>('CUSTOMER');

  const [confirmToggleUser, setConfirmToggleUser] = useState<ManagedUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users', debouncedSearch, roleFilter, statusFilter, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (roleFilter !== 'ALL') params.role = roleFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await apiClient.get('/users', { params });
      return res.data as {
        users: ManagedUser[];
        pagination?: PaginationMeta;
      };
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/users/invite', {
        fullName: inviteFullName.trim(),
        email: inviteEmail.trim(),
        phone: invitePhone.trim() || undefined,
        role: inviteRole,
      });
      return res.data as { message: string; devInvitationUrl?: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Invitación enviada.', 'success');
      setLastDevInviteUrl(data.devInvitationUrl || null);
      setInviteFullName('');
      setInviteEmail('');
      setInvitePhone('');
      setInviteRole('EMPLOYEE');
      setInviteOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo enviar la invitación.'), 'error');
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const res = await apiClient.patch(`/users/${editingUser.id}`, {
        fullName: editFullName.trim(),
        phone: editPhone.trim() || null,
        role: editRole,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data?.message || 'Usuario actualizado.', 'success');
      setEditingUser(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo actualizar el usuario.'), 'error');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (target: ManagedUser) => {
      const res = await apiClient.patch(`/users/${target.id}`, {
        isActive: !target.isActive,
      });
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Estado actualizado.', 'success');
      setConfirmToggleUser(null);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo cambiar el estado.'), 'error');
      setConfirmToggleUser(null);
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.post(`/users/${userId}/resend-invitation`);
      return res.data as { message: string; devInvitationUrl?: string };
    },
    onSuccess: (data) => {
      showToast(data.message || 'Invitación reenviada.', 'success');
      if (data.devInvitationUrl) {
        setLastDevInviteUrl(data.devInvitationUrl);
      }
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo reenviar la invitación.'), 'error');
    },
  });

  const openEditModal = (target: ManagedUser) => {
    setEditingUser(target);
    setEditFullName(target.fullName);
    setEditPhone(target.phone || '');
    setEditRole(target.role);
  };

  const columns = useMemo<TableColumn<ManagedUser>[]>(
    () => [
      {
        key: 'fullName',
        header: 'Nombre',
        render: (u) => (
          <div>
            <strong>{u.fullName}</strong>
            <div>{u.email}</div>
          </div>
        ),
      },
      {
        key: 'phone',
        header: 'Teléfono',
        render: (u) => u.phone || '—',
      },
      {
        key: 'role',
        header: 'Rol',
        render: (u) => (
          <span className={`${styles.badge} ${styles[`role${u.role}`]}`}>
            {ROLE_LABELS[u.role]}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        render: (u) => {
          if (!u.isActive) {
            return (
              <span className={`${styles.badge} ${styles.statusInactive}`}>
                Desactivado
              </span>
            );
          }
          if (!u.isVerified) {
            return (
              <span className={`${styles.badge} ${styles.statusPending}`}>
                Pendiente
              </span>
            );
          }
          return (
            <span className={`${styles.badge} ${styles.statusActive}`}>
              Activo
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Acciones',
        render: (u) => {
          const isSelf = currentUser?.id === u.id;
          return (
            <div className={styles.actionsCell}>
              {hasPermission('users.update') ? (
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => openEditModal(u)}
                >
                  <Pencil size={15} /> Editar
                </button>
              ) : null}

              {!u.isVerified && hasPermission('users.create') ? (
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => resendMutation.mutate(u.id)}
                  disabled={resendMutation.isPending}
                >
                  <Mail size={15} /> Reenviar
                </button>
              ) : null}

              {hasPermission('users.update') && !isSelf ? (
                <button
                  type="button"
                  className={
                    u.isActive ? styles.actionDangerBtn : styles.actionBtn
                  }
                  onClick={() => setConfirmToggleUser(u)}
                >
                  {u.isActive ? (
                    <>
                      <UserX size={15} /> Desactivar
                    </>
                  ) : (
                    <>
                      <UserCheck size={15} /> Reactivar
                    </>
                  )}
                </button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [currentUser?.id, hasPermission, resendMutation],
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Gestión de Usuarios</h1>
        {hasPermission('users.create') ? (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus size={18} /> Invitar usuario
          </button>
        ) : null}
      </div>

      {lastDevInviteUrl ? (
        <div className={styles.devBanner} role="status">
          <strong>Enlace de invitación generado (modo correo local):</strong>
          <a href={lastDevInviteUrl}>{lastDevInviteUrl}</a>
        </div>
      ) : null}

      <section className={styles.filtersCard} aria-label="Filtros de usuarios">
        <div className={styles.field}>
          <label htmlFor="users-search">Buscar</label>
          <input
            id="users-search"
            type="search"
            placeholder="Nombre, correo o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(search.trim() !== debouncedSearch.trim() ||
            (usersQuery.isFetching && debouncedSearch.trim().length > 0)) && (
            <SearchingIndicator compact />
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="users-role">Rol</label>
          <select
            id="users-role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Todos los roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="users-status">Estado</label>
          <select
            id="users-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(
                e.target.value as 'all' | 'active' | 'pending' | 'inactive',
              );
              setPage(1);
            }}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="pending">Pendientes</option>
            <option value="inactive">Desactivados</option>
          </select>
        </div>
      </section>

      {usersQuery.isLoading ? (
        <p role="status">Cargando usuarios...</p>
      ) : (
        <>
          <ResponsiveTable
            columns={columns}
            data={usersQuery.data?.users || []}
            rowKey={(u) => u.id}
            emptyMessage="No se encontraron usuarios con los filtros actuales."
            ariaLabel="Listado de usuarios"
          />
          {usersQuery.data?.pagination && (
            <Pagination
              pagination={usersQuery.data.pagination}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
              itemLabel="usuarios"
            />
          )}
        </>
      )}

      <Modal
        isOpen={inviteOpen}
        title="Invitar nuevo usuario"
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setInviteOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="invite-user-form"
              className={styles.primaryBtn}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'Enviando...' : 'Enviar invitación'}
            </button>
          </>
        }
      >
        <form
          id="invite-user-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <div className={styles.field}>
            <label htmlFor="invite-name">Nombre completo</label>
            <input
              id="invite-name"
              type="text"
              required
              minLength={2}
              value={inviteFullName}
              onChange={(e) => setInviteFullName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="invite-email">Correo electrónico</label>
            <input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="invite-phone">Teléfono (opcional)</label>
            <input
              id="invite-phone"
              type="tel"
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="invite-role">Rol fijo</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(editingUser)}
        title="Editar usuario"
        onClose={() => setEditingUser(null)}
        footer={
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setEditingUser(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="edit-user-form"
              className={styles.primaryBtn}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        <form
          id="edit-user-form"
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            editMutation.mutate();
          }}
        >
          <div className={styles.field}>
            <label htmlFor="edit-name">Nombre completo</label>
            <input
              id="edit-name"
              type="text"
              required
              minLength={2}
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-phone">Teléfono</label>
            <input
              id="edit-phone"
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="edit-role">Rol</label>
            <select
              id="edit-role"
              value={editRole}
              disabled={editingUser?.id === currentUser?.id}
              onChange={(e) => setEditRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={Boolean(confirmToggleUser)}
        title={
          confirmToggleUser?.isActive
            ? 'Desactivar usuario'
            : 'Reactivar usuario'
        }
        message={
          confirmToggleUser?.isActive
            ? `¿Seguro que deseas desactivar a ${confirmToggleUser.fullName}? Sus sesiones activas se cerrarán de inmediato.`
            : `¿Deseas reactivar el acceso para ${confirmToggleUser?.fullName}?`
        }
        confirmLabel={confirmToggleUser?.isActive ? 'Desactivar' : 'Reactivar'}
        variant={confirmToggleUser?.isActive ? 'danger' : 'primary'}
        isSubmitting={toggleActiveMutation.isPending}
        onCancel={() => setConfirmToggleUser(null)}
        onConfirm={() => {
          if (confirmToggleUser) {
            toggleActiveMutation.mutate(confirmToggleUser);
          }
        }}
      />
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <AppShell requiredPermission="users.read">
      <UsuariosContent />
    </AppShell>
  );
}
