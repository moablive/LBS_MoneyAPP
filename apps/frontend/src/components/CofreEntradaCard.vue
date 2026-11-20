<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LockClosedIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '../stores/auth';
import { marcarCofreAtivo } from '../lib/biometria';
import type { EntradaCofre } from '../lib/cofreEntrada';

/**
 * Entrada pelo cofre do LoginHUB: guardar a entrada desta conta no cofre e
 * ver/tirar as que já foram guardadas.
 *
 * "Guardar" sai do app para o cofre (loginhub.astralwavelabel.com), que abre
 * com a digital do aparelho e guarda, cifrada, a chave desta conta. O hub fica
 * só com a chave pública. A volta cai aqui com `?cofre=guardada` (router.ts).
 */
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const disponivel = ref(false);
const entradas = ref<EntradaCofre[]>([]);
const ocupado = ref(false);
const erro = ref('');
const aviso = ref('');

async function carregar() {
  try {
    entradas.value = await auth.listarEntradasCofre();
  } catch {
    /* silencioso: o card ainda oferece guardar */
  }
}

onMounted(async () => {
  disponivel.value = await auth.biometriaDisponivel();
  if (!disponivel.value) return;
  if (route.query.cofre === 'guardada') {
    aviso.value = 'Pronto: a entrada está no cofre. No próximo login, toque em “Entrar pelo cofre do LoginHUB”.';
    // O aviso é de uma vez só: recarregar a página não repete.
    const { cofre: _visto, ...resto } = route.query;
    void router.replace({ query: resto });
  }
  await carregar();
});

async function guardar() {
  erro.value = '';
  aviso.value = '';
  ocupado.value = true;
  try {
    // A página sai do app; `ocupado` só volta se o cofre não abriu.
    await auth.irAoCofreParaGuardar();
  } catch (e) {
    erro.value = (e as Error).message || 'O cofre não abriu.';
    ocupado.value = false;
  }
}

async function tirar(e: EntradaCofre) {
  erro.value = '';
  aviso.value = '';
  ocupado.value = true;
  try {
    await auth.removerEntradaCofre(e.id);
    await carregar();
    // Sem nenhuma entrada, a tela de login volta a abrir pelo e-mail e senha.
    if (entradas.value.length === 0) marcarCofreAtivo(false);
    aviso.value = `${e.nome} não entra mais pelo cofre.`;
  } catch (err) {
    erro.value = (err as Error).message || 'Não foi possível tirar a entrada.';
  } finally {
    ocupado.value = false;
  }
}

const data = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null);
</script>

<template>
  <div v-if="disponivel" class="mb-6">
    <p class="text-fg font-medium flex items-center gap-2">
      <LockClosedIcon class="h-5 w-5" />
      Entrar pelo cofre do LoginHUB
    </p>
    <p class="text-sm text-muted mt-1 mb-2">
      Para quem tem cofre no LoginHUB: a chave desta conta fica cifrada no cofre, que abre com a digital do aparelho
      (Touch ID no Mac) e assina a entrada, sem senha e sem código. Ative antes a digital no próprio cofre.
    </p>

    <ul v-if="entradas.length" class="mb-3 divide-y divide-surface-border rounded-xl border border-surface-border bg-surface-overlay">
      <li v-for="e in entradas" :key="e.id" class="flex items-center gap-3 px-3 py-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-fg">{{ e.nome }}</p>
          <p class="text-xs text-muted">
            guardada em {{ data(e.criado_em) }}<template v-if="e.ultimo_uso"> · último uso em {{ data(e.ultimo_uso) }}</template>
          </p>
        </div>
        <button
          type="button"
          :disabled="ocupado"
          class="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-expense/10 hover:text-expense disabled:opacity-50"
          :aria-label="`Tirar a entrada ${e.nome}`"
          title="Tirar"
          @click="tirar(e)"
        >
          <TrashIcon class="h-4 w-4" />
        </button>
      </li>
    </ul>

    <button
      type="button"
      :disabled="ocupado"
      class="bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      @click="guardar"
    >
      {{ ocupado ? 'Aguardando…' : 'Guardar a entrada no cofre do LoginHUB' }}
    </button>

    <p v-if="aviso" class="mt-2 text-sm text-income">{{ aviso }}</p>
    <p v-if="erro" class="mt-2 text-sm text-expense">{{ erro }}</p>
  </div>
</template>
