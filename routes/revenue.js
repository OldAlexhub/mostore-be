import express from 'express';
import * as revenueCtrl from '../controllers/revenueController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, requireRole('manager'), revenueCtrl.createRevenue);
router.get('/', requireAuth, requireRole('manager'), revenueCtrl.getRevenues);
router.get('/:id', requireAuth, requireRole('manager'), revenueCtrl.getRevenueById);
router.put('/:id', requireAuth, requireRole('manager'), revenueCtrl.updateRevenue);
router.delete('/:id', requireAuth, requireRole('superadmin'), revenueCtrl.deleteRevenue);

export default router;
