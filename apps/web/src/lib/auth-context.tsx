'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import type { ProfileCompleteness } from '@vaqt/shared';

import { apiFetch } from '@/lib/api-client';

// Mirrors the fields of apps/api's PrivateUser (auth/user-view.ts) that
// apps/web actually needs. Not imported from apps/api directly — nothing
// in apps/api is published for cross-app import, only @vaqt/shared is.
export interface AuthUser {
  id: string;
  displayName: string;
  roleIntent: string;
  phoneVerified: boolean;
  maskedPhone: string;
  completeness: ProfileCompleteness;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      // redirectOnAuthFailure: false — this call runs on every page,
      // including guest-facing ones (home, public request list). A guest
      // with no session at all must not get bounced to /login just for
      // loading the homepage.
      const me = await apiFetch<AuthUser>('/auth/me', undefined, {
        redirectOnAuthFailure: false,
      });
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const logout = useCallback(async () => {
    try {
      await apiFetch(
        '/auth/logout',
        { method: 'POST' },
        { redirectOnAuthFailure: false },
      );
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
