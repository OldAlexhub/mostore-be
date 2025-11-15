import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

export const requireAuth = (req, res, next) => {
  // Accept token from httpOnly cookie `token` or Authorization header
  const tokenFromCookie = req.cookies && req.cookies.token;
  const authHeader = req.headers.authorization;
  let token = tokenFromCookie;
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.debug('[auth] incoming cookies:', req.cookies);
      console.debug('[auth] auth header present:', !!authHeader);
    } catch (e) {}
  }
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
  // Role checks are intentionally disabled to give all admin roles equal privileges.
  // This function remains here for compatibility with route declarations but will not block any role.
  return next();
};
