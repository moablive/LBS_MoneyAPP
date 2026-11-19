import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
import { somenteConsumidor } from '../middleware/consumers.js';

/**
 * Foto de perfil para outro app do dono (19/11/2026, pedido do dono: o selo da conta logada do OmegaShell mostra "a
 * mesma foto que o MoneyAPP usa"). Só consumidor de serviço com o escopo `perfil.foto`, pela rede interna, agindo
 * por uma conta que CONSENTIU (`settings.leitoresExternos`). Devolve a foto e mais nada: nome, e-mail e o resto dos
 * settings não saem daqui.
 */
export const perfilRouter = Router();

perfilRouter.get('/foto', somenteConsumidor('perfil.foto'), async (req, res, next) => {
  try {
    const row = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.loginhubId, req.user!.loginhubId),
      columns: { settings: true },
    });
    const foto = (row?.settings as { foto?: unknown } | undefined)?.foto;
    res.set('Cache-Control', 'no-store');
    res.json({ foto: typeof foto === 'string' && foto.startsWith('data:image/') ? foto : null });
  } catch (err) {
    next(err);
  }
});
