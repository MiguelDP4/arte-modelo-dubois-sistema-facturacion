'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { PermissionCode } from '@arte-modelo/shared';
import {
  apiClient,
  setAccessToken,
  setOnUnauthorized,
} from '@/lib/api-client';
import type { AuthUser } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  permissions: PermissionCode[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateSessionUser: (user: AuthUser, permissions?: PermissionCode[]) => void;
  hasPermission: (code: PermissionCode) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<PermissionCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setPermissions([]);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await apiClient.post('/auth/refresh-token');
      setAccessToken(res.data.accessToken);
      setUser(res.data.user);
      setPermissions(res.data.permissions || []);
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    setOnUnauthorized(() => {
      clearSession();
    });
    void refreshSession();
    return () => {
      setOnUnauthorized(null);
    };
  }, [clearSession, refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    setPermissions(res.data.permissions || []);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const updateSessionUser = useCallback(
    (nextUser: AuthUser, nextPermissions?: PermissionCode[]) => {
      setUser(nextUser);
      if (nextPermissions) {
        setPermissions(nextPermissions);
      }
    },
    [],
  );

  const hasPermission = useCallback(
    (code: PermissionCode) => permissions.includes(code),
    [permissions],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        logout,
        refreshSession,
        updateSessionUser,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }
  return ctx;
}
