// Production static server: HTML is always fresh; missing assets never become index.html.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.mjs':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.pdf':'application/pdf', '.txt':'text/plain; charset=utf-8' };
export function staticServer(root = fileURLToPath(new URL('../dist/', import.meta.url))) {
  root = resolve(root);
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405, { Allow:'GET, HEAD' }); res.end(); return; }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (pathname === '/healthz') { res.writeHead(200, {'Content-Type':'text/plain'}); res.end(req.method === 'HEAD' ? '' : 'ok'); return; }
    let file = resolve(root, '.' + pathname);
    if (pathname.includes('\0') || pathname.includes('\\') || file !== root && !file.startsWith(root + sep) || pathname.split('/').some(p => p.startsWith('.') && p !== '')) {
      res.writeHead(404); res.end(); return;
    }
    if (pathname === '/') file = resolve(root, 'index.html');
    let info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      // Hash routes work at /. Also support extensionless SPA paths; assets get a real 404.
      if (pathname.startsWith('/assets/') || extname(pathname) || !String(req.headers.accept || '').includes('text/html')) {
        res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end(req.method === 'HEAD' ? '' : 'Not found'); return;
      }
      file = resolve(root, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) { res.writeHead(503); res.end('Build unavailable'); return; }
    const immutable = pathname.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\./.test(pathname);
    res.writeHead(200, {
      'Content-Type':types[extname(file)] || 'application/octet-stream',
      'Content-Length':info.size,
      'Cache-Control':immutable ? 'public, max-age=31536000, immutable' : 'no-store'
    });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env['PORT'] || 8080);
  staticServer().listen(port, '0.0.0.0', () => console.log(`Lessonfold frontend: ${port}`));
}
