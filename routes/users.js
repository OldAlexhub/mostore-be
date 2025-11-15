import express from 'express';
import * as usersCtrl from '../controllers/usersController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateUserCreate } from '../middleware/schemaValidators.js';

const router = express.Router();

router.post('/', validateUserCreate, usersCtrl.createUser);
router.post('/login', usersCtrl.userLogin);
router.get('/export', requireAuth, requireRole('manager'), usersCtrl.exportUsersCsv);
router.get('/', requireAuth, requireRole('manager'), usersCtrl.getUsers);
router.get('/:id', requireAuth, usersCtrl.getUserById);
router.put('/:id', requireAuth, usersCtrl.updateUser);
router.put('/me', requireAuth, usersCtrl.updateMe);
router.delete('/:id', requireAuth, requireRole('superadmin'), usersCtrl.deleteUser);

export default router;
