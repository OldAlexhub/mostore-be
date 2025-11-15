import express from 'express';
import * as inventoryCtrl from '../controllers/inventoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, requireRole('manager'), inventoryCtrl.createInventory);
router.get('/', requireAuth, inventoryCtrl.getInventories);
router.get('/insights', requireAuth, requireRole('manager'), inventoryCtrl.getInventoryInsights);
// Only match :id when it's a 24-hex ObjectId to avoid accidental matches like '/insights'
router.get('/:id([0-9a-fA-F]{24})', requireAuth, inventoryCtrl.getInventoryById);
router.put('/:id([0-9a-fA-F]{24})', requireAuth, requireRole('manager'), inventoryCtrl.updateInventory);
router.delete('/:id([0-9a-fA-F]{24})', requireAuth, requireRole('superadmin'), inventoryCtrl.deleteInventory);

export default router;
