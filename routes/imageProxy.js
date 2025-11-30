import express from 'express';
import { Buffer } from 'buffer';
import { URL } from 'url';

const router = express.Router();

// Whitelist of allowed hostnames to proxy (includes common Drive download hosts and image CDNs)
const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'drive.usercontent.google.com',
  'drive.googleapis.com'
]);

const isAllowedHost = (hostname) => {
  if (!hostname) return false;
  if (ALLOWED_HOSTS.has(hostname)) return true;
  // allow any *.googleusercontent.com (covers lh3, lh5, redirect domains)
  if (hostname.endsWith('.googleusercontent.com')) return true;
  return false;
};

router.get('/', async (req, res) => {
  const raw = req.query.url;
  if (!raw) return res.status(400).json({ error: 'url query required' });
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (err) {
    return res.status(400).json({ error: 'invalid url' });
  }
  if (!isAllowedHost(parsed.hostname)) {
    return res.status(400).json({ error: `host not allowed: ${parsed.hostname}` });
  }

  try {
    const stripHeaders = [
      'Cross-Origin-Embedder-Policy',
      'Cross-Origin-Resource-Policy',
      'Cross-Origin-Opener-Policy',
      'Content-Security-Policy',
      'X-Frame-Options',
      'Permissions-Policy'
    ];
    stripHeaders.forEach((h) => res.removeHeader(h));

    const remote = await fetch(parsed.toString());
    // forward status
    res.status(remote.status);
    // copy relevant headers but drop those that can block embedding
    for (const [k, v] of remote.headers) {
      // skip hop-by-hop and security headers that could interfere
      const key = k.toLowerCase();
      const blocked = [
        'set-cookie',
        'content-security-policy',
        'x-frame-options',
        'x-content-security-policy',
        'cross-origin-embedder-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy',
        'permissions-policy'
      ];
      if (blocked.includes(key)) continue;
      res.setHeader(k, v);
    }
    // allow CORS from any origin for image loading
    res.setHeader('Access-Control-Allow-Origin', '*');
    // stream body
    const arrayBuffer = await remote.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!res.getHeader('Content-Type') && remote.headers.get('content-type')) {
      res.setHeader('Content-Type', remote.headers.get('content-type'));
    }
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    console.error('image-proxy error', err && (err.stack || err.message || err));
    res.status(502).json({ error: 'failed to fetch' });
  }
});

export default router;
