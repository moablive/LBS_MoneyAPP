import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, PersistedState } from '@moneyapp/models';

const STORAGE_KEY = 'moneyapp.auth';
// Fallback obrigatório: sem ele, um build arg ausente virava string vazia e o
// fetch saía como path relativo, batendo no fallback do SPA em vez da API.
const LOGINHUB_API =
  (import.meta.env.VITE_LOGINHUB_API_URL as string) || 'https://loginhub.astralwavelabel.com/api';
const BACKEND_API = import.meta.env.VITE_API_BASE_URL as string;
// ID do MoneyAPP no LoginHub (tenant). Sem isso, se o mesmo e-mail existir
// em outro app, o LoginHub responde 409 AMBIGUOUS_EMAIL.
const LOGINHUB_APP_ID = import.meta.env.VITE_LOGINHUB_APP_ID as string | undefined;


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
  const isAuthenticated = computed(() => token.value !== null);

  function persist() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: token.value, user: user.value }),
    );
  }

  async function login(email: string, password: string) {
    // 1) Authenticate against LoginHub (the single source of identity).
    // Sempre enviar app_id para evitar 409 AMBIGUOUS_EMAIL quando o mesmo e-mail
    // estiver cadastrado em outros apps do LoginHub.
    const payload: { email: string; password: string; app_id?: string } = { email, password };
    if (LOGINHUB_APP_ID) payload.app_id = LOGINHUB_APP_ID;

    const res = await fetch(`${LOGINHUB_API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // 401 = bad credentials, 403 = app suspended, 409 = e-mail ambíguo (não deve
      // acontecer se app_id está configurado, mas tratamos por segurança).
      if (res.status === 401) throw new Error('invalid_credentials');
      if (res.status === 409) throw new Error('ambiguous_email');
      throw new Error('login_failed');
    }
    const data = (await res.json()) as {
      token: string;
      requirePasswordChange?: boolean;
      usuario?: { id: string; nome: string; email: string; role: string };
    };

    token.value = data.token;

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

  /** Define a senha definitiva no LoginHub via Magic Link (1º acesso ou pós-reset). */
  async function setupPassword(setupToken: string, novaSenha: string) {
    const res = await fetch(`${LOGINHUB_API}/auth/setup-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: setupToken, novaSenha }),
    });
    if (!res.ok) throw new Error('setup_password_failed');
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
    persist();
  }

  async function updateSettings(settings: { requireReceipts?: boolean; displayName?: string }) {
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
    isAuthenticated,
    login,
    logout,
    setupPassword,
    refresh,
    persist,
    updateSettings,
  };
});
