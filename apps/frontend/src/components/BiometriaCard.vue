<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { FingerPrintIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '../stores/auth';
import { marcarBiometriaAtiva } from '../lib/biometria';
import type { HubPasskey } from '../lib/hubPasskeyClient';

/**
 * Biometria da conta: ativar neste aparelho e ver/remover os aparelhos que já
 * entram com digital ou rosto.
 *
 * Quem vê este card tem sessão completa do LoginHUB (senha + código), e é só
 * com ela que o hub aceita cadastrar uma passkey. O hub guarda apenas a chave
 * pública; a digital não sai do aparelho.
 */
const auth = useAuthStore();

const disponivel = ref(false);
const aparelhoTem = ref(false);
const aparelhos = ref<HubPasskey[]>([]);
const ocupado = ref(false);
const erro = ref('');
const aviso = ref('');

async function carregar() {
  try {
    aparelhos.value = await auth.listarBiometrias();
  } catch {
    /* silencioso: o card ainda oferece ativar */
  }
}

onMounted(async () => {
  disponivel.value = await auth.biometriaDisponivel();
  if (!disponivel.value) return;
  aparelhoTem.value = await auth.aparelhoTemBiometria();
  await carregar();
});

async function ativar() {
  erro.value = '';
  aviso.value = '';
  ocupado.value = true;
  try {
    const p = await auth.ativarBiometria();
    aviso.value = `Biometria ativada em ${p.nome}. No próximo login, toque em “Entrar com biometria”.`;
    await carregar();
  } catch (e) {
    const codigo = (e as { code?: string })?.code;
    if (codigo === 'PASSKEY_JA_CADASTRADA') {
      marcarBiometriaAtiva(true);
      aviso.value = 'Este aparelho já estava com a biometria ativada.';
    } else if (codigo !== 'CANCELADO') {
      erro.value = (e as Error).message || 'Não foi possível ativar a biometria.';
    }
  } finally {
    ocupado.value = false;
  }
}

async function remover(p: HubPasskey) {
  erro.value = '';
  aviso.value = '';
  ocupado.value = true;
  try {
    await auth.removerBiometria(p.id);
    await carregar();
    // Sem nenhum aparelho, a tela de login volta a abrir pelo e-mail e senha.
    if (aparelhos.value.length === 0) marcarBiometriaAtiva(false);
    aviso.value = `${p.nome} não entra mais com biometria.`;
  } catch (e) {
    erro.value = (e as Error).message || 'Não foi possível remover.';
  } finally {
    ocupado.value = false;
  }
}

const data = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null);
</script>

<template>
  <div v-if="disponivel" class="mb-6">
    <p class="text-fg font-medium flex items-center gap-2">
      <FingerPrintIcon class="h-5 w-5" />
      Entrar com biometria
    </p>
    <p class="text-sm text-muted mt-1 mb-2">
      A digital ou o rosto do aparelho entra direto, sem senha e sem código do autenticador. A biometria não sai do
      aparelho; o e-mail e a senha continuam valendo como reserva.
    </p>

    <ul v-if="aparelhos.length" class="mb-3 divide-y divide-surface-border rounded-xl border border-surface-border bg-surface-overlay">
      <li v-for="p in aparelhos" :key="p.id" class="flex items-center gap-3 px-3 py-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-fg">{{ p.nome }}</p>
          <p class="text-xs text-muted">
            ativada em {{ data(p.criado_em) }}<template v-if="p.ultimo_uso"> · último uso em {{ data(p.ultimo_uso) }}</template>
          </p>
        </div>
        <button
          type="button"
          :disabled="ocupado"
          class="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-expense/10 hover:text-expense disabled:opacity-50"
          :aria-label="`Remover a biometria de ${p.nome}`"
          title="Remover"
          @click="remover(p)"
        >
          <TrashIcon class="h-4 w-4" />
        </button>
      </li>
    </ul>

    <button
      v-if="aparelhoTem"
      type="button"
      :disabled="ocupado"
      class="bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      @click="ativar"
    >
      {{ ocupado ? 'Aguardando…' : 'Ativar biometria neste aparelho' }}
    </button>
    <p v-else class="text-sm text-muted">Este aparelho não tem leitor de digital, rosto ou PIN do sistema configurado.</p>

    <p v-if="aviso" class="mt-2 text-sm text-income">{{ aviso }}</p>
    <p v-if="erro" class="mt-2 text-sm text-expense">{{ erro }}</p>
  </div>
</template>
