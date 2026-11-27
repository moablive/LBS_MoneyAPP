import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, PersistedState } from '@moneyapp/models';
import { createHubAuth, type HubStorage } from '../lib/hubAuthClient';
import { createHubPasskey, biometriaDoAparelho, type HubPasskey } from '../lib/hubPasskeyClient';
import { createCofreEntrada, type EntradaCofre } from '../lib/cofreEntrada';
import { marcarBiometriaAtiva, marcarCofreAtivo, nomeDoAparelho } from '../lib/biometria';

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

/** Instância do hub, exposta para a seção Segurança (SegurancaConta.vue). */
export const hubCliente = hub;

// Login por biometria (passkey): cadastro e conferência são do LoginHUB.
const passkey = createHubPasskey({ baseUrl: LOGINHUB_API, appId: LOGINHUB_APP_ID || '3' });
// Entrada pelo cofre do LoginHUB: a chave da conta mora no cofre, que abre com a digital.
const cofre = createCofreEntrada({ baseUrl: LOGINHUB_API, appId: LOGINHUB_APP_ID || '3' });

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

  /** Pede o código de 6 dígitos por e-mail (resposta igual exista a conta ou não). */
  async function emailStart(email: string) {
    challengeToken.value = null;
    return hub.emailStart(email);
  }

  /** Confere o código do e-mail: mesmos três desfechos do login por senha. */
  async function emailVerify(challengeId: string, codigo: string) {
    challengeToken.value = null;
    const r = await hub.emailVerify(challengeId, codigo);
    if (r.status === 'desafio') {
      challengeToken.value = r.challengeToken;
      return { etapa: '2fa' as const };
    }
    if (r.status === 'enrolar') {
      return { etapa: 'enrolar' as const, setupToken: r.setupToken };
    }
    await bootstrap(r.session.token, r.session.usuario?.nome);
    return { etapa: 'sessao' as const };
  }

  /** O desafio pendente é de código por e-mail (claim `met`)? Só escolhe o texto da tela. */
  const desafioPorEmail = computed(() => {
    const t = challengeToken.value;
    if (!t) return false;
    try {
      return JSON.parse(atob((t.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))).met === 'email';
    } catch {
      return false;
    }
  });

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

  // ── Biometria (passkey) ────────────────────────────────────────────────────

  /** O LoginHUB tem biometria ligada para o MoneyAPP e este navegador sabe usar? */
  const biometriaDisponivel = () => passkey.disponivel();

  /** Este aparelho tem digital, rosto ou PIN do sistema para cadastrar? */
  const aparelhoTemBiometria = () => biometriaDoAparelho();

  /**
   * Entra com a digital ou o rosto, sem senha nem código: a passkey já vale
   * pelos dois fatores. O hub devolve a mesma sessão do login completo.
   */
  async function entrarComBiometria() {
    challengeToken.value = null;
    const sessao = await passkey.entrar();
    await bootstrap(sessao.token, sessao.usuario?.nome);
    // Passkey sincronizada (iCloud, Google) entra num aparelho novo: lembra aqui também.
    marcarBiometriaAtiva(true);
  }

  /** Cadastra a biometria deste aparelho. Só com sessão completa (a que está aberta). */
  async function ativarBiometria(): Promise<HubPasskey> {
    if (!token.value) throw new Error('sem_sessao');
    const p = await passkey.ativar(token.value, nomeDoAparelho());
    marcarBiometriaAtiva(true);
    return p;
  }

  async function listarBiometrias(): Promise<HubPasskey[]> {
    if (!token.value) return [];
    return passkey.listar(token.value);
  }

  async function removerBiometria(id: number): Promise<void> {
    if (!token.value) throw new Error('sem_sessao');
    await passkey.remover(token.value, id);
  }

  // ── Entrada pelo cofre do LoginHUB ─────────────────────────────────────────

  /** Sai do app para o cofre, que abre com a digital e assina a entrada. A volta é em `/entrar`. */
  async function irAoCofreParaEntrar() {
    challengeToken.value = null;
    await cofre.irParaEntrar();
  }

  /**
   * Volta do cofre: troca a assinatura que veio no `#` pela sessão (a mesma do
   * login completo). Devolve `false` quando a tela abriu sem volta do cofre.
   */
  async function concluirEntradaPeloCofre(): Promise<boolean> {
    const sessao = await cofre.concluir();
    if (!sessao) return false;
    await bootstrap(sessao.token, sessao.usuario?.nome);
    marcarCofreAtivo(true);
    return true;
  }

  /** Sai do app para o cofre guardar a entrada desta conta. Só com sessão completa. */
  async function irAoCofreParaGuardar() {
    if (!token.value) throw new Error('sem_sessao');
    await cofre.irParaGuardar(token.value);
  }

  async function listarEntradasCofre(): Promise<EntradaCofre[]> {
    if (!token.value) return [];
    return cofre.listar(token.value);
  }

  async function removerEntradaCofre(id: string): Promise<void> {
    if (!token.value) throw new Error('sem_sessao');
    await cofre.remover(token.value, id);
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

  async function updateSettings(settings: { requireReceipts?: boolean; displayName?: string; foto?: string | null }) {
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

  /** Relê os settings do servidor (a foto ou o nome trocados em outro aparelho). Falha calada: fica o que havia. */
  async function recarregaSettings() {
    if (!token.value || !user.value) return;
    try {
      const res = await fetch(`${BACKEND_API}/users/me/settings`, {
        headers: { Authorization: `Bearer ${token.value}` },
        cache: 'no-store',
      });
      if (!res.ok) return;
      user.value.settings = await res.json();
      persist();
    } catch {
      /* sem rede: segue com o guardado no aparelho */
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    challengeToken,
    aguardandoSegundoFator,
    desafioPorEmail,
    login,
    emailStart,
    emailVerify,
    iniciarEnrolamento,
    confirmarEnrolamento,
    verificarSegundoFator,
    biometriaDisponivel,
    aparelhoTemBiometria,
    entrarComBiometria,
    ativarBiometria,
    listarBiometrias,
    removerBiometria,
    irAoCofreParaEntrar,
    concluirEntradaPeloCofre,
    irAoCofreParaGuardar,
    listarEntradasCofre,
    removerEntradaCofre,
    logout,
    setupPassword,
    refresh,
    persist,
    updateSettings,
    recarregaSettings,
  };
});
