import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

// Password lifecycle (set/change/reset) and invites are owned by LoginHub.
// MoneyAPP only keeps app-specific profile settings.
usersRouter.get('/me/settings', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  // Settings atuais (18/11/2026): o app só os recebia no login (/auth/bootstrap) e guardava no aparelho; ao abrir,
  // ele relê daqui — a foto de perfil (ou o nome) trocada em outro aparelho aparece sem sair e entrar de novo.
  try {
    const user = await db.query.userSettings.findFirst({ where: eq(schema.userSettings.loginhubId, req.user!.loginhubId) });
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(user.settings);
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/me/settings', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requireReceipts, displayName, foto } = req.body;
    const loginhubId = req.user!.loginhubId;

    // Foto de perfil (18/11/2026, pedido do dono): data URL de imagem já reduzida no navegador (256 px, WebP).
    // null ou '' tira a foto. Recusa o que não for imagem ou passar de 400 KB — não é lugar de arquivo grande.
    let fotoNova: string | null | undefined;
    if (foto === null || foto === '') fotoNova = null;
    else if (typeof foto === 'string') {
      if (!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 400_000) {
        res.status(400).json({ error: 'foto_invalida' });
        return;
      }
      fotoNova = foto;
    }

    const user = await db.query.userSettings.findFirst({ where: eq(schema.userSettings.loginhubId, loginhubId) });
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Merge existing settings with incoming ones
    const newSettings = {
      ...(user.settings as any),
      ...(typeof requireReceipts === 'boolean' && { requireReceipts }),

      // Nome usado pelo bot nas notificações (string vazia limpa o nome)
      ...(typeof displayName === 'string' && { displayName: displayName.trim().slice(0, 60) || null }),

      ...(fotoNova !== undefined && { foto: fotoNova }),
    };

    await db.update(schema.userSettings)
      .set({ settings: newSettings })
      .where(eq(schema.userSettings.loginhubId, loginhubId));

    res.json(newSettings);
  } catch (err) {
    next(err);
  }
});
