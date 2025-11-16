import express from 'express';
import { getStoreDiscount, updateStoreDiscount } from '../controllers/storeController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/discount', getStoreDiscount);
router.put('/discount', requireAuth, requireRole('manager'), updateStoreDiscount);

export default router;
