import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './styles/main.css';

import { setupApi } from '@moneyapp/api-client';
import { useAuthStore } from './stores/auth';

const pinia = createPinia();
const app = createApp(App);

app.use(pinia).use(router).mount('#app');

setupApi({
  baseUrl: import.meta.env.VITE_API_BASE_URL as string,
  getToken: () => useAuthStore().token,
  // Em 401, tenta renovar o JWT via LoginHub /auth/refresh (grace de 7 dias)
  // antes de derrubar a sessão. Se renovar com sucesso, a request original
  // é retried transparentemente.
  tryRefresh: () => useAuthStore().refresh(),
  // Sem token não há sessão a derrubar (ex.: 401 antes do login) — deixa o
  // erro propagar. Com token, derruba a sessão E redireciona: sem o push o
  // usuário ficava na tela atual com todas as chamadas falhando.
  onUnauthorized: () => {
    const auth = useAuthStore();
    if (!auth.token) return;
    auth.logout();
    void router.push({ name: 'login' });
  },
});


if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Falha ao registrar service worker:', err);
      });
    });
  }
}
