const http = require('node:http'), fs = require('node:fs/promises'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer(async (req, res) => {
  if (!/^127\.0\.0\.1:\d+$/.test(req.headers.host || '')) { res.writeHead(403); return res.end(); }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (_) { res.writeHead(400); return res.end(); }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  const allowed = relative === 'index.html' || relative === 'outputs/maps/datacentermap_sweden_interactive_map.html'
    || relative === 'outputs/datacentermap_sweden_enriched/datacentermap_sweden_facilities_enriched.csv'
    || relative.startsWith('outputs/maps/assets/');
  if (!allowed || !file.startsWith(root + path.sep)) { res.writeHead(404); return res.end(); }
  try {
    const body = await fs.readFile(file);
    const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (_) { res.writeHead(404); res.end(); }
});
server.listen(Number(process.env.PORT || 4181), '127.0.0.1', () => console.log('Förhandsvisning: http://127.0.0.1:' + (process.env.PORT || 4181)));