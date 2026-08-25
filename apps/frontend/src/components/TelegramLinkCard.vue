<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import QRCode from 'qrcode';
import { api } from '@moneyapp/api-client';

/**
 * Vínculo híbrido do Telegram: o PC autentica, o chat só recebe o vínculo.
 *
 * POR QUE ISTO SUBSTITUI O `/login` DO BOT
 *
 * O bot pedia e-mail, senha e o código do 2FA dentro da conversa. Tudo isso fica
 * no histórico do Telegram — nos servidores deles, no aparelho e em qualquer
 * backup de chat — e o código do autenticador, que existe justamente para não
 * ser reutilizável, passava pelo mesmo canal que o resto.
 *
 * Aqui a autenticação já aconteceu: quem vê este botão tem sessão do LoginHUB,
 * com 2FA cumprido. O que atravessa o chat é um passe de uso único, válido por
 * 10 minutos, que não abre nada além de gravar o vínculo.
 */
const telegramId = ref<string | null>(null);
const deepLink = ref<string | null>(null);
const qrDataUrl = ref('');
const carregando = ref(false);
const erro = ref('');
const segundosRestantes = ref(0);

let cronometro: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  try {
    const r = await api.get<{ telegramId: string | null }>('/telegram/link');
    telegramId.value = r.telegramId;
  } catch {
    /* silencioso: o card ainda oferece o botao de vincular */
  }
});

onBeforeUnmount(pararCronometro);

function pararCronometro() {
  if (cronometro) clearInterval(cronometro);
  cronometro = null;
}

/**
 * O passe expira sozinho no servidor; o contador aqui é só honestidade visual.
 * Sem ele o QR fica na tela parecendo válido e a pessoa descobre que venceu
 * quando o bot recusa — que é o pior momento para descobrir.
 */
function iniciarCronometro(segundos: number) {
  pararCronometro();
  segundosRestantes.value = segundos;
  cronometro = setInterval(() => {
    segundosRestantes.value -= 1;
    if (segundosRestantes.value <= 0) {
      pararCronometro();
      deepLink.value = null;
      qrDataUrl.value = '';
    }
  }, 1000);
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

async function gerarLink() {
  if (carregando.value) return;
  carregando.value = true;
  erro.value = '';
  try {
    const r = await api.post<{ deepLink: string; expiresIn: number }>('/telegram/link-token');
    deepLink.value = r.deepLink;
    // QR desenhado no navegador: o passe não vai para gerador de terceiro.
    try {
      qrDataUrl.value = await QRCode.toDataURL(r.deepLink, {
        width: 180,
        margin: 1,
        color: { dark: '#121215', light: '#ffffff' },
      });
    } catch {
      qrDataUrl.value = '';
    }
    iniciarCronometro(r.expiresIn);
  } catch (e) {
    erro.value = (e as { body?: { message?: string } })?.body?.message
      ?? 'Não foi possível gerar o link. Tente de novo.';
  } finally {
    carregando.value = false;
  }
}

async function desvincular() {
  try {
    await api.delete('/telegram/link');
    telegramId.value = null;
    deepLink.value = null;
    qrDataUrl.value = '';
    pararCronometro();
  } catch (e) {
    erro.value = (e as { body?: { message?: string } })?.body?.message ?? 'Não foi possível desvincular.';
  }
}
</script>

<template>
  <div class="mb-6">
    <p class="text-slate-100 font-medium">Conta do Telegram</p>

    <!-- Já vinculado -->
    <template v-if="telegramId">
      <p class="text-sm text-muted mt-1 mb-2">
        Vinculado ao chat <code class="font-mono">{{ telegramId }}</code>.
      </p>
      <button
        type="button"
        class="bg-surface-overlay border border-surface-border rounded-xl px-4 py-2 text-slate-100 text-sm hover:border-accent transition-colors"
        @click="desvincular"
      >
        Desvincular
      </button>
    </template>

    <!-- Ainda não vinculado -->
    <template v-else>
      <p class="text-sm text-muted mt-1 mb-2">
        Você já está autenticado aqui. Gere um link e abra no Telegram — não precisa
        digitar senha nem código no chat.
      </p>

      <button
        v-if="!deepLink"
        type="button"
        :disabled="carregando"
        class="bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        @click="gerarLink"
      >
        {{ carregando ? 'Gerando...' : 'Vincular Telegram' }}
      </button>

      <div v-else class="w-full sm:w-80 space-y-3">
        <div v-if="qrDataUrl" class="flex justify-center">
          <img :src="qrDataUrl" alt="QR Code para abrir o bot no Telegram" class="rounded-xl bg-white p-2" />
        </div>

        <a
          :href="deepLink"
          target="_blank"
          rel="noopener"
          class="block text-center bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Abrir no Telegram
        </a>

        <p class="text-xs text-muted text-center">
          Uso único · expira em {{ mmss(segundosRestantes) }}
        </p>

        <button
          type="button"
          class="w-full text-xs text-muted hover:text-accent transition-colors"
          @click="gerarLink"
        >
          Gerar outro link
        </button>
      </div>
    </template>

    <p v-if="erro" class="text-sm text-red-400 mt-2">{{ erro }}</p>
  </div>
</template>
