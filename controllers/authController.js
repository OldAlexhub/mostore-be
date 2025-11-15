import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import AdminModel from '../models/Admins.js';
import UserModel from '../models/users.js';

export const me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const user = await UserModel.findById(req.user.id).select('-password -refreshToken');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const logout = async (req, res) => {
  try {
    // clear refresh token server-side if possible
    const refresh = req.cookies && req.cookies.refreshToken;
    if (refresh) {
      await UserModel.findOneAndUpdate({ refreshToken: refresh }, { $unset: { refreshToken: 1 } });
    }
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' });
    // previously cleared csrf cookie here — CSRF removed
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const refresh = req.cookies && req.cookies.refreshToken;
    // Only log when a refresh token exists to avoid noisy undefined logs
    if (process.env.NODE_ENV !== 'production' && refresh) console.debug('[auth.refresh] refresh cookie:', refresh);
    if (!refresh) return res.status(401).json({ error: 'No refresh token' });
    let user = await UserModel.findOne({ refreshToken: refresh }).select('+refreshToken');
    let isAdmin = false;
    if (!user) {
      // try admins collection
      user = await AdminModel.findOne({ refreshToken: refresh }).select('+refreshToken');
      if (user) isAdmin = true;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[auth.refresh] refresh token lookup result:', !!user, 'isAdmin:', isAdmin);
    }
    if (!user) return res.status(403).json({ error: 'Invalid refresh token' });

    // rotate refresh token
    const newRefresh = crypto.randomBytes(32).toString('hex');
    user.refreshToken = newRefresh;
    await user.save();

    const payload = isAdmin ? { id: user._id, username: user.username, role: user.role } : { id: user._id, username: user.username };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '8h' });

    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 });
    res.cookie('refreshToken', newRefresh, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 });
    // CSRF cookie generation removed — clients no longer receive or need a csrf cookie

    if (isAdmin) {
      res.json({ token, user: { id: user._id, username: user.username, role: user.role } });
    } else {
      res.json({ token, user: { id: user._id, username: user.username } });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCsrf = async (req, res) => {
  // CSRF endpoint removed — clients should rely on cookie-based auth and CORS protections
  res.status(404).json({ error: 'Not found' });
};
