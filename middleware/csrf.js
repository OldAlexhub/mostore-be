
// Simple double-submit CSRF middleware
export default function csrfMiddleware(req, res, next) {
  const method = req.method.toUpperCase();
  // only enforce for mutating methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  // only enforce CSRF for selected API paths (double-submit)
  // req.path is the path after /api because middleware is mounted on /api
  const enforcePatterns = [
    /^\/orders/,
    /^\/inventory/,
    /^\/revenue/,
    /^\/products/,
    /^\/admins/,
    /^\/users\/.*$/, // protect user updates/deletes
  ];

  // allow these specific user/admin paths without CSRF (login/register endpoints)
  // Admin login/register may be used to bootstrap the system and should not be blocked
  const skipPaths = new Set([
    '/users/login',
    '/users',
    '/users/register',
    '/admins/login',
    '/admins/register'
  ]);

  const path = req.path || '';
  if (skipPaths.has(path)) return next();
  const shouldEnforce = enforcePatterns.some(p => p.test(path));
  if (!shouldEnforce) return next();

  const cookieToken = req.cookies && req.cookies.csrf;
  if (!cookieToken) return res.status(403).json({ error: 'Missing CSRF cookie' });

  const headerToken = req.headers['x-csrf-token'];
  if (!headerToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  return next();
}
