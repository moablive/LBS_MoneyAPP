import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../../context.js';
import type { LoginState } from '@moneyapp/models';
import { botApi } from '@moneyapp/api-client';
import { env } from '../../config.js';
import { mainMenuKeyboard } from '../index.js';
import { criarHubAuthBot, HubApiError, type HubSessionData } from '../../lib/hubAuthBot.js';

export const LOGIN_SCENE = 'loginScene';

const cancelKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Cancelar', 'cancel_wizard')],
]).reply_markup;

/**
 * Integração com o hub pela fonte canônica (`src/lib/`, sincronizada pelo
 * LoginHUB). O login do hub morava dentro do `botApi` e conhecia por conta
 * própria as rotas e os desfechos do `/auth/login`; agora quem sabe disso é o
 * kit, e o `botApi` cuida só do backend do MoneyAPP.
 */
const hub = criarHubAuthBot({
  baseUrl: env.LOGINHUB_API_URL,
  appId: env.LOGINHUB_APP_ID,
  appLoginUrl: env.APP_LOGIN_URL,
});

/** `true` quando o update é o clique em "Cancelar" — encerra a cena. */
async function cancelou(ctx: BotContext): Promise<boolean> {
  if ('callback_query' in ctx.update) {
    const query = ctx.update.callback_query;
    if ('data' in query && query.data === 'cancel_wizard') {
      await ctx.reply('Operação cancelada.');
      await ctx.scene.leave();
      return true;
    }
  }
  return false;
}

/** Fecha o login: descobre o dono da sessão e grava o vínculo no MoneyAPP. */
async function concluirVinculo(ctx: BotContext, session: HubSessionData) {
  const dono = hub.donoDaSessao(session);
  if (!dono) {
    await ctx.reply('❌ Não consegui validar o seu login. Tente novamente com /login.');
    return ctx.scene.leave();
  }

  const state = ctx.wizard.state as LoginState;
  await botApi.linkTelegram(dono.loginhubId, dono.email ?? state.email!, String(ctx.from!.id));

  await ctx.reply('✅ Conta vinculada com sucesso! Bem-vindo ao MoneyAPP Telegram Bot.', mainMenuKeyboard());
  return ctx.scene.leave();
}

export const loginScene = new Scenes.WizardScene<BotContext>(
  LOGIN_SCENE,

  async (ctx) => {
    await ctx.reply(
      '🔒 Bem-vindo ao Login!\n' +
        'Faça login com a sua conta do MoneyAPP (a mesma do site).\n\n' +
        '⚠️ *Importante:* é necessário já ter *definido a sua senha* pelo link ' +
        'que você recebeu no e-mail de convite. Se ainda não definiu, acesse ' +
        'https://money.astralwavelabel.com primeiro e depois volte aqui.\n\n' +
        '🔢 A conta exige *verificação em duas etapas*: tenha o seu app autenticador à mão.\n\n' +
        'Por favor, digite o seu *e-mail* cadastrado:',
      { parse_mode: 'Markdown', reply_markup: cancelKeyboard }
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (await cancelou(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Por favor, digite um e-mail válido.');
      return;
    }

    const email = ctx.message.text.trim();
    if (email.startsWith('/')) {
      await ctx.reply('Comando inválido. Operação cancelada.');
      return ctx.scene.leave();
    }

    const state = ctx.wizard.state as LoginState;
    state.email = email;

    await ctx.reply(
      '🔑 E-mail recebido!\nAgora, por favor, digite a sua *senha*:\n_(a mensagem será apagada por segurança)_',
      { parse_mode: 'Markdown', reply_markup: cancelKeyboard }
    );
    return ctx.wizard.next();
  },

  // Passo 3 — valida no LoginHub.
  //
  // O hub responde 200 em TRÊS desfechos e só um traz sessão. Os dois de 2FA
  // viravam erro aqui ("entre pelo site"), o que era um beco: com 2FA exigido de
  // TODA conta, nenhum vínculo novo se fazia pelo bot. Agora o desafio se
  // resolve no próprio chat e o enrolamento vai para a tela do hub.
  async (ctx) => {
    if (await cancelou(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Por favor, digite uma senha válida.');
      return;
    }

    const password = ctx.message.text.trim();
    if (password.startsWith('/')) {
      await ctx.reply('Comando inválido. Operação cancelada.');
      return ctx.scene.leave();
    }

    // Apaga a mensagem com a senha o quanto antes.
    await ctx.deleteMessage().catch(() => {});

    const state = ctx.wizard.state as LoginState;

    try {
      const r = await hub.login(state.email!, password);

      // Enrolamento pendente: a senha conferiu, mas a conta exige um segundo
      // fator que ainda não existe. O passe vale 10 minutos e só abre as rotas
      // de enrolamento — a tela do QR é a do hub, e é para lá que se manda. O
      // bot não desenha QR nenhum: o secret não passeia pelo chat.
      //
      // Esta mensagem sai em HTML e não em Markdown de propósito: o passe é um
      // JWT com `_` e `-`, e no Markdown do Telegram o `_` abre itálico — a
      // mensagem inteira falharia a formatação.
      if (r.status === 'enrolar') {
        await ctx.reply(
          '🔐 <b>Falta configurar a verificação em duas etapas.</b>\n\n' +
            'Abra o link abaixo no navegador e entre com o mesmo e-mail e senha. A própria tela ' +
            'mostra o QR para escanear no seu app autenticador (Google Authenticator, Authy, ' +
            '1Password...). <b>Guarde os códigos de recuperação</b> — eles aparecem uma vez só.\n\n' +
            `${hub.linkEnrolamento()}\n\n` +
            '⏳ O link vale 10 minutos. Terminou? Volte aqui e envie /login.',
          { parse_mode: 'HTML' }
        );
        return ctx.scene.leave();
      }

      // Desafio: a senha conferiu e a sessão ainda NÃO existe. Ela só nasce
      // depois do código — é exatamente isso que o segundo fator compra.
      if (r.status === 'desafio') {
        state.challengeToken = r.challengeToken;
        await ctx.reply(
          '🔢 *Verificação em duas etapas*\n\n' +
            'Digite o *código de 6 dígitos* do seu app autenticador.\n' +
            '_Perdeu o acesso ao autenticador? Mande um dos seus códigos de recuperação._',
          { parse_mode: 'Markdown', reply_markup: cancelKeyboard }
        );
        return ctx.wizard.next();
      }

      return concluirVinculo(ctx, r.session);
    } catch (err) {
      if (err instanceof HubApiError && err.status === 401) {
        await ctx.reply('Email ou senha incorretos. Tente novamente iniciando o /login.');
        return ctx.scene.leave();
      }
      // Conta ou app suspensos (403) e e-mail em mais de um app (409) têm
      // mensagem própria no hub, e ela diz mais do que "erro interno".
      if (err instanceof HubApiError && err.status !== 0) {
        await ctx.reply(`❌ ${err.message}`);
        return ctx.scene.leave();
      }
      console.error('Erro na verificação de senha:', err);
      await ctx.reply('Ocorreu um erro interno. Tente novamente.');
      return ctx.scene.leave();
    }
  },

  // Passo 4 — segundo fator. Fecha o login que o passo 3 deixou pendente.
  async (ctx) => {
    if (await cancelou(ctx)) return;

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Digite o código de 6 dígitos do seu app autenticador.');
      return;
    }

    const codigo = ctx.message.text.trim();
    const state = ctx.wizard.state as LoginState;

    // O código é credencial: sai da conversa como a senha sai.
    await ctx.deleteMessage().catch(() => {});

    if (!state.challengeToken) {
      await ctx.reply('⚠️ A janela de verificação expirou. Envie /login para começar de novo.');
      return ctx.scene.leave();
    }

    try {
      // TOTP ou código de recuperação: a rota certa sai do formato, e quem
      // decide isso é o kit.
      const session = await hub.segundoFator(state.challengeToken, codigo);
      return concluirVinculo(ctx, session);
    } catch (err) {
      // CHALLENGE_INVALIDO é a janela de 5 min vencida: não adianta insistir no
      // mesmo desafio, tem que refazer o login.
      if (err instanceof HubApiError && err.code === 'CHALLENGE_INVALIDO') {
        await ctx.reply('⚠️ A janela de verificação expirou. Envie /login para começar de novo.');
        return ctx.scene.leave();
      }
      if (err instanceof HubApiError && err.status === 401) {
        await ctx.reply(`❌ ${err.message}\n\nDigite o próximo código do autenticador:`, {
          reply_markup: cancelKeyboard,
        });
        return; // continua no mesmo passo esperando outro código
      }
      console.error('Erro na verificação do segundo fator:', err);
      await ctx.reply('Ocorreu um erro interno. Tente novamente com /login.');
      return ctx.scene.leave();
    }
  }
);
