import express from 'express';
import * as productsCtrl from '../controllers/productsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateProduct } from '../middleware/schemaValidators.js';

const router = express.Router();

router.post('/', requireAuth, requireRole('manager'), validateProduct, productsCtrl.createProduct);
router.get('/', productsCtrl.getProducts);
router.get('/filters', productsCtrl.getFilters);
router.get('/search', productsCtrl.searchProducts);
router.get('/hidden-gems', productsCtrl.getHiddenGems);
router.get('/:id', productsCtrl.getProductById);
router.put('/:id', requireAuth, requireRole('manager'), validateProduct, productsCtrl.updateProduct);
router.delete('/:id', requireAuth, requireRole('superadmin'), productsCtrl.deleteProduct);

export default router;
