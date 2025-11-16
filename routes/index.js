import express from 'express';
import { getHealth } from '../controllers/healthController.js';
import accountingRouter from './accounting.js';
import adminsRouter from './admins.js';
import announcementsRouter from './announcements.js';
import authRouter from './auth.js';
import inventoryRouter from './inventory.js';
import ordersRouter from './orders.js';
import productsRouter from './products.js';
import promotionsRouter from './promotions.js';
import reportsRouter from './reports.js';
import revenueRouter from './revenue.js';
import usersRouter from './users.js';
import storeRouter from './store.js';

const router = express.Router();

router.use('/admins', adminsRouter);
router.use('/users', usersRouter);
router.use('/products', productsRouter);
router.use('/orders', ordersRouter);
router.use('/inventory', inventoryRouter);
router.get('/health', getHealth);
router.use('/revenue', revenueRouter);
router.use('/auth', authRouter);
router.use('/announcements', announcementsRouter);
router.use('/promotions', promotionsRouter);
router.use('/reports', reportsRouter);
router.use('/accounting', accountingRouter);
router.use('/store', storeRouter);
  

export default router;
