<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const requireReceipts = ref(auth.user?.settings?.requireReceipts ?? true);
const saving = ref(false);
const message = ref('');

async function save() {
  saving.value = true;
  message.value = '';
  try {
    await auth.updateSettings({ requireReceipts: requireReceipts.value });
    message.value = 'Configurações salvas com sucesso!';
    setTimeout(() => { message.value = '' }, 3000);
  } catch (err) {
    message.value = 'Erro ao salvar configurações.';
  } finally {
    saving.value = false;
  }
}

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
    <header class="mb-8">
      <h1 class="text-2xl font-bold text-slate-100 flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        Configurações
      </h1>
      <p class="text-muted mt-2">Ajuste as preferências da sua conta.</p>
    </header>

    <div class="bg-surface-raised border border-surface-border rounded-2xl p-6">
      <h2 class="text-lg font-semibold text-slate-200 mb-4 border-b border-surface-border pb-2">Comprovantes</h2>
      
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-slate-100 font-medium">Exigir comprovantes em transações pagas</p>
          <p class="text-sm text-muted mt-1">Quando ativado, você não poderá marcar uma despesa/receita como "Paga" sem antes anexar um arquivo de comprovante.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="requireReceipts" class="sr-only peer">
          <div class="w-11 h-6 bg-surface-overlay peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-surface-border"></div>
        </label>
      </div>

      <div class="mt-8 pt-4 border-t border-surface-border flex items-center justify-between">
        <span class="text-sm font-medium" :class="message.includes('Erro') ? 'text-red-400' : 'text-emerald-400'">{{ message }}</span>
        <button
          @click="save"
          :disabled="saving"
          class="px-6 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shadow-lg shadow-accent/30"
        >
          {{ saving ? 'Salvando...' : 'Salvar Alterações' }}
        </button>
      </div>
    </div>

    <!-- Seção de Conta -->
    <div class="bg-surface-raised border border-surface-border rounded-2xl p-6 mt-6">
      <h2 class="text-lg font-semibold text-slate-200 mb-4 border-b border-surface-border pb-2">Conta</h2>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-slate-100 font-medium">Encerrar sessão</p>
          <p class="text-sm text-muted mt-1">Desconectar do aplicativo neste dispositivo.</p>
        </div>
        <button
          @click="logout"
          class="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl font-medium transition-colors"
        >
          Sair da Conta
        </button>
      </div>
    </div>
  </div>
</template>
