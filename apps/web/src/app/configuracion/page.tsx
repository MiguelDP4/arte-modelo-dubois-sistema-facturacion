'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS, ROLES, type PermissionCode, type Role } from '@arte-modelo/shared';
import { AppShell } from '@/components/AppShell/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import type { PermissionMatrixItem, PermissionMatrixResponse } from '@/types/auth';
import styles from './configuracion.module.scss';

function ConfiguracionContent() {
  const { user, hasPermission, updateSessionUser, refreshSession } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const canManagePermissions = hasPermission('permissions.manage');
  const [activeTab, setActiveTab] = useState<'profile' | 'permissions'>('profile');

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [selectedRole, setSelectedRole] = useState<Role>('EMPLOYEE');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phone || '');
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | null | undefined> = {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const res = await apiClient.patch('/auth/me', payload);
      return res.data;
    },
    onSuccess: (data) => {
      updateSessionUser(data.user, data.permissions);
      setCurrentPassword('');
      setNewPassword('');
      showToast(data.message || 'Perfil actualizado.', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo actualizar tu perfil.'), 'error');
    },
  });

  const permissionsQuery = useQuery({
    queryKey: ['permissions-matrix'],
    enabled: canManagePermissions && activeTab === 'permissions',
    queryFn: async () => {
      const res = await apiClient.get('/permissions');
      return res.data as PermissionMatrixResponse;
    },
  });

  const togglePermissionMutation = useMutation({
    mutationFn: async (params: {
      role: Role;
      code: PermissionCode;
      granted: boolean;
    }) => {
      const res = await apiClient.put(`/permissions/role/${params.role}`, {
        permissions: [{ code: params.code, granted: params.granted }],
      });
      return res.data as PermissionMatrixResponse & { message: string };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['permissions-matrix'], data);
      showToast('Permiso actualizado correctamente.', 'success');
      if (selectedRole === user?.role) {
        void refreshSession();
      }
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'No se pudo actualizar el permiso.'), 'error');
    },
  });

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionMatrixItem[]>();
    for (const perm of permissionsQuery.data?.permissions || []) {
      const list = map.get(perm.module) || [];
      list.push(perm);
      map.set(perm.module, list);
    }
    return Array.from(map.entries());
  }, [permissionsQuery.data]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Configuración</h1>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Secciones de configuración">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.active : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Mi Perfil
        </button>

        {canManagePermissions ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'permissions'}
            className={`${styles.tabBtn} ${
              activeTab === 'permissions' ? styles.active : ''
            }`}
            onClick={() => setActiveTab('permissions')}
          >
            Permisos por Rol
          </button>
        ) : null}
      </div>

      {activeTab === 'profile' ? (
        <section className={styles.card}>
          <h2 style={{ margin: 0 }}>Datos de mi cuenta</h2>
          <form
            className={styles.formGrid}
            onSubmit={(e) => {
              e.preventDefault();
              profileMutation.mutate();
            }}
          >
            <div className={styles.field}>
              <label htmlFor="profile-name">Nombre completo</label>
              <input
                id="profile-name"
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="profile-phone">Teléfono</label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="profile-email">Correo electrónico</label>
              <input
                id="profile-email"
                type="email"
                value={user?.email || ''}
                disabled
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="profile-role">Rol asignado</label>
              <input
                id="profile-role"
                type="text"
                value={user ? ROLE_LABELS[user.role] : ''}
                disabled
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="profile-cur-pwd">Contraseña actual (solo si deseas cambiarla)</label>
              <input
                id="profile-cur-pwd"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="profile-new-pwd">Nueva contraseña</label>
              <input
                id="profile-new-pwd"
                type="password"
                minLength={8}
                placeholder="Mín. 8 chars, mayúscula y número"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className={styles.fullSpan}>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={profileMutation.isPending}
              >
                {profileMutation.isPending ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === 'permissions' && canManagePermissions ? (
        <section className={styles.card}>
          <h2 style={{ margin: 0 }}>Matriz de Permisos (Roles Fijos)</h2>
          <p className={styles.helperText}>
            Selecciona un rol fijo para habilitar o restringir sus capacidades en
            tiempo real. Los permisos administrativos críticos de Administrador
            permanecen protegidos contra auto-bloqueo.
          </p>

          <div className={styles.roleSelector} role="group" aria-label="Seleccionar rol">
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                className={`${styles.tabBtn} ${
                  selectedRole === role ? styles.active : ''
                }`}
                onClick={() => setSelectedRole(role)}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>

          {permissionsQuery.isLoading ? (
            <p role="status">Cargando matriz de permisos...</p>
          ) : (
            groupedPermissions.map(([moduleName, items]) => (
              <div key={moduleName} className={styles.moduleGroup}>
                <div className={styles.moduleHeader}>{moduleName}</div>
                <div className={styles.permList}>
                  {items.map((perm) => {
                    const isGranted = perm.grants[selectedRole];
                    const isLocked =
                      selectedRole === 'ADMIN' &&
                      (permissionsQuery.data?.lockedAdminPermissions || []).includes(
                        perm.code,
                      );

                    return (
                      <div key={perm.code} className={styles.permRow}>
                        <div className={styles.permInfo}>
                          <strong>{perm.name}</strong>
                          <span>{perm.description}</span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isGranted}
                          aria-label={`${perm.name} para ${ROLE_LABELS[selectedRole]}`}
                          disabled={isLocked || togglePermissionMutation.isPending}
                          className={`${styles.switchBtn} ${
                            isGranted ? styles.on : styles.off
                          }`}
                          onClick={() =>
                            togglePermissionMutation.mutate({
                              role: selectedRole,
                              code: perm.code,
                              granted: !isGranted,
                            })
                          }
                        >
                          {isLocked
                            ? 'Bloqueado'
                            : isGranted
                              ? 'Activo'
                              : 'Inactivo'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <AppShell>
      <ConfiguracionContent />
    </AppShell>
  );
}
