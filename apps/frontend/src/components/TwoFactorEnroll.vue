<script setup lang="ts">
import { onMounted, ref } from 'vue';
import QRCode from 'qrcode';
import { useAuthStore } from '../stores/auth';
import type { TwoFactorSetupData } from '../lib/hubAuthClient';

/**
 * Enrolamento de 2FA, dentro do proprio app.
 *
 * POR QUE ISTO EXISTE
 *
 * Antes, `require2FASetup` mandava a pessoa para `loginhub.../enrolar-2fa` com
 * o passe na query string. Duas consequencias, as duas observadas em producao:
 *
 *  1. O fluxo passava a depender do build do painel do hub. Um navegador com o
 *     service worker antigo do hub em cache nao conhecia aquela rota, caia no
 *     `<Route path="*">` e ia parar no LOGIN DO HUB — que e exatamente o
 *     "voltei para o login hub" relatado, com a conta ainda sem 2FA.
 *  2. O passe ficava no historico do navegador e no log de acesso, porque
 *     query string e registrada em todo lugar por onde a URL passa.
 *
 * O Sul Alimentos ja fazia certo: enrola em casa. Este componente traz o mesmo
 * modelo para ca. O QR e desenhado NO NAVEGADOR a partir da URI `otpauth://` —
 * nenhum gerador de terceiro ve o segredo — e a chave em texto continua como
 * alternativa para quem prefere digitar.
 */
const props = defineProps<{ setupToken: string }>();
const emit = defineEmits<{ (e: 'concluido'): void }>();

const auth = useAuthStore();

const dados = ref<TwoFactorSetupData | null>(null);
const qrDataUrl = ref('');
const codigo = ref('');
const backupCodes = ref<string[] | null>(null);
const carregando = ref(false);
const copiado = ref(false);
const erro = ref('');

onMounted(async () => {
  carregando.value = true;
  try {
    dados.value = await auth.iniciarEnrolamento(props.setupToken);
    // Falhar o QR nao pode travar o enrolamento: a chave manual resolve.
    try {
      qrDataUrl.value = await QRCode.toDataURL(dados.value.otpauthUri, {
        width: 200,
        margin: 1,
        color: { dark: '#121215', light: '#ffffff' },
      });
    } catch {
      qrDataUrl.value = '';
    }
  } catch (e) {
    erro.value = traduzir(e);
  } finally {
    carregando.value = false;
  }
});

function traduzir(e: unknown): string {
  const cod = (e as { code?: string })?.code;
  if (cod === 'CODIGO_INVALIDO') return 'Codigo invalido. Confira o relogio do celular e tente o proximo.';
  if (cod === 'MUITAS_TENTATIVAS') return (e as Error).message;
  if (cod === 'TOKEN_EXPIRADO' || cod === 'TOKEN_NAO_E_SESSAO' || cod === 'TOKEN_INVALIDO')
    return 'A janela de configuracao expirou. Entre de novo para gerar outro codigo.';
  if (cod === 'REDE') return 'Sem conexao com o servidor de login.';
  return (e as Error)?.message || 'Nao foi possivel configurar a verificacao em duas etapas.';
}

async function confirmar() {
  if (carregando.value) return;
  carregando.value = true;
  erro.value = '';
  try {
    const r = await auth.confirmarEnrolamento(codigo.value.trim(), props.setupToken);
    backupCodes.value = r.backupCodes;
  } catch (e) {
    erro.value = traduzir(e);
  } finally {
    carregando.value = false;
  }
}

function copiar() {
  if (!backupCodes.value) return;
  void navigator.clipboard.writeText(backupCodes.value.join('\n'));
  copiado.value = true;
}
</script>

<template>
  <div
    class="bg-surface-raised/60 backdrop-blur-xl border border-white/10 p-10 rounded-[2rem] shadow-modal animate-fade-in-up"
  >
    <!-- Codigos de recuperacao: unica vez que aparecem. -->
    <template v-if="backupCodes">
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#22c55e] to-[#4ade80] shadow-lg mb-6"
        >
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 class="text-2xl font-display font-semibold tracking-tight">Verificacao ativada</h1>
      </div>

      <div class="rounded-2xl border border-[#ff9500]/40 bg-[#ff9500]/10 p-4 mb-6">
        <strong class="block text-white text-sm">Guarde estes codigos agora.</strong>
        <span class="text-muted text-sm">
          Eles nao voltam a ser exibidos e sao a sua unica entrada se voce perder o celular.
          Cada um serve uma vez so.
        </span>
      </div>

      <ul class="grid grid-cols-2 gap-2 mb-6">
        <li
          v-for="c in backupCodes"
          :key="c"
          class="rounded-xl border border-surface-border bg-surface-overlay/50 px-3 py-2 text-center font-mono text-sm text-white"
        >
          {{ c }}
        </li>
      </ul>

      <button
        type="button"
        class="w-full mb-3 py-3.5 rounded-2xl font-semibold text-white bg-surface-overlay/70 border border-surface-border hover:bg-surface-overlay transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        @click="copiar"
      >
        {{ copiado ? 'Copiado' : 'Copiar todos' }}
      </button>

      <button
        type="button"
        class="w-full py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-accent to-primary shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        @click="emit('concluido')"
      >
        Continuar para o MoneyAPP
      </button>

      <p class="text-xs text-muted text-center mt-4">
        Suas outras sessoes foram encerradas. Voce vai precisar entrar de novo nos outros dispositivos.
      </p>
    </template>

    <!-- Enrolamento -->
    <template v-else>
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent to-primary shadow-lg mb-6"
        >
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M9 12.75L11.25 15 15 9.75M21 12c0 4.97-3.79 9.16-8.66 9.93a1.5 1.5 0 01-.68 0C6.79 21.16 3 16.97 3 12V6.24a1.5 1.5 0 01.98-1.4l7.5-2.73a1.5 1.5 0 011.04 0l7.5 2.73a1.5 1.5 0 01.98 1.4V12z"
            />
          </svg>
        </div>
        <h1 class="text-2xl font-display font-semibold tracking-tight">Verificacao em duas etapas</h1>
        <p class="text-muted mt-2 text-sm">Obrigatoria nesta conta. Tenha o celular a mao.</p>
      </div>

      <div v-if="carregando && !dados" class="flex justify-center py-10">
        <div class="w-8 h-8 rounded-full border-2 border-surface-border border-t-accent animate-spin"></div>
      </div>

      <template v-else-if="dados">
        <ol class="list-decimal space-y-1 pl-5 text-sm text-muted mb-6">
          <li>Abra o Google Authenticator, Authy, 1Password ou Microsoft Authenticator.</li>
          <li>{{ qrDataUrl ? 'Escaneie o QR abaixo (ou informe a chave manualmente).' : 'Adicione uma conta e informe a chave abaixo.' }}</li>
          <li>Digite o codigo de 6 digitos que o app mostrar.</li>
        </ol>

        <div v-if="qrDataUrl" class="flex justify-center mb-6">
          <img
            :src="qrDataUrl"
            alt="QR Code para o aplicativo autenticador"
            class="rounded-2xl bg-white p-3 shadow-lg"
          />
        </div>

        <div class="rounded-2xl border border-surface-border bg-surface-overlay/50 p-4 mb-6">
          <p class="text-[11px] uppercase tracking-wider text-muted">Conta</p>
          <p class="text-sm text-white break-all">{{ dados.label }}</p>
          <p class="text-[11px] uppercase tracking-wider text-muted mt-3">Chave</p>
          <code class="block break-all font-mono text-sm text-white">{{ dados.secret }}</code>
          <a :href="dados.otpauthUri" class="mt-3 inline-block text-xs text-accent hover:underline">
            Estou no celular — abrir no autenticador
          </a>
        </div>

        <form class="space-y-6" @submit.prevent="confirmar">
          <input
            v-model="codigo"
            type="text"
            required
            autocomplete="one-time-code"
            inputmode="numeric"
            maxlength="6"
            placeholder="000000"
            class="w-full bg-surface-overlay/50 border border-surface-border rounded-2xl px-5 py-4 text-center tracking-[0.4em] text-white placeholder-muted focus:border-accent focus:bg-surface-overlay focus:ring-1 focus:ring-accent outline-none transition-all duration-300"
          />

          <p v-if="erro" class="text-sm text-red-400 text-center">{{ erro }}</p>

          <button
            type="submit"
            :disabled="carregando || codigo.trim().length !== 6"
            class="w-full py-4 rounded-2xl font-semibold text-white bg-gradient-to-r from-accent to-primary shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100"
          >
            {{ carregando ? 'Ativando...' : 'Ativar' }}
          </button>
        </form>
      </template>

      <p v-else-if="erro" class="text-sm text-red-400 text-center">{{ erro }}</p>
    </template>
  </div>
</template>
