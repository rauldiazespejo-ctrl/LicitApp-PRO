import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  user: { id: string; email: string; name: string; role: string; tenantId: string } | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: AuthState['user']) => void;
  logout: () => void;
  setTokens: (token: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      tenantId: null,
      user: null,
      isAuthenticated: false,
      login: (token, refreshToken, user) =>
        set({ token, refreshToken, user, tenantId: user?.tenantId ?? null, isAuthenticated: true }),
      logout: () =>
        set({ token: null, refreshToken: null, user: null, tenantId: null, isAuthenticated: false }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
    }),
    { name: 'auth-storage', partialize: (s) => ({ token: s.token, refreshToken: s.refreshToken, user: s.user, tenantId: s.tenantId, isAuthenticated: s.isAuthenticated }) }
  )
);
