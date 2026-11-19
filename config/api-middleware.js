import { readdir, stat } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DYNAMIC_SEGMENT = /^\[([A-Za-z0-9_]+)\]$/;

async function listDirectory(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
}

export async function resolveRoute(dir, segments, params = {}) {
  const entries = await listDirectory(dir);
  const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  if (segments.length === 0) {
    return files.has('index.js') ? { file: path.join(dir, 'index.js'), params } : null;
  }

  const [head, ...rest] = segments;
  if (head.startsWith('_')) return null;

  const candidates = [{ name: head, params }];
  for (const name of [...files, ...directories]) {
    const base = name.endsWith('.js') ? name.slice(0, -3) : name;
    const match = DYNAMIC_SEGMENT.exec(base);
    if (match) candidates.push({ name: base, params: { ...params, [match[1]]: head } });
  }

  for (const candidate of candidates) {
    if (rest.length === 0 && files.has(`${candidate.name}.js`)) {
      return { file: path.join(dir, `${candidate.name}.js`), params: candidate.params };
    }
    if (directories.includes(candidate.name)) {
      const nested = await resolveRoute(path.join(dir, candidate.name), rest, candidate.params);
      if (nested) return nested;
    }
  }
  return null;
}

function buildQuery(searchParams, routeParams) {
  const query = Object.create(null);
  for (const [name, value] of searchParams) {
    query[name] = name in query ? [].concat(query[name], value) : value;
  }
  return Object.assign(query, routeParams);
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function importFresh(file) {
  const version = statSync(file).mtimeMs;
  return import(`${pathToFileURL(file).href}?v=${version}`);
}

export function createApiMiddleware({ apiDir, loadModule = importFresh }) {
  const root = apiDir instanceof URL ? fileURLToPath(apiDir) : apiDir;

  return async function apiMiddleware(req, res, next) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
      next();
      return;
    }

    try {
      const segments = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
      const match = await resolveRoute(root, segments);
      if (!match || !(await stat(match.file)).isFile()) {
        sendJson(res, 404, { error: { code: 'not_found', message: 'Endpoint not found' } });
        return;
      }

      req.query = buildQuery(url.searchParams, match.params);
      const module = await loadModule(match.file);
      await module.default(req, res);
    } catch (error) {
      if (error instanceof URIError) {
        sendJson(res, 400, { error: { code: 'bad_request', message: 'Malformed request path' } });
        return;
      }
      console.error(error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: { code: 'internal_error', message: 'Internal server error' } });
      }
    }
  };
}
