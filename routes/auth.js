import express from 'express';
import { getCsrf, logout, me, refresh } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', requireAuth, me);
router.get('/csrf', getCsrf);
router.post('/logout', requireAuth, logout);
router.post('/refresh', refresh);

export default router;
