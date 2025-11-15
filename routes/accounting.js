import express from 'express';
import * as acct from '../controllers/accountingController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/expenses', requireAuth, requireRole('manager'), acct.createExpense);
router.get('/expenses', requireAuth, requireRole('manager'), acct.listExpenses);
router.delete('/expenses/:id', requireAuth, requireRole('manager'), acct.deleteExpense);

// Profit & Loss summary
router.get('/pl', requireAuth, requireRole('manager'), acct.getPL);
// CSV export for P&L
router.get('/pl.csv', requireAuth, requireRole('manager'), acct.exportPLCsv);

export default router;
