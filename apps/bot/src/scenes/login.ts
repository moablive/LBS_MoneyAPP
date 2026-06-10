import { Scenes, Markup } from 'telegraf';
import type { BotContext } from '../context.js';
import { getUserByEmailWithPassword, updateUserTelegramId } from '../db/users.js';
import { mainMenuKeyboard } from '../ui.js';

export const LOGIN_SCENE = 'loginScene';

export interface LoginState {
  email?: string;
}

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

    // Processar autenticação
    const user = await getUserByEmailWithPassword(email);
    if (!user) {
      await ctx.reply('Email não encontrado. Tente novamente iniciando o /login.');
      return ctx.scene.leave();
    }

    if (user.defaultPassword) {
      await ctx.reply('🔒 Por motivos de segurança, você deve realizar o seu primeiro login pelo Painel Web e cadastrar uma nova senha antes de usar o bot do Telegram.');
      return ctx.scene.leave();
    }

    try {
      const argon2 = (await import('argon2')).default;
      const valid = await argon2.verify(user.passwordHash, password);
      
      if (!valid) {
        await ctx.reply('Senha incorreta. Tente novamente iniciando o /login.');
        return ctx.scene.leave();
      }
      
      await updateUserTelegramId(user.id, String(ctx.from?.id));
      await ctx.reply('✅ Conta vinculada com sucesso! Bem-vindo ao MoneyAPP Telegram Bot.', mainMenuKeyboard());
    } catch (e) {
      console.error('Erro na verificação de senha:', e);
      await ctx.reply('Ocorreu um erro interno. Tente novamente.');
    }

    return ctx.scene.leave();
  }
);
