import express from 'express';
import {
  adminCloseSession,
  closeSessionPublic,
  getSessionAdmin,
  getSessionPublic,
  listSessions,
  startChat
} from '../controllers/chatController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/start', startChat);
router.get('/session/:sessionId', getSessionPublic);
router.post('/session/:sessionId/close', closeSessionPublic);

router.get('/sessions', requireAuth, requireRole('staff'), listSessions);
router.get('/sessions/:sessionId', requireAuth, requireRole('staff'), getSessionAdmin);
router.post('/sessions/:sessionId/close', requireAuth, requireRole('staff'), adminCloseSession);

export default router;
