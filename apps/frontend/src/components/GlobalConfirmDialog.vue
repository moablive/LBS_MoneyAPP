<script setup lang="ts">
import { useConfirmDialog } from '../composables/useConfirmDialog';
import Modal from './Modal.vue';

const { isOpen, options, close } = useConfirmDialog();
</script>

<template>
  <Modal :open="isOpen" @close="close(false)">
    <div class="p-6 space-y-6">
      <header>
        <h2 class="text-xl font-bold tracking-tight text-white">{{ options.title || (options.isAlert ? 'Atenção' : 'Confirmação') }}</h2>
      </header>
      
      <p class="text-sm text-slate-300">
        {{ options.message }}
      </p>

      <div class="pt-2 flex justify-end gap-3">
        <button
          v-if="!options.isAlert"
          @click="close(false)"
          class="px-5 py-2.5 rounded-xl border border-surface-border text-white text-sm font-bold hover:bg-surface-raised transition-colors"
        >
          {{ options.cancelText || 'Cancelar' }}
        </button>
        <button
          @click="close(true)"
          class="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-colors shadow-lg"
        >
          {{ options.confirmText || 'OK' }}
        </button>
      </div>
    </div>
  </Modal>
</template>
