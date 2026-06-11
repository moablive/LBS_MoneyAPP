<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '@moneyapp/api-client';
import { useAuthStore } from '../stores/auth';
import Modal from './Modal.vue';

const authStore = useAuthStore();

const newPassword = ref('');
const confirmPassword = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

const open = ref(false);

watch(() => authStore.user?.defaultPassword, (isDefault) => {
  if (isDefault) {
    open.value = true;
  }
}, { immediate: true });

async function submit() {
  error.value = null;
  if (!newPassword.value || newPassword.value.length < 6) {
    error.value = 'A senha deve ter pelo menos 6 caracteres.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'As senhas não coincidem.';
    return;
  }

  submitting.value = true;
  try {
    await api.post('/users/me/password', { newPassword: newPassword.value });
    
    // Update local state so it doesn't prompt again
    if (authStore.user) {
      authStore.user.defaultPassword = false;
      authStore.persist();
    }
    open.value = false;
  } catch (err: any) {
    error.value = err.message || 'Ocorreu um erro ao alterar a senha.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <!-- disableClickOutside and hideCloseBtn so the user is forced to change it -->
  <Modal 
    :open="open" 
    title="Atualizar Senha" 
    :disableClickOutside="true"
    :hideCloseBtn="true"
  >
    <form @submit.prevent="submit" class="p-4 space-y-4">
      <div v-if="error" class="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
        {{ error }}
      </div>

      <p class="text-sm text-muted">
        Parece que este é seu primeiro acesso ou sua senha foi redefinida. Por favor, crie uma nova senha para continuar.
      </p>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Nova Senha
        </label>
        <input 
          v-model="newPassword" 
          type="password" 
          required 
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors" 
          placeholder="Mínimo 6 caracteres" 
        />
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
          Confirmar Nova Senha
        </label>
        <input 
          v-model="confirmPassword" 
          type="password" 
          required 
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors" 
          placeholder="Digite novamente" 
        />
      </div>

      <div class="pt-2">
        <button 
          type="submit" 
          :disabled="submitting" 
          class="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-accent hover:bg-accent/90 text-white font-medium rounded-xl transition-all disabled:opacity-50"
        >
          <span v-if="submitting">Salvando...</span>
          <span v-else>Salvar Nova Senha</span>
        </button>
      </div>
    </form>
  </Modal>
</template>
