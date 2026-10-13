import { createReadStream, promises as fs } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(fileURLToPath(new URL('.', import.meta.url))).replace(new RegExp(`${sep}$`), '');
const defaultProgress = () => ({
  wabbitUnlocked: false,
  litnegUnlocked: false,
  waveRecords: { astrub: 0, litneg: 0, wabbit: 0, gelee: 0, dragoeuf: 0 },
  collectedDofus: [],
  radiantDofus: [],
});

const json = (response, status, value) => {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
};

const readJson = async (request) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    return {};
  }
};

const mockState = () => ({ profile: { name: null }, progress: defaultProgress() });

const api = async (request, response, state, url) => {
  if (url.pathname === '/api/profile') {
    if (request.method === 'PATCH') {
      const body = await readJson(request);
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 32) : '';
      state.profile.name = name || null;
    }
    return json(response, 200, state.profile);
  }

  if (url.pathname === '/api/progress') {
    if (request.method === 'PATCH') {
      const body = await readJson(request);
      state.progress = { ...state.progress, ...body };
      state.progress.waveRecords = {
        ...defaultProgress().waveRecords,
        ...(body.waveRecords ?? {}),
      };
    }
    return json(response, 200, { progress: state.progress });
  }

  if (url.pathname === '/api/players') return json(response, 200, { count: 0 });

  if (url.pathname === '/api/leaderboard' || url.pathname === '/api/leaderboard/run') {
    return json(response, 200, { entries: [], items: [], nextCursor: null });
  }

  if (url.pathname === '/api/share') return json(response, 200, { ok: true });
  if (url.pathname === '/api/run-build' || url.pathname === '/api/achievement-event') {
    return json(response, 204, null);
  }

  if (url.pathname === '/api/progress/recovery') {
    const body = await readJson(request);
    if (body.action === 'create') return json(response, 200, { code: 'LOCAL-DEMO' });
    if (body.action === 'restore' && body.code === 'LOCAL-DEMO') {
      return json(response, 200, { progress: state.progress });
    }
    return json(response, 400, { error: 'Invalid recovery code' });
  }

  return json(response, 404, { error: 'Unknown API route' });
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
};

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const silentWav = Buffer.from(
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
  'base64',
);
const placeholderSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="transparent"/></svg>',
);

const placeholderAsset = (pathname) => {
  const extension = extname(pathname);
  if (extension === '.mp3') return { body: silentWav, type: 'audio/wav' };
  if (extension === '.svg') return { body: placeholderSvg, type: 'image/svg+xml; charset=utf-8' };
  if (extension === '.png' || extension === '.webp') return { body: transparentPng, type: 'image/png' };
  return null;
};

const staticFile = async (request, response, url) => {
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = normalize(join(root, requested));
  if (!file.startsWith(root + sep)) return json(response, 403, { error: 'Forbidden' });
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return json(response, 404, { error: 'Not found' });
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream' });
    if (request.method === 'HEAD') return response.end();
    createReadStream(file).pipe(response);
  } catch {
    const placeholder = url.pathname.startsWith('/assets/') ? placeholderAsset(url.pathname) : null;
    if (!placeholder) return json(response, 404, { error: 'Not found' });
    response.writeHead(200, {
      'content-type': placeholder.type,
      'cache-control': 'no-store',
      'x-local-placeholder': 'true',
    });
    response.end(placeholder.body);
  }
};

export const createServer = () => {
  const state = mockState();
  return createHttpServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) return api(request, response, state, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Method not allowed' });
    return staticFile(request, response, url);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3001);
  createServer().listen(port, '0.0.0.0', () => {
    console.log(`Retro Survival local server: http://localhost:${port}`);
  });
}
