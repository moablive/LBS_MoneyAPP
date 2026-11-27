<script setup lang="ts">
import GoogleAuthAviso from '../components/GoogleAuthAviso.vue';
import { onMounted, ref } from 'vue';
import { FingerPrintIcon } from '@heroicons/vue/24/outline';
import { biometriaAtivaAqui, cofreAtivoAqui, dispensarOfertaDeBiometria, podeOferecerBiometria } from '../lib/biometria';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import TwoFactorEnroll from '../components/TwoFactorEnroll.vue';

/** Passe de enrolamento. Enquanto existir, o QR toma a tela. */
const enrolarToken = ref<string | null>(null);

const router = useRouter();
const auth = useAuthStore();

// Logo por URL estável (public/) com retry caso falhe ao carregar.
const LOGO_SRC = '/logo/MONEYAPP.png';
const logoSrc = ref(LOGO_SRC);
let logoRetries = 0;
function retryLogo() {
  if (logoRetries >= 3) return;
  logoRetries += 1;
  setTimeout(() => {
    logoSrc.value = `${LOGO_SRC}?r=${logoRetries}`;
  }, 400 * logoRetries);
}

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

// Segunda etapa. `auth.aguardandoSegundoFator` fica true quando a senha
// conferiu mas a conta exige o código do autenticador — a sessão ainda NÃO
// existe nesse ponto.
const codigo = ref('');

// ── Entrada por código de e-mail ────────────────────────────────────────────
// 'pedir': só o campo de e-mail; 'codigo': campo dos 6 dígitos enviados.
const modoEmail = ref<'nenhum' | 'pedir' | 'codigo'>('nenhum');
const emailChallengeId = ref('');
const codigoEmail = ref('');

function abrirEntradaPorEmail() {
  error.value = null;
  codigoEmail.value = '';
  modoEmail.value = 'pedir';
}

function voltarParaSenha() {
  error.value = null;
  modoEmail.value = 'nenhum';
}

async function enviarCodigoEmail() {
  error.value = null;
  loading.value = true;
  try {
    const r = await auth.emailStart(email.value.trim());
    emailChallengeId.value = r.challengeId;
    codigoEmail.value = '';
    modoEmail.value = 'codigo';
  } catch (e) {
    error.value = traduzir(e);
  } finally {
    loading.value = false;
  }
}

async function confirmarCodigoEmail() {
  error.value = null;
  loading.value = true;
  try {
    // Aceita colar com espaço ("123 456").
    const r = await auth.emailVerify(emailChallengeId.value, codigoEmail.value.replace(/\s+/g, ''));
    if (r.etapa === 'enrolar') {
      enrolarToken.value = r.setupToken;
      return;
    }
    // '2fa': conta com app autenticador ainda pede o código do app (template troca de tela).
    if (r.etapa === 'sessao') await depoisDeEntrar();
  } catch (e) {
    error.value = traduzir(e);
  } finally {
    loading.value = false;
  }
}

const usarBackup = ref(false);

// ── Biometria (passkey, junto com o LoginHUB) ───────────────────────────────
// `biometriaNoLogin`: o hub tem biometria ligada e este navegador sabe usar.
// `biometriaEmDestaque`: ela já foi ativada neste aparelho, então o botão sobe
// para o topo do formulário. `ofertaBiometria`: depois de um login completo,
// oferece ativar aqui (uma vez; "agora não" vale 30 dias).
const biometriaNoLogin = ref(false);
const biometriaEmDestaque = ref(biometriaAtivaAqui());
const ofertaBiometria = ref(false);

// ── Entrada pelo cofre do LoginHUB ──────────────────────────────────────────
// A chave da conta mora no cofre do hub, que abre com a digital do aparelho
// (Touch ID no Mac) e assina a entrada. `cofreEmDestaque`: a entrada foi
// guardada por este navegador, então o botão do cofre vem primeiro.
const cofreEmDestaque = ref(cofreAtivoAqui());

onMounted(async () => {
  // Volta do cofre: a assinatura veio no `#` e vira sessão antes de qualquer outra coisa.
  loading.value = true;
  try {
    if (await auth.concluirEntradaPeloCofre()) return irParaApp();
  } catch (e) {
    error.value = traduzir(e);
  } finally {
    loading.value = false;
  }
  biometriaNoLogin.value = await auth.biometriaDisponivel();
});

async function entrarPeloCofre() {
  error.value = null;
  loading.value = true;
  try {
    // A página sai do app; `loading` só volta se o cofre não abriu.
    await auth.irAoCofreParaEntrar();
  } catch (e) {
    error.value = traduzir(e);
    loading.value = false;
  }
}

async function entrarComBiometria() {
  error.value = null;
  loading.value = true;
  try {
    await auth.entrarComBiometria();
    irParaApp();
  } catch (e) {
    // Fechar a janela da digital não é erro: a pessoa só desistiu.
    if ((e as { code?: string })?.code !== 'CANCELADO') error.value = traduzir(e);
  } finally {
    loading.value = false;
  }
}

/** Login completo feito: oferece a biometria deste aparelho antes de seguir. */
async function depoisDeEntrar() {
  if (biometriaNoLogin.value && podeOferecerBiometria() && (await auth.aparelhoTemBiometria())) {
    // O enrolamento de 2FA, se foi o caminho até aqui, sai da tela.
    enrolarToken.value = null;
    ofertaBiometria.value = true;
    return;
  }
  irParaApp();
}

async function ativarBiometria() {
  error.value = null;
  loading.value = true;
  try {
    await auth.ativarBiometria();
    irParaApp();
  } catch (e) {
    const codigoErro = (e as { code?: string })?.code;
    // Já cadastrado neste aparelho conta como ativado.
    if (codigoErro === 'PASSKEY_JA_CADASTRADA') return irParaApp();
    if (codigoErro !== 'CANCELADO') error.value = traduzir(e);
  } finally {
    loading.value = false;
  }
}

function agoraNao() {
  dispensarOfertaDeBiometria();
  irParaApp();
}

function irParaApp() {
  const next = router.currentRoute.value.query.next as string | undefined;
  router.replace(next || '/');
}

function traduzir(e: unknown): string {
  const codigoErro = (e as { code?: string })?.code;
  const msg = (e as Error)?.message;
  if (codigoErro === 'CREDENCIAIS_INVALIDAS' || msg === 'invalid_credentials') return 'Credenciais inválidas.';
  if (codigoErro === 'MUITAS_TENTATIVAS') return msg || 'Muitas tentativas. Aguarde alguns minutos.';
  if (codigoErro === 'CODIGO_INVALIDO') return 'Código inválido. Confira o relógio do celular e tente o próximo.';
  if (codigoErro === 'CHALLENGE_INVALIDO') return 'A janela de verificação expirou. Faça login de novo.';
  if (codigoErro === 'REDE') return 'Sem conexão com o servidor de login.';
  if (codigoErro === 'ENTRADA_INVALIDA') return 'O cofre não confirmou a entrada. Entre com e-mail e senha.';
  if (codigoErro === 'PASSKEY_INVALIDA') return 'Não foi possível confirmar a biometria. Entre com e-mail e senha.';
  if (codigoErro === 'NAO_SUPORTADO') return 'Este aparelho não conseguiu usar a biometria. Entre com e-mail e senha.';
  return msg || 'Não foi possível entrar. Tente novamente.';
}

async function submit() {
  error.value = null;
  loading.value = true;
  try {
    const r = await auth.login(email.value.trim(), password.value);

    // 'enrolar': a conta exige 2FA e ainda não tem autenticador. O QR é montado
    // aqui mesmo — atravessar origem com o passe na URL prendia o convite ao
    // build do painel do hub, e deixava o passe no historico do navegador.
    if (r.etapa === 'enrolar') {
      enrolarToken.value = r.setupToken;
      return;
    }
    // '2fa': o template troca para o campo de código; nada a fazer aqui.
    if (r.etapa === 'sessao') await depoisDeEntrar();
  } catch (e) {
    error.value = traduzir(e);
  } finally {
    loading.value = false;
  }
}

async function confirmarCodigo() {
  error.value = null;
  loading.value = true;
  try {
    await auth.verificarSegundoFator(codigo.value.trim(), usarBackup.value);
    await depoisDeEntrar();
  } catch (e) {
    error.value = traduzir(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-dvh grid place-items-center px-6">
    <!-- Enrolamento de 2FA: assume a tela, sem sair do app. -->
    <TwoFactorEnroll
      v-if="enrolarToken"
      class="w-full max-w-sm"
      :setup-token="enrolarToken"
      @concluido="depoisDeEntrar"
    />

    <!-- Login completo feito: oferta de ativar a biometria deste aparelho. -->
    <div v-else-if="ofertaBiometria" class="card w-full max-w-sm space-y-5 text-center">
      <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-ink-950 text-lime">
        <FingerPrintIcon class="h-9 w-9" />
      </span>
      <div class="space-y-2">
        <h1 class="font-display text-xl font-semibold">Entrar com biometria neste aparelho?</h1>
        <p class="text-sm text-muted">
          Da próxima vez, a digital ou o rosto entra direto, sem senha e sem código. A biometria não sai do seu
          aparelho.
        </p>
      </div>
      <p v-if="error" class="text-sm text-expense">{{ error }}</p>
      <button
        type="button"
        :disabled="loading"
        class="w-full bg-accent hover:bg-accent/90 text-white font-medium rounded-xl py-2.5 transition-colors duration-150 ease-smooth disabled:opacity-60"
        @click="ativarBiometria"
      >
        {{ loading ? 'Aguardando a biometria…' : 'Ativar biometria' }}
      </button>
      <button type="button" class="w-full text-sm text-muted hover:text-accent" :disabled="loading" @click="agoraNao">Agora não</button>
    </div>

    <!-- Etapa 1: credenciais -->
    <form
      v-else-if="!auth.aguardandoSegundoFator && modoEmail === 'nenhum'"
      class="card w-full max-w-sm space-y-5"
      @submit.prevent="submit"
    >
      <header class="space-y-4 flex flex-col items-center mb-6">
        <img :src="logoSrc" @error="retryLogo" alt="MoneyAPP" class="h-32 w-auto object-contain" />
        <p class="text-sm text-muted">Entre com sua conta para continuar.</p>
      </header>

      <!-- Cofre ou biometria já ativados aqui: o caminho rápido vem primeiro. -->
      <template v-if="biometriaNoLogin && (cofreEmDestaque || biometriaEmDestaque)">
        <button
          v-if="cofreEmDestaque"
          type="button"
          :disabled="loading"
          class="flex w-full items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white font-medium rounded-xl py-3 transition-colors duration-150 ease-smooth disabled:opacity-60"
          @click="entrarPeloCofre"
        >
          <!-- logo oficial do LoginHUB (apps/ui/public/favicon.svg do hub) -->
          <svg class="h-5 w-5 shrink-0 rounded-[5px] ring-1 ring-white/40" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="#2563EB"/><path fill="#fff" d="M256 64C256 64 416 96 416 224C416 339.6 348.6 428.6 256 448C163.4 428.6 96 339.6 96 224C96 96 256 64 256 64Z"/><circle cx="256" cy="200" r="30" fill="#2563EB"/><path fill="#2563EB" d="M256 240L230 320H282L256 240Z"/></svg>
          Entrar pelo cofre do LoginHUB
        </button>
        <button
          v-if="biometriaEmDestaque"
          type="button"
          :disabled="loading"
          class="flex w-full items-center justify-center gap-2 font-medium rounded-xl py-3 transition-colors duration-150 ease-smooth disabled:opacity-60"
          :class="cofreEmDestaque ? 'border border-surface-border text-fg hover:bg-surface-overlay' : 'bg-accent hover:bg-accent/90 text-white'"
          @click="entrarComBiometria"
        >
          <FingerPrintIcon class="h-5 w-5" />
          Entrar com biometria
        </button>
        <p class="text-center text-xs uppercase tracking-wide text-muted">ou com e-mail e senha</p>
      </template>

      <label class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Email</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                 focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </label>

      <label class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Senha</span>
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                 focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </label>

      <p v-if="error" class="text-sm text-expense">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full bg-accent hover:bg-accent/90 active:bg-accent/80
               text-white font-medium rounded-xl py-2.5
               transition-colors duration-150 ease-smooth
               disabled:opacity-60"
      >
        {{ loading ? 'Entrando…' : 'Entrar' }}
      </button>

      <button
        type="button"
        :disabled="loading"
        class="w-full text-sm text-muted hover:text-accent"
        @click="abrirEntradaPorEmail"
      >
        Entrar com código por e-mail
      </button>

      <!-- Sem biometria ativada aqui: discreto, para quem tem a passkey sincronizada de outro aparelho. -->
      <button
        v-if="biometriaNoLogin && !biometriaEmDestaque"
        type="button"
        :disabled="loading"
        class="flex w-full items-center justify-center gap-2 text-sm text-muted hover:text-accent"
        @click="entrarComBiometria"
      >
        <FingerPrintIcon class="h-4 w-4" />
        Entrar com biometria
      </button>

      <!-- Entrada guardada no cofre por outro navegador: discreto. -->
      <button
        v-if="biometriaNoLogin && !cofreEmDestaque"
        type="button"
        :disabled="loading"
        class="flex w-full items-center justify-center gap-2 text-sm text-muted hover:text-accent"
        @click="entrarPeloCofre"
      >
        <svg class="h-4 w-4 shrink-0" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="#2563EB"/><path fill="#fff" d="M256 64C256 64 416 96 416 224C416 339.6 348.6 428.6 256 448C163.4 428.6 96 339.6 96 224C96 96 256 64 256 64Z"/><circle cx="256" cy="200" r="30" fill="#2563EB"/><path fill="#2563EB" d="M256 240L230 320H282L256 240Z"/></svg>
        Entrar pelo cofre do LoginHUB
      </button>
    </form>

    <!-- Entrada por código de e-mail: pede o e-mail e depois os 6 dígitos. -->
    <form
      v-else-if="!auth.aguardandoSegundoFator"
      class="card w-full max-w-sm space-y-5"
      @submit.prevent="modoEmail === 'pedir' ? enviarCodigoEmail() : confirmarCodigoEmail()"
    >
      <header class="space-y-4 flex flex-col items-center mb-6">
        <img :src="logoSrc" @error="retryLogo" alt="MoneyAPP" class="h-32 w-auto object-contain" />
        <p class="text-sm text-muted">
          {{ modoEmail === 'pedir'
            ? 'Informe seu e-mail e enviaremos um código de 6 dígitos.'
            : 'Enviamos um código de 6 dígitos para o seu e-mail. Ele vale por 5 minutos.' }}
        </p>
      </header>

      <label v-if="modoEmail === 'pedir'" class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Email</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                 focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </label>

      <label v-else class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Código</span>
        <input
          v-model="codigoEmail"
          type="text"
          required
          autofocus
          autocomplete="one-time-code"
          inputmode="numeric"
          maxlength="8"
          placeholder="000000"
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                 text-center tracking-[0.3em]
                 focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </label>

      <p v-if="error" class="text-sm text-expense">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading || (modoEmail === 'codigo' && !codigoEmail)"
        class="w-full bg-accent hover:bg-accent/90 active:bg-accent/80
               text-white font-medium rounded-xl py-2.5
               transition-colors duration-150 ease-smooth
               disabled:opacity-60"
      >
        {{ loading ? 'Aguarde…' : modoEmail === 'pedir' ? 'Enviar código' : 'Entrar' }}
      </button>

      <button
        v-if="modoEmail === 'codigo'"
        type="button"
        :disabled="loading"
        class="w-full text-sm text-muted hover:text-accent"
        @click="enviarCodigoEmail"
      >
        Reenviar o código
      </button>

      <button type="button" class="w-full text-sm text-muted hover:text-accent" @click="voltarParaSenha">
        Entrar com e-mail e senha
      </button>
    </form>

    <!-- Etapa 2: segundo fator. A senha ja conferiu, mas a sessao so nasce
         depois do codigo — por isso nao ha token gravado neste ponto. -->
    <form
      v-else
      class="card w-full max-w-sm space-y-5"
      @submit.prevent="confirmarCodigo"
    >
      <header class="space-y-4 flex flex-col items-center mb-6">
        <img :src="logoSrc" @error="retryLogo" alt="MoneyAPP" class="h-32 w-auto object-contain" />
        <p class="text-sm text-muted">
          {{ auth.desafioPorEmail
            ? 'Enviamos um código de 6 dígitos para o seu e-mail. Ele vale por 5 minutos.'
            : usarBackup
              ? 'Digite um dos códigos de recuperação que você guardou.'
              : 'Digite o código de 6 dígitos do seu aplicativo autenticador.' }}
        </p>
        <GoogleAuthAviso v-if="!usarBackup && !auth.desafioPorEmail" modo="codigo" emissor="MoneyAPP" class="mt-4 text-fg" />
      </header>

      <label class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">
          {{ usarBackup ? 'Código de recuperação' : 'Código' }}
        </span>
        <input
          v-model="codigo"
          type="text"
          required
          autofocus
          autocomplete="one-time-code"
          :inputmode="usarBackup ? 'text' : 'numeric'"
          :maxlength="usarBackup ? 11 : 6"
          :placeholder="usarBackup ? 'XXXXX-XXXXX' : '000000'"
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                 text-center tracking-[0.3em]
                 focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </label>

      <p v-if="error" class="text-sm text-expense">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading || !codigo"
        class="w-full bg-accent hover:bg-accent/90 active:bg-accent/80
               text-white font-medium rounded-xl py-2.5
               transition-colors duration-150 ease-smooth
               disabled:opacity-60"
      >
        {{ loading ? 'Verificando…' : 'Verificar' }}
      </button>

      <button
        v-if="!auth.desafioPorEmail"
        type="button"
        class="w-full text-sm text-muted hover:text-accent"
        @click="usarBackup = !usarBackup; codigo = ''; error = null"
      >
        {{ usarBackup ? 'Usar o aplicativo autenticador' : 'Perdi o acesso ao autenticador' }}
      </button>
    </form>
  </main>
</template>
