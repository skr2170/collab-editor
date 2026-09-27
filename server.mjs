import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from '@y/websocket-server/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';

  // 吞掉 favicon 请求，避免 404 噪音
  if (p === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  const fp = path.join(__dirname, p);
  if (!fp.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(fp, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream',
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // setupWSConnection 自动处理：
  // 1. Yjs 文档同步（增量）
  // 2. Awareness 协议（光标、用户状态）
  // 3. 断线重连
  setupWSConnection(ws, req, { gc: true });
});

server.listen(3000, () => {
  console.log('协同编辑器已启动 → http://localhost:3000');
});