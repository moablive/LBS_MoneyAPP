import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AuthResponse, AuthState, User } from '@moneyapp/models';

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

export const useAuthStore = defineStore('auth', () => {
  const state = load();
  const token = ref<string | null>(state.token);
  const user = ref<User | null>(state.user);

  const isAuthenticated = computed(() => token.value !== null);

  function persist() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: token.value, user: user.value }));
  }

  async function login(email: string, password: string) {
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
    token.value = data.token;
    user.value = data.user;
    persist();
  }

  function logout() {
    token.value = null;
    user.value = null;
    persist();
  }

  return { token, user, isAuthenticated, login, logout, persist };
});
