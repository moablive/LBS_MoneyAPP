<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
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

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
  error.value = null;
  loading.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    const next = router.currentRoute.value.query.next as string | undefined;
    router.replace(next || '/');
  } catch (e) {
    error.value = (e as Error).message === 'invalid_credentials'
      ? 'Credenciais inválidas.'
      : 'Não foi possível entrar. Tente novamente.';
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
        <p class="text-sm text-muted">Entre com sua conta para continuar.</p>
      </header>

      <label class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Email</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                 focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </label>

      <label class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Senha</span>
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                 focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </label>

      <p v-if="error" class="text-sm text-expense">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full bg-accent hover:bg-accent/90 active:bg-accent/80
               text-white font-medium rounded-xl py-2.5
               transition-colors duration-150 ease-smooth
               disabled:opacity-60"
      >
        {{ loading ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </main>
</template>
