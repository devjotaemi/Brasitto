import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, relative } from 'node:path';

const port = Number(process.env.PORT ?? 5173);
const root = join(process.cwd(), 'dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const requestedPath =
    url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = join(root, requestedPath);

  if (relative(root, filePath).startsWith('..')) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  const resolvedFilePath = existsSync(filePath)
    ? filePath
    : join(root, 'index.html');
  const fileStat = await stat(resolvedFilePath);

  if (!fileStat.isFile()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type':
      contentTypes[extname(resolvedFilePath)] ?? 'application/octet-stream',
  });
  createReadStream(resolvedFilePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving dist at http://127.0.0.1:${port}/`);
});
