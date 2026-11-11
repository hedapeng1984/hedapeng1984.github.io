import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../out/', import.meta.url));
const at = process.argv.indexOf('--port');
const port = at >= 0 ? Number(process.argv[at + 1]) : 4322;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('无效预览端口。');
await fs.access(path.join(root, 'index.html'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon' };
http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const url = new URL(request.url, 'http://localhost');
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400); response.end(); return; }
    let target = path.resolve(root, '.' + pathname);
    if (pathname.includes('\0') || (target !== path.resolve(root) && !target.startsWith(path.resolve(root) + path.sep))) { response.writeHead(403); response.end(); return; }
    const stat = await fs.stat(target).catch(() => null);
    if (stat?.isDirectory()) {
      if (!url.pathname.endsWith('/')) { response.writeHead(301, { Location: url.pathname + '/' + url.search }); response.end(); return; }
      target = path.join(target, 'index.html');
    }
    let body = await fs.readFile(target).catch(() => null);
    let status = 200;
    if (!body) { target = path.join(root, '404.html'); body = await fs.readFile(target); status = 404; }
    response.writeHead(status, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(500); response.end('Preview error'); }
}).listen(port, '127.0.0.1', () => console.log(`静态预览：http://127.0.0.1:${port}/`));
