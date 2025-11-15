import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import OrderModel from '../models/Orders.js';
import UserModel from '../models/users.js';

export const createUser = async (req, res) => {
  try {
    const { username, Address, phoneNumber, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const user = new UserModel({ username, Address, phoneNumber, password: hashed });
    await user.save();
    const out = user.toObject();
    delete out.password;
    const payload = { id: user._id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    // cookie options: allow cross-site cookies in production
    const cookieSameSite = process.env.NODE_ENV === 'production' ? 'none' : 'lax';
    const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: cookieSameSite, path: '/', maxAge: 1000 * 60 * 60 * 24 };
    // set httpOnly token cookie (24 hours)
    res.cookie('token', token, cookieOpts);
    // create and save refresh token (rotation)
    const refreshToken = crypto.randomBytes(32).toString('hex');
    user.refreshToken = refreshToken;
    await user.save();
    // set refreshToken httpOnly cookie (24 hours)
    res.cookie('refreshToken', refreshToken, cookieOpts);
    res.status(201).json({ user: out, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const userLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await UserModel.findOne({ username }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const payload = { id: user._id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 });
    const refreshToken = crypto.randomBytes(32).toString('hex');
    user.refreshToken = refreshToken;
    await user.save();
    // keep refresh token valid for 24 hours to match session persistence
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 });
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUsers = async (req, res) => {
  try {
    const includeTotals = req.query.includeTotals === 'true' || req.query.includeTotals === '1';
    const users = await UserModel.find().select('-password').lean();
    if (!includeTotals) return res.json(users);

    // aggregate total spend per user (exclude cancelled orders)
    const agg = await OrderModel.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: '$user', total: { $sum: '$totalPrice' } } }
    ]);
    const totals = {};
    agg.forEach(a => { totals[a._id.toString()] = a.total; });
    const out = users.map(u => ({ ...u, totalSpend: totals[u._id.toString()] || 0 }));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const exportUsersCsv = async (req, res) => {
  try {
    // fetch users and totals similar to getUsers?includeTotals=true
    const users = await UserModel.find().select('-password').lean();
    // aggregate total spend per user (exclude cancelled orders)
    const agg = await OrderModel.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: '$user', total: { $sum: '$totalPrice' } } }
    ]);
    const totals = {};
    agg.forEach(a => { totals[a._id.toString()] = a.total; });

    const rows = users.map(u => ({
      id: u._id.toString(),
      username: u.username || '',
      phoneNumber: u.phoneNumber || '',
      Address: u.Address || '',
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
      totalSpend: (totals[u._id.toString()] || 0)
    }));

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.indexOf('"') !== -1 || s.indexOf(',') !== -1 || s.indexOf('\n') !== -1) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const header = ['id','username','phoneNumber','Address','createdAt','totalSpend'];
    const csv = [header.join(',')].concat(rows.map(r => header.map(h => escape(r[h])).join(','))).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await UserModel.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateMe = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const update = { ...req.body };
    // if password is provided, hash it
    if (update.password) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
    }
    const user = await UserModel.findByIdAndUpdate(userId, update, { new: true }).select('-password -refreshToken');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await UserModel.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
