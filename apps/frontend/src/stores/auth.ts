import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, PersistedState } from '@moneyapp/models';

const STORAGE_KEY = 'moneyapp.auth';
const LOGINHUB_API = import.meta.env.VITE_LOGINHUB_API_URL as string;
const BACKEND_API = import.meta.env.VITE_API_BASE_URL as string;


function load(): PersistedState {
  if (typeof localStorage === 'undefined') return { token: null, user: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    return JSON.parse(raw) as PersistedState;
  } catch {
    return { token: null, user: null };
  }
}

export const useAuthStore = defineStore('auth', () => {
  const state = load();
  const token = ref<string | null>(state.token);
  const user = ref<User | null>(state.user);
  // Mirrors LoginHub's `requirePasswordChange` — true forces the change-password
  // modal before the rest of the app is usable.
  const requirePasswordChange = ref<boolean>(state.requirePasswordChange ?? false);

  const isAuthenticated = computed(() => token.value !== null);

  function persist() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: token.value, user: user.value, requirePasswordChange: requirePasswordChange.value }),
    );
  }

  async function login(email: string, password: string) {
    // 1) Authenticate against LoginHub (the single source of identity).
    const res = await fetch(`${LOGINHUB_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      // 401 = bad credentials, 403 = app suspended.
      throw new Error(res.status === 401 ? 'invalid_credentials' : 'login_failed');
    }
    const data = (await res.json()) as {
      token: string;
      requirePasswordChange?: boolean;
      usuario?: { id: string; nome: string; email: string; role: string };
    };

    token.value = data.token;
    requirePasswordChange.value = !!data.requirePasswordChange;

    // 2) Provision / sync the local MoneyAPP user (owns the financial data).
    const boot = await fetch(`${BACKEND_API}/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
      body: JSON.stringify({ name: data.usuario?.nome }),
    });
    if (!boot.ok) throw new Error('bootstrap_failed');
    user.value = (await boot.json()) as User;

    persist();
  }

  /** Define a senha definitiva no LoginHub (1º acesso ou pós-reset). */
  async function changePassword(novaSenha: string) {
    const res = await fetch(`${LOGINHUB_API}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.value}` },
      body: JSON.stringify({ novaSenha }),
    });
    if (!res.ok) throw new Error('change_password_failed');
    requirePasswordChange.value = false;
    persist();
  }

  /** Renova o JWT no LoginHub (grace de 7 dias). Retorna true se renovou. */
  async function refresh(): Promise<boolean> {
    if (!token.value) return false;
    try {
      const res = await fetch(`${LOGINHUB_API}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value}` },
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { token: string };
      token.value = data.token;
      persist();
      return true;
    } catch {
      return false;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    requirePasswordChange.value = false;
    persist();
  }

  async function updateSettings(settings: { requireReceipts: boolean }) {
    const res = await fetch(`${BACKEND_API}/users/me/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.value}`,
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    const updatedSettings = await res.json();
    if (user.value) {
      user.value.settings = updatedSettings;
      persist();
    }
  }

  return {
    token,
    user,
    requirePasswordChange,
    isAuthenticated,
    login,
    logout,
    changePassword,
    refresh,
    persist,
    updateSettings,
  };
});
