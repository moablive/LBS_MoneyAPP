import { defineStore } from 'pinia';
import type { AuthResponse, AuthState } from '@moneyapp/shared';

const STORAGE_KEY = 'moneyapp.auth';

function load(): AuthState {
  if (typeof localStorage === 'undefined') return { token: null, user: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => load(),
  getters: {
    isAuthenticated: (s) => s.token !== null,
  },
  actions: {
    async login(email: string, password: string) {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? '/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'login_failed');
      }
      const data = (await res.json()) as AuthResponse;
      this.token = data.token;
      this.user = data.user;
      this.persist();
    },
    logout() {
      this.token = null;
      this.user = null;
      this.persist();
    },
    persist() {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: this.token, user: this.user }));
    },
  },
});
