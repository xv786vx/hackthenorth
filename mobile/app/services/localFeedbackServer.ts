import http from 'http';
import * as FileSystem from 'expo-file-system';

const DEFAULT_PORT = 8787;
const OUT_FILE = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}latest_feedback.txt` : 'latest_feedback.txt';

export const startLocalFeedbackServer = (port: number = DEFAULT_PORT) => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/feedback') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          const text: string = parsed.feedback || parsed.text || '';
          await FileSystem.writeAsStringAsync(OUT_FILE, text, { encoding: FileSystem.EncodingType.UTF8 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`📡 Local feedback server listening on http://0.0.0.0:${port}/feedback`);
    console.log(`📝 Writing feedback to: ${OUT_FILE}`);
  });

  return server;
};


