import type { Request } from 'express';

/**
 * A requisicao chegou pela BORDA PUBLICA?
 *
 * Topologia: Internet -> cloudflared -> nginx do frontend -> `proxy_pass /api`
 * -> backend. O backend NAO publica porta no host (`expose: "3000"`, nao
 * `ports:`), entao a unica entrada externa e o nginx do frontend, que SEMPRE
 * carimba `X-Forwarded-For`/`X-Real-IP` ao repassar (`proxy_add_x_forwarded_for`).
 *
 * Os chamadores de servico legitimos — o bot do Telegram e o backend do TodoAPP
 * — falam com `moneyapp_backend:3000` DIRETO na rede interna `awl_network` e nao
 * trazem esses headers.
 *
 * Logo, a presenca desses headers numa autenticacao por `x-api-key` significa
 * que a chave de servico veio da internet, coisa que nenhum chamador legitimo
 * faz. E essa a trava que impede quem tem a chave (a mesma do ecossistema
 * inteiro) de ler qualquer conta escolhendo o `x-user-id` pela URL publica.
 */
export function veioDaBordaPublica(req: Request): boolean {
  return req.headers['x-forwarded-for'] !== undefined
    || req.headers['x-real-ip'] !== undefined;
}
