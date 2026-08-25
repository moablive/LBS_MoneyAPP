import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../../context.js';
import type { LoginState } from '@moneyapp/models';
import { botApi } from '@moneyapp/api-client';
import { mainMenuKeyboard } from '../index.js';

export const LOGIN_SCENE = 'loginScene';

export const loginScene = new Scenes.WizardScene<BotContext>(
  LOGIN_SCENE,

  async (ctx) => {
    await ctx.reply(
      '🔒 Bem-vindo ao Login!\n' +
        'Faça login com a sua conta do MoneyAPP (a mesma do site).\n\n' +
        '⚠️ *Importante:* é necessário já ter *redefinido a sua senha padrão* pelo link ' +
        'que você recebeu no e-mail de convite. Se ainda não redefiniu, acesse ' +
        'https://money.astralwavelabel.com primeiro e depois volte aqui.\n\n' +
        'Por favor, digite o seu *e-mail* cadastrado:',
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'cancel_wizard')],
        ]).reply_markup
      }
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if ('callback_query' in ctx.update) {
      const query = ctx.update.callback_query;
      if ('data' in query && query.data === 'cancel_wizard') {
        await ctx.reply('Operação cancelada.');
        return ctx.scene.leave();
      }
    }

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
      '🔑 E-mail recebido!\nAgora, por favor, digite a sua **senha**:',
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'cancel_wizard')],
        ]).reply_markup
      }
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if ('callback_query' in ctx.update) {
      const query = ctx.update.callback_query;
      if ('data' in query && query.data === 'cancel_wizard') {
        await ctx.reply('Operação cancelada.');
        return ctx.scene.leave();
      }
    }

    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Por favor, digite uma senha válida.');
      return;
    }

    const password = ctx.message.text.trim();
    if (password.startsWith('/')) {
      await ctx.reply('Comando inválido. Operação cancelada.');
      return ctx.scene.leave();
    }

    const state = ctx.wizard.state as LoginState;
    const email = state.email!;

    try {
      const user = await botApi.login(email, password, String(ctx.from?.id));
      if (!user) {
        await ctx.reply('Email ou senha incorretos. Tente novamente iniciando o /login.');
        return ctx.scene.leave();
      }
      
      await ctx.reply('✅ Conta vinculada com sucesso! Bem-vindo ao MoneyAPP Telegram Bot.', mainMenuKeyboard());
    } catch (e: any) {
      // `needs_password_change` saiu: o LoginHUB nao devolve mais essa flag —
      // a senha se define pelo magic link. O que barra o vinculo hoje e o
      // segundo fator, e sao dois casos distintos.
      if (e && e.status === 403 && e.body?.error === 'needs_2fa') {
        await ctx.reply('🔐 Esta conta usa verificação em duas etapas. Por segurança, o vínculo com o Telegram precisa ser feito a partir do site: entre em https://money.astralwavelabel.com e volte aqui depois.');
      } else if (e && e.status === 403 && e.body?.error === 'needs_2fa_setup') {
        await ctx.reply('🔐 Esta conta ainda não configurou a verificação em duas etapas, que é obrigatória. Entre em https://money.astralwavelabel.com com a sua senha — você será levado à tela de configuração (tenha o celular à mão) — e depois volte aqui.');
      } else {
        console.error('Erro na verificação de senha:', e);
        await ctx.reply('Ocorreu um erro interno. Tente novamente.');
      }
    }

    return ctx.scene.leave();
  }
);
