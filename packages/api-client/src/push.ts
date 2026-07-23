import { api } from './client.js';

export async function pushPublicKey(): Promise<{ publicKey: string | undefined }> {
  return api.get('/push/public-key');
}

export async function pushSubscribe(subscription: any): Promise<void> {
  return api.post('/push/subscribe', subscription);
}

export async function pushUnsubscribe(endpoint: string): Promise<void> {
  return api.post('/push/unsubscribe', { endpoint });
}
