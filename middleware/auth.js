import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

export const requireAuth = (req, res, next) => {
  // Accept token from httpOnly cookie `token` or Authorization header
  const tokenFromCookie = req.cookies && req.cookies.token;
  const authHeader = req.headers.authorization;
  let token = tokenFromCookie;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token) return res.status(401).json({ error: 'Authorization token missing' });
  try {
    const secret = process.env.JWT_SECRET || 'secret';
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.debug('[auth] token verify error:', err && err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (role) => (req, res, next) => {
  const hierarchy = {
    staff: 1,
    manager: 2,
    admin: 2, // legacy role name
    superadmin: 3
  };
  const needed = hierarchy[role] || 0;
  const currentRole = req.user && req.user.role ? hierarchy[req.user.role] || 0 : 0;
  if (currentRole >= needed) return next();
  return res.status(403).json({ error: 'Insufficient permissions' });
};
