import http from 'node:http';
import crypto from 'node:crypto';
import type { Telegraf } from 'telegraf';

/**
 * Moabinho IA — este bot deixou de escutar o Telegram sozinho.
 *
 * Com MOABINHOIA_GATEWAY_SECRET no ambiente, quem faz o long-polling é o hub
 * (@moabinho_bot, container moabinhoia_bot do painel). Ele guarda em que
 * módulo cada usuário está e entrega aqui só os updates deste app, por HTTP na
 * awl_network. A resposta sai direto daqui para a API do Telegram — com o
 * token do Moabinho IA, que é o TELEGRAM_BOT_TOKEN deste .env desde a migração.
 *
 * Sem o segredo, nada disto liga e o bot volta a fazer polling com o token
 * que estiver no .env: é o caminho de volta, sem tocar em código.
 */
export const SEGREDO = process.env.MOABINHOIA_GATEWAY_SECRET ?? '';
export const noMoabinhoIA = SEGREDO.length > 0;

/** Botão que o hub intercepta para voltar ao menu de módulos. */
export const BOTAO_CASA = '🏠 Moabinho IA';

const confere = (recebido: string | string[] | undefined) => {
  const a = Buffer.from(String(recebido ?? ''));
  const b = Buffer.from(SEGREDO);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export function receberDoMoabinhoIA(bot: Telegraf<any>) {
  const porta = Number(process.env.MOABINHOIA_PORTA || 8090);
  http
    .createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/update') return void res.writeHead(404).end();
      if (!confere(req.headers['x-moabinhoia-secret'])) return void res.writeHead(401).end();
      let corpo = '';
      req.setEncoding('utf8');
      req.on('data', (c) => {
        corpo += c;
        if (corpo.length > 1_000_000) req.destroy();
      });
      req.on('end', () => {
        let update: any;
        try {
          update = JSON.parse(corpo);
        } catch {
          return void res.writeHead(400).end();
        }
        // Responde já: o hub não espera o handler, que pode levar minutos
        // (áudio, IA). Erro do handler cai no bot.catch, como no polling.
        res.writeHead(204).end();
        bot.handleUpdate(update).catch((err) => console.error('[moabinhoia] update falhou:', err));
      });
    })
    .listen(porta, () => console.log(`🧙 recebendo do Moabinho IA na porta ${porta}`));
}
