<script setup lang="ts">
import { RouterView } from 'vue-router';
import UpdateBanner from './components/UpdateBanner.vue';
import VersionBadge from './components/VersionBadge.vue';
</script>

<template>
  <div class="min-h-dvh bg-surface-base relative overflow-hidden">
    <!-- Ambient background blobs (estáticos: a animação contínua forçava
         os cards com backdrop-filter a re-borrar o fundo a cada frame). -->
    <div class="absolute top-0 -left-4 w-72 h-72 bg-primary-soft rounded-full filter blur-3xl opacity-30"></div>
    <div class="absolute top-0 -right-4 w-72 h-72 bg-accent-soft rounded-full filter blur-3xl opacity-30"></div>
    <div class="absolute -bottom-8 left-20 w-72 h-72 bg-brand-500/20 rounded-full filter blur-3xl opacity-30"></div>
    
    <div class="relative z-10 h-full">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </div>
  </div>

  <!-- Fora do RouterView de proposito: precisam sobreviver a troca de rota. -->
  <VersionBadge />
  <UpdateBanner />
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
