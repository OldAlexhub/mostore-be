import express from 'express';
import * as inventoryCtrl from '../controllers/inventoryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, requireRole('manager'), inventoryCtrl.createInventory);
router.get('/', requireAuth, inventoryCtrl.getInventories);
router.get('/:id', requireAuth, inventoryCtrl.getInventoryById);
router.put('/:id', requireAuth, requireRole('manager'), inventoryCtrl.updateInventory);
router.delete('/:id', requireAuth, requireRole('superadmin'), inventoryCtrl.deleteInventory);

export default router;
