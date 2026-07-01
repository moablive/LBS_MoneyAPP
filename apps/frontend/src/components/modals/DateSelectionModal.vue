<script setup lang="ts">
import { ref, watch } from 'vue';
import Modal from './Modal.vue';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{
  itemName?: string;
  defaultDate?: string;
}>();
const emit = defineEmits<{
  (e: 'confirm', dateStr: string): void;
}>();

const selectedDate = ref('');

watch(open, (v) => {
  if (v) {
    if (props.defaultDate) {
      selectedDate.value = props.defaultDate.slice(0, 10);
    } else {
      selectedDate.value = new Date().toISOString().slice(0, 10);
    }
  }
});

function submit() {
  if (!selectedDate.value) return;
  emit('confirm', selectedDate.value);
  open.value = false;
}
</script>

<template>
  <Modal :open="open" title="Planejar Data" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div v-if="itemName" class="p-3 bg-surface-overlay border border-surface-border rounded-xl">
        <p class="text-sm font-semibold text-white truncate">{{ itemName }}</p>
      </div>

      <label class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Para qual dia planejar?</span>
        <input
          v-model="selectedDate"
          type="date"
          required
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60 [color-scheme:dark]"
        />
      </label>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          class="px-4 py-2 rounded-xl border border-surface-border text-muted hover:text-slate-100 transition-colors"
          @click="open = false"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="px-4 py-2 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors"
        >
          Confirmar
        </button>
      </div>
    </form>
  </Modal>
</template>
