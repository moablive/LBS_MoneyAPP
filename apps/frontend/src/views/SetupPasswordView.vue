<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

// Logo por URL estável (public/) com retry caso falhe ao carregar.
const LOGO_SRC = '/logo/MONEYAPP.png';
const logoSrc = ref(LOGO_SRC);
let logoRetries = 0;
function retryLogo() {
  if (logoRetries >= 3) return;
  logoRetries += 1;
  setTimeout(() => {
    logoSrc.value = `${LOGO_SRC}?r=${logoRetries}`;
  }, 400 * logoRetries);
}

const password = ref('');
const passwordConfirm = ref('');
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const loading = ref(false);

const token = ref<string | null>(null);

onMounted(() => {
  const queryToken = route.query.token as string | undefined;
  if (!queryToken) {
    error.value = 'Link de acesso inválido ou expirado. Verifique o seu e-mail.';
  } else {
    token.value = queryToken;
  }
});

async function submit() {
  if (!token.value) return;

  if (password.value.length < 6) {
    error.value = 'A senha deve ter pelo menos 6 caracteres.';
    return;
  }
  if (password.value !== passwordConfirm.value) {
    error.value = 'As senhas não coincidem.';
    return;
  }

  error.value = null;
  loading.value = true;
  try {
    await auth.setupPassword(token.value, password.value);
    successMessage.value = 'Senha definida com sucesso! Redirecionando para o login...';
    setTimeout(() => {
      router.replace('/login');
    }, 2000);
  } catch (e) {
    error.value = 'Não foi possível definir a senha. O link pode ser inválido ou já ter sido utilizado.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-dvh grid place-items-center px-6">
    <form
      class="card w-full max-w-sm space-y-5"
      @submit.prevent="submit"
    >
      <header class="space-y-4 flex flex-col items-center mb-6">
        <img :src="logoSrc" @error="retryLogo" alt="MoneyAPP" class="h-32 w-auto object-contain mix-blend-screen" />
        <p class="text-sm text-muted text-center">Defina sua senha definitiva para acessar o aplicativo.</p>
      </header>

      <div v-if="successMessage" class="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm text-center">
        {{ successMessage }}
      </div>
      
      <div v-else-if="!token && error" class="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
        {{ error }}
      </div>

      <template v-else>
        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Nova Senha</span>
          <input
            v-model="password"
            type="password"
            required
            placeholder="Mínimo 6 caracteres"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                   focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Confirmar Senha</span>
          <input
            v-model="passwordConfirm"
            type="password"
            required
            placeholder="Digite a senha novamente"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                   focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>

        <p v-if="error" class="text-sm text-expense">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading || !token"
          class="w-full bg-accent hover:bg-accent/90 active:bg-accent/80
                 text-white font-medium rounded-xl py-2.5
                 transition-colors duration-150 ease-smooth
                 disabled:opacity-60"
        >
          {{ loading ? 'Salvando…' : 'Salvar Senha' }}
        </button>
      </template>

      <div class="text-center mt-4">
        <router-link to="/login" class="text-xs text-muted hover:text-white transition-colors">
          Voltar para o Login
        </router-link>
      </div>
    </form>
  </main>
</template>
