<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

const props = defineProps<{ 
  open: boolean; 
  title?: string;
  disableClickOutside?: boolean;
  hideCloseBtn?: boolean;
}>();
const emit = defineEmits<{ (e: 'close'): void }>();

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && !props.disableClickOutside) emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <transition name="modal" appear>
      <div v-if="open" class="modal-shell" @click.self="!props.disableClickOutside && emit('close')">
        <div
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header v-if="title || $slots.header" class="flex items-center justify-between mb-4">
            <slot name="header">
              <h2 class="text-lg font-semibold tracking-tight">{{ title }}</h2>
            </slot>
            <button
              v-if="!hideCloseBtn"
              type="button"
              class="text-muted hover:text-slate-100 transition-colors"
              @click="emit('close')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>
          <slot />
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  transform: translateY(16px) scale(0.98);
}
</style>
