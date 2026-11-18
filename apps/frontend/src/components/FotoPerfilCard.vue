<!--
  Foto de perfil (18/11/2026, pedido do dono: "está faltando um botão de enviar foto de perfil do usuário").
  A imagem escolhida é recortada em quadrado no centro e reduzida para 256 px em WebP AQUI, no navegador, antes de
  subir: vai para o settings do usuário (PATCH /users/me/settings { foto }) e aparece no avatar do menu (AppShell).
  Sem foto, fica a inicial do e-mail. Celular: o input abre a câmera ou a galeria.
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
// Configurações não fica dentro do AppShell: relê aqui também (foto trocada em outro aparelho).
onMounted(() => auth.recarregaSettings());
const entrada = ref<HTMLInputElement | null>(null);
const enviando = ref(false);
const erro = ref('');

const foto = computed(() => auth.user?.settings?.foto || null);
const inicial = computed(() => (auth.user?.email?.[0] || '?').toUpperCase());

const LADO = 256;

function carregaImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('imagem')); };
    img.src = url;
  });
}

// Quadrado do centro, 256x256, WebP 0,85 (cai para JPEG no navegador que não gera WebP).
async function reduz(arquivo: File): Promise<string> {
  const img = await carregaImagem(arquivo);
  const lado = Math.min(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = LADO; c.height = LADO;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  const webp = c.toDataURL('image/webp', 0.85);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.85);
}

async function escolheu(e: Event) {
  const input = e.target as HTMLInputElement;
  const arquivo = input.files?.[0];
  input.value = '';
  if (!arquivo) return;
  erro.value = '';
  if (!arquivo.type.startsWith('image/')) { erro.value = 'Escolha uma imagem.'; return; }
  if (arquivo.size > 25 * 1024 * 1024) { erro.value = 'Imagem acima de 25 MB.'; return; }
  enviando.value = true;
  try {
    await auth.updateSettings({ foto: await reduz(arquivo) });
  } catch {
    erro.value = 'Não deu para enviar a foto. Tente outra imagem.';
  } finally {
    enviando.value = false;
  }
}

async function remove() {
  erro.value = '';
  enviando.value = true;
  try {
    await auth.updateSettings({ foto: null });
  } catch {
    erro.value = 'Não deu para remover a foto.';
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="mb-6 pb-6 border-b border-surface-border/60 flex items-center gap-4">
    <div class="relative shrink-0">
      <img
        v-if="foto"
        :src="foto"
        alt="Sua foto de perfil"
        class="w-20 h-20 rounded-full object-cover border border-surface-border shadow-lg"
      />
      <div
        v-else
        class="w-20 h-20 rounded-full bg-lime text-lime-fg font-display font-bold text-3xl flex items-center justify-center shadow-lg shadow-lime/30"
        aria-hidden="true"
      >
        {{ inicial }}
      </div>
      <div
        v-if="enviando"
        class="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center"
        role="status"
        aria-label="Enviando a foto"
      >
        <div class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      </div>
    </div>

    <div class="min-w-0">
      <p class="text-fg font-medium">Foto de perfil</p>
      <p class="text-sm text-muted mt-1">Aparece no menu do app. A imagem é recortada em quadrado.</p>
      <div class="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          :disabled="enviando"
          class="min-h-11 px-4 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-lg shadow-accent/30"
          @click="entrada?.click()"
        >
          {{ foto ? 'Trocar foto' : 'Enviar foto' }}
        </button>
        <button
          v-if="foto"
          type="button"
          :disabled="enviando"
          class="min-h-11 px-4 rounded-xl border border-surface-border text-sm font-medium text-muted hover:text-red-400 hover:border-red-400/50 transition-colors disabled:opacity-50"
          @click="remove"
        >
          Remover
        </button>
      </div>
      <p v-if="erro" class="text-xs text-red-400 mt-2" role="alert">{{ erro }}</p>
      <input ref="entrada" type="file" accept="image/*" class="hidden" @change="escolheu" />
    </div>
  </div>
</template>
