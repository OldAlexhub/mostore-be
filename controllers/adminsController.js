import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import AdminModel from '../models/Admins.js';
import AuditLogModel from '../models/AuditLog.js';

export const createAdmin = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const admin = new AdminModel({ username, email, password: hashed, role });
    await admin.save();
    const out = admin.toObject();
    delete out.password;
    // audit log (record who created this admin)
    try {
      await AuditLogModel.create({ action: 'admin.create', actor: req.user?._id, actorUsername: req.user?.username, target: admin._id, targetUsername: admin.username, details: { role }, ip: req.ip });
    } catch (e) {
      // swallow audit errors
      console.warn('audit.log.create failed', e && e.message);
    }
    res.status(201).json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await AdminModel.findOne({ username }).select('+password');
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const payload = { id: admin._id, username: admin.username, role: admin.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });

    // set httpOnly token cookie
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 });

    // rotate/create refresh token and save on admin
    const refreshToken = crypto.randomBytes(32).toString('hex');
    admin.refreshToken = refreshToken;
    await admin.save();
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 });

    // set non-httpOnly csrf cookie for double-submit
    const csrf = crypto.randomBytes(16).toString('hex');
    res.cookie('csrf', csrf, { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 });

    res.json({ token, admin: { id: admin._id, username: admin.username, role: admin.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const adminRegister = async (req, res) => {
  try {
    const allow = process.env.ALLOW_ADMIN_REGISTRATION === 'true';
    const existing = await AdminModel.countDocuments();
    if (!allow && existing > 0) {
      return res.status(403).json({ error: 'Admin registration is disabled' });
    }
    const { username, email, password, role } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const admin = new AdminModel({ username, email, password: hashed, role });
    await admin.save();
    const out = admin.toObject();
    delete out.password;
    res.status(201).json(out);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getAdmins = async (req, res) => {
  try {
    const admins = await AdminModel.find();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getMyAdmin = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const admin = await AdminModel.findById(req.user.id).select('-password');
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    const out = admin.toObject();
    delete out.password;
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAdminById = async (req, res) => {
  try {
    const admin = await AdminModel.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    // load previous to detect role changes
    const prev = await AdminModel.findById(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Admin not found' });
    const admin = await AdminModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    // if role changed, record audit
    if (req.body && typeof req.body.role !== 'undefined' && String(req.body.role) !== String(prev.role)) {
      try {
        await AuditLogModel.create({ action: 'admin.role_change', actor: req.user?._id, actorUsername: req.user?.username, target: admin._id, targetUsername: admin.username, details: { from: prev.role, to: req.body.role }, ip: req.ip });
      } catch (e) { console.warn('audit.log.role_change failed', e && e.message); }
    }
    res.json(admin);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const admin = await AdminModel.findById(req.params.id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    await AdminModel.findByIdAndDelete(req.params.id);
    // audit log
    try {
      await AuditLogModel.create({ action: 'admin.delete', actor: req.user?._id, actorUsername: req.user?.username, target: admin._id, targetUsername: admin.username, details: {}, ip: req.ip });
    } catch (e) { console.warn('audit.log.delete failed', e && e.message); }
    res.json({ message: 'Admin deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
