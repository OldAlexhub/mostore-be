import express from 'express';
import * as adminsCtrl from '../controllers/adminsController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateAdminCreate, validateAdminLogin } from '../middleware/schemaValidators.js';

const router = express.Router();

// Public login route
router.post('/login', validateAdminLogin, adminsCtrl.adminLogin);

// Return current admin (requires auth but not manager role)
router.get('/me', requireAuth, adminsCtrl.getMyAdmin);

// One-time or env-guarded registration (if no admins exist or ALLOW_ADMIN_REGISTRATION=true)
router.post('/register', validateAdminCreate, adminsCtrl.adminRegister);

// Create admin (protected - only superadmin can create by default)
router.post('/', requireAuth, requireRole('superadmin'), validateAdminCreate, adminsCtrl.createAdmin);

router.get('/', requireAuth, requireRole('manager'), adminsCtrl.getAdmins);
router.get('/:id', requireAuth, requireRole('manager'), adminsCtrl.getAdminById);
router.put('/:id', requireAuth, requireRole('superadmin'), adminsCtrl.updateAdmin);
router.delete('/:id', requireAuth, requireRole('superadmin'), adminsCtrl.deleteAdmin);

export default router;
