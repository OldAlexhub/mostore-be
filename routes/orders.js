import express from 'express';
import * as ordersCtrl from '../controllers/ordersController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, ordersCtrl.createOrder);
router.get('/my', requireAuth, ordersCtrl.getMyOrders);
router.get('/summary', requireAuth, ordersCtrl.getOrdersSummary);
router.get('/', requireAuth, ordersCtrl.getOrders);
router.get('/:id', requireAuth, ordersCtrl.getOrderById);
router.post('/:id/cancel', requireAuth, ordersCtrl.cancelOrder);
router.put('/:id', requireAuth, ordersCtrl.updateOrder);
router.delete('/:id', requireAuth, ordersCtrl.deleteOrder);
router.post('/:id/remove-coupon', requireAuth, ordersCtrl.removeCoupon);

export default router;
