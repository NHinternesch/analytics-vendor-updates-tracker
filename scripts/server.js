import http from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoint for updates
  if (req.url === '/api/updates') {
    try {
      const data = readFileSync(join(__dirname, '../data/updates.json'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to load updates' }));
    }
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = join(__dirname, '../public', filePath);

  try {
    const content = readFileSync(filePath, 'utf-8');
    const contentType = filePath.endsWith('.json') ? 'application/json' :
                       filePath.endsWith('.js') ? 'application/javascript' :
                       filePath.endsWith('.css') ? 'text/css' :
                       filePath.endsWith('.png') ? 'image/png' :
                       'text/html';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
