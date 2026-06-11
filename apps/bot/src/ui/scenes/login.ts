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
      '🔒 Bem-vindo ao Login!\nPor favor, digite o seu **e-mail** cadastrado:',
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
      if (e && e.status === 403 && e.body?.error === 'needs_password_change') {
        await ctx.reply('⚠️ Acesso negado. Por favor, acesse o painel Web e altere a sua senha temporária gerada por convite antes de vincular o bot.');
      } else {
        console.error('Erro na verificação de senha:', e);
        await ctx.reply('Ocorreu um erro interno. Tente novamente.');
      }
    }

    return ctx.scene.leave();
  }
);
