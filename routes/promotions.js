import express from 'express';
import * as promosCtrl from '../controllers/promotionsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// public validate route
router.get('/validate', promosCtrl.validatePromotion);

// admin CRUD
router.post('/', requireAuth, requireRole('manager'), promosCtrl.createPromotion);
router.get('/', requireAuth, requireRole('manager'), promosCtrl.getPromotions);
router.get('/:id', requireAuth, requireRole('manager'), promosCtrl.getPromotion);
router.put('/:id', requireAuth, requireRole('manager'), promosCtrl.updatePromotion);
router.delete('/:id', requireAuth, requireRole('manager'), promosCtrl.deletePromotion);

export default router;
