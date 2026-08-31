<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import Modal from './Modal.vue';
import { api } from '@moneyapp/api-client';
import { PhotoIcon } from '@heroicons/vue/24/outline';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'parsed', data: any, file: File | null): void;
}>();

const MAX_SIZE = 15 * 1024 * 1024;

const fileInput = ref<HTMLInputElement | null>(null);
const imageFile = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
// Contador em vez de booleano: `dragleave` dispara ao passar por cima de cada
// filho da área, e um booleano faria o destaque piscar durante o arrasto.
const dragDepth = ref(0);

function acceptFile(file: File | null | undefined) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    error.value = 'Envie uma imagem (PNG, JPG, WEBP).';
    return;
  }
  if (file.size > MAX_SIZE) {
    error.value = 'A imagem excede o tamanho máximo de 15MB.';
    return;
  }
  error.value = null;
  imageFile.value = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

function handleImageChange(e: Event) {
  const target = e.target as HTMLInputElement;
  acceptFile(target.files?.[0]);
  // Permite reanexar o mesmo arquivo depois de removê-lo.
  target.value = '';
}

function onDragEnter() {
  dragDepth.value++;
}

function onDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1);
}

function onDrop(e: DragEvent) {
  dragDepth.value = 0;
  const dt = e.dataTransfer;
  if (!dt) return;
  const file =
    Array.from(dt.items ?? [])
      .find((i) => i.kind === 'file')
      ?.getAsFile() ?? dt.files?.[0];
  acceptFile(file);
}

// Ctrl+V com print do comprovante: mesmo caminho do arrastar.
function onPaste(e: ClipboardEvent) {
  const file = Array.from(e.clipboardData?.items ?? [])
    .find((i) => i.kind === 'file')
    ?.getAsFile();
  if (file) {
    e.preventDefault();
    acceptFile(file);
  }
}

// Errar o alvo por um centímetro e soltar a imagem no fundo do modal faria o
// navegador abrir o arquivo e sair do app, levando junto o que já foi digitado.
// Enquanto o modal está aberto, nada mais na página aceita arquivo arrastado.
function blockDrop(e: DragEvent) {
  e.preventDefault();
}

function bindWindow(on: boolean) {
  const bind = (type: string, fn: EventListener) =>
    on ? window.addEventListener(type, fn) : window.removeEventListener(type, fn);
  bind('paste', onPaste as EventListener);
  bind('dragover', blockDrop as EventListener);
  bind('drop', blockDrop as EventListener);
}

watch(() => props.open, bindWindow, { immediate: true });
onUnmounted(() => bindWindow(false));

async function handleParse() {
  if (!imagePreview.value) {
    error.value = 'Anexe uma imagem do comprovante.';
    return;
  }
  
  loading.value = true;
  error.value = null;
  
  try {
    let payload: any = {};
    if (imagePreview.value) {
      // Remove prefix "data:image/jpeg;base64,"
      const base64 = imagePreview.value.split(',')[1];
      payload.imageBase64 = base64;
    }

    const res = await api.post('/transactions/ai-parse', payload);
    emit('parsed', res, imageFile.value);
    close();
  } catch (e: any) {
    console.error('AI Parse failed', e);
    error.value = 'Falha ao processar a transação. Tente novamente.';
  } finally {
    loading.value = false;
  }
}

function close() {
  imageFile.value = null;
  imagePreview.value = null;
  error.value = null;
  loading.value = false;
  dragDepth.value = 0;
  emit('close');
}
</script>

<template>
  <Modal :open="open" @close="close" title="Leitura Inteligente (IA)" max-width="md">
    <!-- O `drop` também é capturado fora da caixa tracejada: sem isto, soltar a
         imagem a um centímetro do alvo faz o navegador abrir o arquivo e sair do app. -->
    <div class="space-y-6" @dragover.prevent @drop.prevent>
      <p class="text-sm text-muted">
        Envie a foto de um comprovante (PIX, NF). 
        Nossa Inteligência Artificial vai preencher tudo automaticamente para você.
      </p>

      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted">Comprovante (Imagem)</label>
          <div
            class="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-colors cursor-pointer relative"
            :class="dragDepth > 0
              ? 'border-accent bg-accent/10'
              : 'border-surface-border bg-surface-base hover:border-accent/50'"
            @click="fileInput?.click()"
            @dragenter.prevent="onDragEnter"
            @dragover.prevent
            @dragleave.prevent="onDragLeave"
            @drop.prevent.stop="onDrop"
          >
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleImageChange" />
            <template v-if="!imagePreview">
              <PhotoIcon class="w-8 h-8 text-muted mb-2" />
              <span class="text-sm text-muted">
                {{ dragDepth > 0 ? 'Solte a imagem aqui' : 'Clique, arraste ou cole (Ctrl+V) uma imagem' }}
              </span>
            </template>
            <template v-else>
              <img :src="imagePreview" class="max-h-32 object-contain rounded-lg pointer-events-none" />
              <button @click.stop="imageFile = null; imagePreview = null" class="absolute top-2 right-2 bg-black/50 w-6 h-6 flex items-center justify-center rounded-full text-white hover:bg-black/70">
                &times;
              </button>
            </template>
          </div>
        </div>
        
        <p v-if="error" class="text-red-400 text-xs mt-1">{{ error }}</p>
      </div>

      <div class="flex justify-end gap-3 pt-4 border-t border-surface-border">
        <button
          @click="close"
          class="px-5 py-2.5 rounded-xl text-sm font-semibold text-muted hover:text-white transition-colors"
        >
          Cancelar
        </button>
        <button
          @click="handleParse"
          :disabled="loading || !imagePreview"
          class="bg-accent text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          <span>{{ loading ? 'Analisando...' : 'Analisar com IA' }}</span>
        </button>
      </div>
    </div>
  </Modal>
</template>
