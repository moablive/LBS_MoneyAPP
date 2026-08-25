import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, PersistedState } from '@moneyapp/models';
import { createHubAuth, type HubStorage } from '../lib/hubAuthClient';

const STORAGE_KEY = 'moneyapp.auth';
// Fallback obrigatório: sem ele, um build arg ausente virava string vazia e o
// fetch saía como path relativo, batendo no fallback do SPA em vez da API.
const LOGINHUB_API =
  (import.meta.env.VITE_LOGINHUB_API_URL as string) || 'https://loginhub.astralwavelabel.com/api';
const BACKEND_API = import.meta.env.VITE_API_BASE_URL as string;
// ID do MoneyAPP no LoginHub (tenant). Sem isso, se o mesmo e-mail existir
// em outro app, o LoginHub responde 409 AMBIGUOUS_EMAIL.
const LOGINHUB_APP_ID = import.meta.env.VITE_LOGINHUB_APP_ID as string | undefined;


/** URL do painel do LoginHUB — é lá que mora a tela de enrolamento de 2FA. */

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

/**
 * Ponte entre o auth-kit (que pensa em chaves) e o blob `moneyapp.auth` (que já
 * existia). Mantida para não deslogar quem está com sessão válida: o campo
 * `token` do blob continua sendo o mesmo de sempre.
 */
const blobStorage: HubStorage = {
  get(k) {
    const v = (load() as unknown as Record<string, unknown>)[k];
    return typeof v === 'string' ? v : null;
  },
  set(k, valor) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...load(), [k]: valor }));
  },
  remove(k) {
    if (typeof localStorage === 'undefined') return;
    const atual = { ...load() } as unknown as Record<string, unknown>;
    delete atual[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atual));
  },
};

const hub = createHubAuth({
  baseUrl: LOGINHUB_API,
  appId: LOGINHUB_APP_ID,
  storage: blobStorage,
  // `token` é o campo que o blob sempre usou. `user` fica de fora de propósito:
  // ali mora o usuário do MoneyAPP (vindo do /bootstrap), não o do hub.
  tokenKey: 'token',
  userKey: 'hubUser',
  appKey: 'hubApp',
});

export const useAuthStore = defineStore('auth', () => {
  const state = load();
  const token = ref<string | null>(state.token);
  const user = ref<User | null>(state.user);
  // `!!` e nao `!== null`: a versao anterior chegava a gravar a string
  // "undefined", que e truthy — o app se dava por autenticado com lixo.
  const isAuthenticated = computed(() => !!token.value && token.value !== 'undefined');

  function persist() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: token.value, user: user.value }),
    );
  }

  /**
   * Desafio de 2FA pendente. Quando não é `null`, a senha conferiu mas a sessão
   * ainda NÃO existe — a tela deve pedir o código de 6 dígitos e chamar
   * `verificarSegundoFator`.
   */
  const challengeToken = ref<string | null>(null);
  const aguardandoSegundoFator = computed(() => challengeToken.value !== null);

  /** Conclui o login depois do hub devolver sessão. */
  async function bootstrap(hubToken: string, nome?: string) {
    token.value = hubToken;

    // Provision / sync the local MoneyAPP user (owns the financial data).
    const boot = await fetch(`${BACKEND_API}/auth/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hubToken}` },
      body: JSON.stringify({ name: nome }),
    });
    if (!boot.ok) throw new Error('bootstrap_failed');
    user.value = (await boot.json()) as User;

    persist();
  }

  /**
   * Authenticate against LoginHub (the single source of identity).
   *
   * O hub responde 200 em TRÊS desfechos e só um traz sessão. A versão anterior
   * lia `data.token` direto: nos outros dois isso era `undefined`, o bootstrap
   * saía com `Bearer undefined` e o erro exibido era `bootstrap_failed` — o
   * usuário não tinha como saber que faltava o segundo fator.
   */
  async function login(email: string, password: string) {
    challengeToken.value = null;

    const r = await hub.login(email, password);

    if (r.status === 'desafio') {
      // Sessão só existe depois do código. Nada é gravado aqui.
      challengeToken.value = r.challengeToken;
      return { etapa: '2fa' as const };
    }

    if (r.status === 'enrolar') {
      return { etapa: 'enrolar' as const, setupToken: r.setupToken };
    }

    await bootstrap(r.session.token, r.session.usuario?.nome);
    return { etapa: 'sessao' as const };
  }

  /**
   * Enrolamento de 2FA, passo 1: pede o secret e a URI `otpauth://` ao hub.
   *
   * O QR e desenhado NO NAVEGADOR a partir dessa URI (ver TwoFactorEnroll) — o
   * segredo nao vai para gerador de terceiro nenhum, e o passe nao atravessa
   * origem. Antes ele viajava na query string ate o painel do hub, o que o
   * deixava no historico do navegador e em log de acesso — e amarrava o convite
   * ao build daquele painel.
   */
  async function iniciarEnrolamento(setupToken: string) {
    return hub.twoFactor.setup(setupToken);
  }

  /**
   * Passo 2: confirma com o codigo do autenticador.
   *
   * A ativacao mata o passe que fez esta chamada e devolve uma sessao nova. O
   * `bootstrap` roda com ela para provisionar o usuario local — sem isso a
   * pessoa termina o convite e cai deslogada na primeira requisicao.
   */
  async function confirmarEnrolamento(codigo: string, setupToken: string) {
    const r = await hub.twoFactor.verifySetup(codigo, setupToken);
    await bootstrap(r.token);
    return r;
  }

  /** Fecha o login pendente com o código do autenticador (ou de recuperação). */
  async function verificarSegundoFator(codigo: string, usarBackup = false) {
    if (!challengeToken.value) throw new Error('sem_desafio');

    const sessao = usarBackup
      ? await hub.twoFactor.verifyBackup(challengeToken.value, codigo)
      : await hub.twoFactor.verify(challengeToken.value, codigo);

    challengeToken.value = null;
    await bootstrap(sessao.token, sessao.usuario?.nome);
  }

  /**
   * Define a senha definitiva no LoginHub via Magic Link (1º acesso ou pós-reset).
   *
   * Mesmos três desfechos do login: numa conta que já tem 2FA ativo o hub
   * devolve DESAFIO e não sessão — senão o reset de senha viraria um atalho
   * para pular o segundo fator. A versão anterior descartava a resposta inteira.
   */
  async function setupPassword(setupToken: string, novaSenha: string) {
    const r = await hub.setupPassword(setupToken, novaSenha);

    if (r.status === 'desafio') {
      challengeToken.value = r.challengeToken;
      return { etapa: '2fa' as const };
    }

    if (r.status === 'enrolar') {
      return { etapa: 'enrolar' as const, setupToken: r.setupToken };
    }

    await bootstrap(r.session.token);
    return { etapa: 'sessao' as const };
  }

  /** Renova o JWT no LoginHub (grace de 7 dias). Retorna true se renovou. */
  async function refresh(): Promise<boolean> {
    if (!token.value) return false;
    // Via auth-kit: ele so grava token que seja string nao vazia. A versao
    // anterior atribuia `data.token` as cegas.
    const novo = await hub.refresh();
    if (!novo) return false;
    token.value = novo;
    persist();
    return true;
  }

  function logout() {
    token.value = null;
    user.value = null;
    challengeToken.value = null;
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
    challengeToken,
    aguardandoSegundoFator,
    login,
    iniciarEnrolamento,
    confirmarEnrolamento,
    verificarSegundoFator,
    logout,
    setupPassword,
    refresh,
    persist,
    updateSettings,
  };
});
