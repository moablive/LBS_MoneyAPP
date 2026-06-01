<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  actionText?: string;
}>();

defineEmits<{
  (e: 'action'): void;
}>();
</script>

<template>
  <div class="max-w-md mx-auto text-center p-8 glass-empty-state rounded-3xl border border-dashed border-white/10">
    <div class="w-32 h-32 mx-auto mb-6 bg-white/5 rounded-full flex items-center justify-center border border-white/5 relative">
      <div class="absolute inset-0 bg-accent/20 blur-xl rounded-full"></div>
      
      <slot name="icon">
        <svg class="w-12 h-12 text-white/50 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </slot>
      
      <svg class="w-5 h-5 text-accent absolute -top-2 -right-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z"/></svg>
      <svg class="w-3 h-3 text-white/40 absolute bottom-4 -left-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z"/></svg>
    </div>
    
    <h3 class="text-xl font-bold text-white mb-2">{{ title }}</h3>
    <p class="text-sm text-white/50 mb-8">{{ description }}</p>
    
    <button
      v-if="actionText"
      class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:opacity-90 text-white font-medium shadow-lg shadow-accent/25 transition-all"
      @click="$emit('action')"
    >
      <slot name="action-icon">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      </slot>
      {{ actionText }}
    </button>
  </div>
</template>

<style scoped>
.glass-empty-state {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  backdrop-filter: blur(10px);
}
</style>
