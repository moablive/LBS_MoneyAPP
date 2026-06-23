import { Router } from 'express';
import { investmentsService, investmentSchema, updateInvestmentSchema } from '@moneyapp/services';

export const investmentsRouter = Router();
import { requireAuth } from '../middleware/auth.js';
investmentsRouter.use(requireAuth);

investmentsRouter.get('/', async (req, res) => {
  const loginhubId = req.user?.loginhubId;
  if (!loginhubId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const data = await investmentsService.getByUserId(loginhubId);
    res.json(data);
  } catch (err) {
    req.log.error(err, 'Failed to fetch investments');
    res.status(500).json({ error: 'Internal server error' });
  }
});

investmentsRouter.get('/summary', async (req, res) => {
  const loginhubId = req.user?.loginhubId;
  if (!loginhubId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const summary = await investmentsService.getSummary(loginhubId);
    res.json(summary);
  } catch (err) {
    req.log.error(err, 'Failed to fetch investments summary');
    res.status(500).json({ error: 'Internal server error' });
  }
});

investmentsRouter.post('/', async (req, res) => {
  const loginhubId = req.user?.loginhubId;
  if (!loginhubId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const data = investmentSchema.parse(req.body);
    const created = await investmentsService.create(loginhubId, data);
    res.status(201).json(created);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    req.log.error(err, 'Failed to create investment');
    res.status(500).json({ error: 'Internal server error' });
  }
});

investmentsRouter.put('/:id', async (req, res) => {
  const loginhubId = req.user?.loginhubId;
  if (!loginhubId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const data = updateInvestmentSchema.parse(req.body);
    const updated = await investmentsService.update(loginhubId, req.params.id, data);
    
    if (!updated) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    
    res.json(updated);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    req.log.error(err, 'Failed to update investment');
    res.status(500).json({ error: 'Internal server error' });
  }
});

investmentsRouter.get('/:id/chart', async (req, res) => {
  const loginhubId = req.user?.loginhubId;
  if (!loginhubId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const data = await investmentsService.getPiggyBankChart(loginhubId, req.params.id);
    res.json(data);
  } catch (err) {
    req.log.error(err, 'Failed to fetch investment chart');
    res.status(500).json({ error: 'Internal server error' });
  }
});

investmentsRouter.post('/:id/deposit', async (req, res) => {
  const loginhubId = req.user?.loginhubId;
  if (!loginhubId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { amount, accountId } = req.body;
    await investmentsService.deposit(loginhubId, req.params.id, Number(amount), accountId);
    res.status(204).send();
  } catch (err) {
    req.log.error(err, 'Failed to deposit into investment');
    res.status(500).json({ error: 'Internal server error' });
  }
});

investmentsRouter.post('/:id/withdraw', async (req, res) => {
  const loginhubId = req.user?.loginhubId;
  if (!loginhubId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { amount, accountId } = req.body;
    await investmentsService.withdraw(loginhubId, req.params.id, Number(amount), accountId);
    res.status(204).send();
  } catch (err) {
    req.log.error(err, 'Failed to withdraw from investment');
    res.status(500).json({ error: 'Internal server error' });
  }
});

investmentsRouter.delete('/:id', async (req, res) => {
  const loginhubId = req.user?.loginhubId;
  if (!loginhubId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const success = await investmentsService.delete(loginhubId, req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Investment not found' });
    }
    res.status(204).send();
  } catch (err) {
    req.log.error(err, 'Failed to delete investment');
    res.status(500).json({ error: 'Internal server error' });
  }
});
