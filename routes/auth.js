import express from 'express';
import { logout, me, refresh } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', requireAuth, me);
// Allow logout without requiring a valid token so clients can clear session cookies
// even when the token is missing or expired.
router.post('/logout', logout);
router.post('/refresh', refresh);

export default router;
