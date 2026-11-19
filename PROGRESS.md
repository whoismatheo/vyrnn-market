# vyrnn progress

## v1.0 - Foundation

Status: complete, not yet built with Vite (see Limitations).

### Delivered

- Vite project with ES modules, Vercel serverless functions under `api/`, `vercel.json` (SPA rewrite, security headers, CSP, function duration) and `.env.example`.
- Frontend: entry point, history-based router with parameter routes and lazy views, design tokens, base and layout CSS, responsive shell with navigation, i18n loader for EN, ES, PT and FR.
- Overview route showing the real status of the API and the market data provider from `GET /api/health`.
- Backend utilities in `api/_lib`: CoinGecko client, TTL cache with stale window, rate limiter, query validation, error model, handler wrapper.
- `GET /api/health` (`?check=upstream` also contacts the provider).
- Dev API middleware (`config/api-middleware.js`) that mirrors Vercel file-based routing, including `[param]` segments, for `vite` and `vite preview`.
- Unit tests with the Node test runner (`npm test`, no extra dependencies).

### Architecture

- `api/*.js` are Vercel functions. `api/_lib` is not exposed as endpoints.
- Success responses: `{ data, meta? }`. Errors: `{ error: { code, message, details? } }`.
- CoinGecko is reached only from `api/_lib/coingecko.js`. Credentials are read from environment variables and sent as request headers; they are never returned or logged.
- Upstream protection: response cache, shared in-flight requests, one retry on 5xx or network errors, 8 s timeout, cooldown after a 429, per-minute call budget, stale data served when the provider fails.
- Views export `{ mount(container, context) }` and may return an unmount function. Routes are declared in `src/routes.js`.
- Translations are loaded at runtime from `public/locales/<code>.json`. English is always loaded as the fallback.

### Environment variables

| Name | Purpose |
| --- | --- |
| `COINGECKO_API_KEY` | Optional. Without it the public CoinGecko host is used. |
| `COINGECKO_API_PLAN` | `demo` (default) or `pro`. Only applies when a key is set. |
| `COINGECKO_RATE_LIMIT_PER_MINUTE` | Optional override of the upstream call budget (defaults: public 10, demo 25, pro 300). |
| `API_RATE_LIMIT_PER_MINUTE` | Per-IP limit for `/api/*` (default 60). |

Never prefix the key with `VITE_`.

### Local development

```
npm install
npm run dev
npm test
npm run build
```

Edits under `api/_lib` need a dev server restart; edits to `api/*.js` entry files reload automatically.

### Tests performed

Unit tests (`npm test`, Node 22): 52 passed, 0 failed.

- Cache: TTL, stale window, LRU eviction, overwrite.
- Rate limiter: limit, reset, per-key isolation, bounded key count.
- Validation: defaults, parsing, unknown, repeated, malformed and inherited keys.
- CoinGecko client (mocked fetch): headers per plan, URL serialization, caching, request sharing, stale on failure, retry on 5xx and network errors, timeout mapping, 401/404/invalid JSON, 429 cooldown, call budget, unsafe paths.
- Handler: envelope, cache headers, 405, query parsing, per-IP limiting, error serialization, hidden internals on 500.
- Health: basic response, no secret exposure, reachable and degraded provider, 400 and 405 cases.
- Dev middleware (real HTTP server, fixture API directory): static, index and dynamic routes, query merging, decoding, 404, private modules, malformed paths, handler errors, passthrough.
- Router matching and i18n catalogs: identical keys in all four languages, no empty strings, placeholder parity, every referenced key exists.

Browser tests (Chromium via Playwright, project served without bundling, with the production CSP and the real API handlers): 42 of 42 passed.

- Overview rendering, status rows, refresh, language switching in all four languages, persistence, browser language detection and fallback.
- Not-found view, client-side navigation without reload, history back and forward, skip link and focus.
- Provider degraded, API unreachable, non-JSON 500, failed locale load, failed view module load with reload recovery.
- No console errors, failed requests or CSP violations; no horizontal overflow at 375 px and 320 px.

### Limitations

- `vite build` and `vite dev` could not be run: the build environment has no network access, so dependencies could not be installed. `vite.config.js` and the production build are unverified. The browser tests used the same source files and CSP without bundling.
- No `package-lock.json` was generated for the same reason. Run `npm install` and commit the lockfile.
- The provider check was tested against a mocked CoinGecko response; no live CoinGecko request was made.
- The reference image was not received, so the visual identity follows the written brief (white, pearl gray, black, silver, chrome).
- No web font is bundled; the type stack uses Inter when installed and system fonts otherwise.
- Cache and rate limiting are in memory per serverless instance. Vercel edge caching (`CACHE_CONTROL.edge`) is the shared layer for market endpoints in later versions.
- The Overview status panel is temporary and will be replaced by the market dashboard in v1.1 or later.
- The CSP allows images from CoinGecko hosts for later versions; `style-src 'self'` may need review when charts are added.

### Suggested commit message

```
feat: add v1.0 foundation

Vite app shell with router, design tokens and EN/ES/PT/FR i18n, Vercel
serverless utilities (CoinGecko client, cache, rate limiter, validation,
error handling) and GET /api/health.
```
