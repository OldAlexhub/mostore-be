import express from 'express';
import { getRevenues } from '../controllers/revenueController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requireRole('manager'), getRevenues);

export default router;
