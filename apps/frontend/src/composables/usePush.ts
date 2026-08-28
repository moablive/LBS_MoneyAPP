import { ref } from 'vue';
import { api } from '@moneyapp/api-client';
import {
  notifyCentralAtivo,
  notifyPublicKey,
  notifyRegistrarWebPush,
  notifyRemoverWebPush,
} from '../lib/lbsNotifyClient';

/**
 * Chave do JWT do LoginHUB no localStorage — a MESMA que o `tokenKey` do
 * auth-kit usa neste app. Cada app tem a sua; não unifique sem migrar o
 * storage, ou todo mundo cai para a tela de login no deploy seguinte.
 */
const CHAVE_TOKEN = 'token';

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

/**
 * A inscrição foi criada com esta chave pública?
 *
 * `applicationServerKey` volta como ArrayBuffer cru; a comparação é feita na
 * forma base64url, que é como a chave chega da API.
 */
function mesmaChave(sub: PushSubscription, publicKey: string): boolean {
  const bruto = sub.options?.applicationServerKey;
  if (!bruto) return false;
  const bytes = new Uint8Array(bruto as ArrayBuffer);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const atual = window.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return atual === publicKey.replace(/=+$/, '');
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
      // A chave vem de quem VAI entregar. Assinar com a chave de um serviço e
      // mandar pelo outro produz 403 no servidor de push do navegador.
      const publicKey = notifyCentralAtivo
        ? await notifyPublicKey()
        : (await api.get<{ publicKey: string }>('/push/public-key')).publicKey;

      let sub = await reg.pushManager.getSubscription();
      // Uma inscrição existente pode ter sido criada com a chave do OUTRO
      // caminho (é o caso de todo aparelho que já tinha push antes do LBS
      // Notify). Ela nunca passaria a receber pela central, e o sintoma seria
      // "ativei e não chega nada" — sem erro nenhum. Por isso a chave é
      // conferida e a inscrição divergente é refeita.
      if (sub && !mesmaChave(sub, publicKey)) {
        await sub.unsubscribe().catch(() => {});
        sub = null;
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      if (notifyCentralAtivo) await notifyRegistrarWebPush(sub.toJSON(), CHAVE_TOKEN);
      else await api.post('/push/subscribe', sub.toJSON());
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
        if (notifyCentralAtivo) {
          await notifyRemoverWebPush(sub.endpoint, CHAVE_TOKEN).catch(() => {});
        } else {
          await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        }
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
