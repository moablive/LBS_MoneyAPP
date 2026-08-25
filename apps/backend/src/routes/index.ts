import { Router } from 'express';
import { requireBotKey, requireAuth } from '../middleware/auth.js';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { accountsRouter } from './accounts';
import { categoriesRouter } from './categories';
import { dashboardRouter } from './dashboard';
import { transactionsRouter } from './transactions';
import { subscriptionsRouter } from './subscriptions';
import { investmentsRouter } from './investments';
import { loansRouter } from './loans';
import { sharesRouter } from './shares';
import { botRouter } from './bot';
import { telegramRouter, telegramBotRouter } from './telegram';
import { calendarRouter } from './calendar';
import { pushRouter } from './push';
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/accounts', accountsRouter);
apiRouter.use('/transactions', transactionsRouter);
apiRouter.use('/subscriptions', subscriptionsRouter);
apiRouter.use('/investments', investmentsRouter);
apiRouter.use('/loans', loansRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/shares', sharesRouter);
// O consumo do passe de vinculo entra pela MESMA guarda do resto do /bot: e o
// bot chamando com a chave de servico, nao a pessoa com sessao.
apiRouter.use('/bot', requireBotKey, telegramBotRouter);
apiRouter.use('/bot', botRouter);
apiRouter.use('/calendar', calendarRouter);
apiRouter.use('/push', pushRouter);
apiRouter.use('/telegram', requireAuth, telegramRouter);
