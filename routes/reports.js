import express from 'express';
import * as reportsCtrl from '../controllers/reportsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Protected: manager or higher
router.get('/products', requireAuth, requireRole('manager'), reportsCtrl.exportProductsCsv);
router.get('/orders', requireAuth, requireRole('manager'), reportsCtrl.exportOrdersCsv);
router.get('/promotions', requireAuth, requireRole('manager'), reportsCtrl.exportPromotionsCsv);
router.get('/users', requireAuth, requireRole('manager'), reportsCtrl.exportUsersCsvGeneric);

export default router;
