import type { Scenes } from 'telegraf';

/**
 * The bot only uses wizard scenes, so the prebuilt WizardContext (which already
 * carries `session`, `scene` and `wizard`) is all we need.
 */
export type BotContext = Scenes.WizardContext;
