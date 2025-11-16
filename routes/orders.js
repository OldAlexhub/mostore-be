import express from 'express';
import * as ordersCtrl from '../controllers/ordersController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// allow both authenticated and guest users to create orders
router.post('/', ordersCtrl.createOrder);
router.get('/my', requireAuth, ordersCtrl.getMyOrders);
router.get('/summary', requireAuth, ordersCtrl.getOrdersSummary);
router.get('/', requireAuth, ordersCtrl.getOrders);
router.get('/customers', requireAuth, requireRole('manager'), ordersCtrl.getOrderCustomers);
router.get('/customers.csv', requireAuth, requireRole('manager'), ordersCtrl.exportOrderCustomersCsv);
// public lookup by short order number for guest receipt/tracking
// tracking: require phone verification via query param `phone` for privacy
router.get('/track', ordersCtrl.trackOrdersByPhone);
router.get('/track/:orderNumber', ordersCtrl.trackOrder);
router.post('/track/:orderNumber/cancel', ordersCtrl.cancelOrderByPhone);

router.get('/:id', requireAuth, ordersCtrl.getOrderById);
router.post('/:id/cancel', requireAuth, ordersCtrl.cancelOrder);
router.put('/:id', requireAuth, ordersCtrl.updateOrder);
router.delete('/:id', requireAuth, ordersCtrl.deleteOrder);
router.post('/:id/remove-coupon', requireAuth, ordersCtrl.removeCoupon);

export default router;
