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
  onUnauthorized: () => useAuthStore().logout(),
});


if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}
