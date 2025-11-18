import express from 'express';
import * as heroCtrl from '../controllers/heroController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', heroCtrl.getHeroSettings);
router.put('/', requireAuth, requireRole('manager'), heroCtrl.upsertHeroSettings);

export default router;
