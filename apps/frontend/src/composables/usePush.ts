import { ref } from 'vue';
import { api } from '@moneyapp/api-client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePush() {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const permission = ref<NotificationPermission | 'unsupported'>(
    isSupported ? Notification.permission : 'unsupported'
  );
  const isSubscribed = ref(false);
  const isBusy = ref(false);
  const error = ref<string | null>(null);

  async function refresh() {
    if (!isSupported) return;
    permission.value = Notification.permission;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      isSubscribed.value = Boolean(sub);
    } catch {
      isSubscribed.value = false;
    }
  }

  async function enable(): Promise<boolean> {
    if (!isSupported) return false;
    isBusy.value = true;
    error.value = null;
    try {
      const perm = await Notification.requestPermission();
      permission.value = perm;
      if (perm !== 'granted') {
        error.value = 'Permissão de notificação negada pelo navegador.';
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await api.get<{ publicKey: string }>('/push/public-key');

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      await api.post('/push/subscribe', sub.toJSON());
      isSubscribed.value = true;
      return true;
    } catch (err: any) {
      console.error('Erro ao ativar push:', err);
      error.value = 'Não foi possível ativar as notificações neste aparelho.';
      return false;
    } finally {
      isBusy.value = false;
    }
  }

  async function disable() {
    if (!isSupported) return;
    isBusy.value = true;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      isSubscribed.value = false;
    } finally {
      isBusy.value = false;
    }
  }

  refresh();

  return { isSupported, permission, isSubscribed, isBusy, error, refresh, enable, disable };
}
