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
