import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createApp} from '../lib/app.js';

const handle = createApp();
const publicDir = new URL('../public/', import.meta.url);
const files = {'/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8']};
createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 4096) { res.writeHead(413); return res.end(); } chunks.push(chunk); }
      const host = req.headers.host || '127.0.0.1:3000';
      const request = new Request(`http://${host}${req.url}`, {method: req.method, headers: req.headers,
        ...(req.method !== 'GET' && req.method !== 'HEAD' ? {body: Buffer.concat(chunks)} : {})});
      const response = await handle(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    const file = files[req.url.split('?')[0]];
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type': file[1]});
    res.end(await readFile(fileURLToPath(new URL(file[0], publicDir))));
  } catch { res.writeHead(500); res.end('Erro local.'); }
}).listen(3000, '127.0.0.1', () => console.log('AgroSense: http://127.0.0.1:3000'));
