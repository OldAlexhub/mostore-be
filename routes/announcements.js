import express from 'express';
import * as announcementsCtrl from '../controllers/announcementsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', announcementsCtrl.getAnnouncement);

// Admin routes
router.post('/', requireAuth, requireRole('manager'), announcementsCtrl.createAnnouncement);
router.put('/:id', requireAuth, requireRole('manager'), announcementsCtrl.updateAnnouncement);
router.delete('/:id', requireAuth, requireRole('manager'), announcementsCtrl.deleteAnnouncement);

export default router;
