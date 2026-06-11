import { Router } from 'express';
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
apiRouter.use('/bot', botRouter);
