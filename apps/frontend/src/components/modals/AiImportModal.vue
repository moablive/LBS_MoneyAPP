<script setup lang="ts">
import { ref } from 'vue';
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

const fileInput = ref<HTMLInputElement | null>(null);
const imageFile = ref<File | null>(null);
const imagePreview = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

function handleImageChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    imageFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

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
  emit('close');
}
</script>

<template>
  <Modal :open="open" @close="close" title="Leitura Inteligente (IA)" max-width="md">
    <div class="space-y-6">
      <p class="text-sm text-muted">
        Envie a foto de um comprovante (PIX, NF). 
        Nossa Inteligência Artificial vai preencher tudo automaticamente para você.
      </p>

      <div class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted">Comprovante (Imagem)</label>
          <div class="border-2 border-dashed border-surface-border rounded-xl p-4 flex flex-col items-center justify-center bg-surface-base hover:border-accent/50 transition-colors cursor-pointer relative" @click="fileInput?.click()">
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleImageChange" />
            <template v-if="!imagePreview">
              <PhotoIcon class="w-8 h-8 text-muted mb-2" />
              <span class="text-sm text-muted">Clique para anexar uma imagem</span>
            </template>
            <template v-else>
              <img :src="imagePreview" class="max-h-32 object-contain rounded-lg" />
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
