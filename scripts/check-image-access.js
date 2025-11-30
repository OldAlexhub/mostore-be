#!/usr/bin/env node
import http from 'http';
import https from 'https';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node check-image-access.js <url>');
  process.exit(2);
}

const doRequestFollow = (u, maxRedirects = 5) => new Promise((resolve) => {
  try {
    const parsed = new URL(u);
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.get(parsed, { headers: { 'User-Agent': 'MOStoreChecker/1.0' } }, (res) => {
      // follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        const next = new URL(res.headers.location, parsed).toString();
        resolve(doRequestFollow(next, maxRedirects - 1));
        return;
      }
      const info = { statusCode: res.statusCode, headers: res.headers };
      // read a small chunk to confirm content (but avoid loading entire file)
      let read = 0;
      res.on('data', (chunk) => {
        read += chunk.length;
        if (read >= 1024) {
          // enough
          req.destroy();
        }
      });
      res.on('end', () => resolve({ ...info, bytesRead: read }));
      res.on('close', () => resolve({ ...info, bytesRead: read }));
    });
    req.on('error', (err) => resolve({ error: err.message }));
  } catch (err) {
    resolve({ error: err.message });
  }
});

(async () => {
  console.log('Checking', url);
  const res = await doRequestFollow(url);
  console.log('Result:', res);
})();
