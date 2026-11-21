# vyrnn progress

## v1.2 - Asset pages, watchlist and mobile usability

Status: complete and verified except for the items listed under "Not performed".

### Completed functionality

- Asset detail pages at `/coins/:id`: logo, name, symbol, market rank, current price, 24h change, market capitalization (with its 24h change), 24h volume (with its share of market cap), fully diluted valuation, circulating supply (with its share of max supply), interactive price chart with five ranges (24H, 7D, 1M, 3M, 1Y), and a Market statistics panel with the 24h range, 7 day, 30 day and 1 year changes, all-time high and low (price, date and distance), total and max supply. Fields the provider does not return are omitted, never filled in.
- Every asset in Overview (top assets, trending, movers), Markets and Watchlist links to its detail page. Unknown identifiers show a not-found state with a way back.
- Back link on detail pages returns to where the user came from, including the market page and sort (`/markets?sort=volume&page=2`), Overview or Watchlist. Direct visits default to Markets. The document title becomes the asset name.
- Watchlist: star action on every table row and a labeled action on detail pages; dedicated `/watchlist` page with live market data, sparkline and the same columns as Markets; skeleton loading, error with retry, stale notice, empty state with a link to Markets, and a list of saved assets the provider no longer returns (each removable). Rows are ordered by market rank. Removal on the page updates immediately.
- Persistence in `localStorage` (`vyrnn.watchlist`, versioned), restored after refresh and reopening. Corrupt or hostile stored data is sanitized, the limit is 50 assets (a message explains when it is reached), and a message appears if the browser cannot save. Changes in one tab update other open tabs. No accounts, authentication or external personal data.
- Navigation: Overview, Markets and Watchlist on desktop and mobile. Asset pages keep Markets highlighted.
- Mobile and responsive work:
  - Bottom bar below 960px uses the full width with three equal items; below 960px no sidebar space is reserved. Compact bar in short landscape viewports (phones turned sideways).
  - 960px to 1199px uses a narrow icon rail instead of the full sidebar; the full sidebar starts at 1200px.
  - Tables: below 640px each row shows the full asset name (wrapping, not cut off), symbol, price, the 24h change under the price, and a line with rank, market cap and volume. Nothing important is hidden; only the 7 day sparkline is omitted below 860px.
  - Touch targets of at least 44px on touch devices, larger base text sizes, stat cards, chart and detail header adapt to narrow screens.
  - Tested from 320px upward (see tests).
- Visual identity unchanged: monochrome palette, glass surfaces, green and red only on market movements (verified by a test that scans every element).

### Backend

Reused the existing client, cache, rate limiter, validation and error model. Changes:

| Endpoint | Change |
| --- | --- |
| `GET /api/markets` | New optional `ids` (up to 50 comma separated identifiers). Used by the watchlist. When present it replaces `page` and `perPage`. |
| `GET /api/coin?id=` | New. One provider call to `/coins/markets` with `ids`, `price_change_percentage=7d,30d,1y` and no sparkline. Returns `{ data: { coin }, meta }`. Responds 404 when the provider has no such asset. Edge cache 60 s. |

- `identifierList` validator, `normalizeCoinDetail` normalizer (dates validated, missing values stay `null`).
- Chart endpoint was reused as is for any asset.
- Stale data handling is unchanged: `meta.stale` is shown as a notice with the time of the saved data.

### Files and architecture

Added:

- `api/coin.js`
- `src/state/watchlist.js` (store with injectable storage, sanitizing, limit, change events and cross-tab sync)
- `src/views/coin.js`, `src/views/watchlist.js`
- `src/components/watch-button.js`, `toast.js`, `price-chart.js`
- `tests/watchlist.test.js`

Changed:

- Backend: `api/_lib/endpoints.js`, `normalizers.js`, `validation.js`
- Frontend: `src/router.js` (history entries remember where the user came from; views receive `from` and `setTitle`), `src/routes.js` (watchlist and asset routes, `section` for the active navigation item), `src/api/market.js`, `src/components/coin-cell.js` (links, meta line), `coin-table.js` (watch column, mobile layout), `shell.js`, `icon.js`, `src/utils/format.js`, `src/views/overview.js` (now uses the shared price chart), `src/views/markets.js`
- Styles: `tokens.css`, `layout.css`, `data.css`, `components.css`, `views.css`
- Translation catalogs (EN, ES, PT, FR): chart keys moved to a shared `chart` group, new `watchlist` and `detail` groups, `nav.watchlist`, table keys
- Tests: `endpoints`, `fixtures`, `i18n`, `normalizers`, `validation`

Notes:

- Watch buttons are stateless DOM nodes identified by `data-watch-id`; one module level subscription keeps every button on the page in sync, so there are no per-button listeners to clean up.
- The detail view builds its chart after the asset loads, so the chart title uses the real asset name.
- Language is still switched without replacing the translation system; views remount and use cached server responses.

### Tests executed

Unit tests (`npm test`, Node 22): 110 passed, 0 failed. New in v1.2:

- Watchlist store: add, remove, order, duplicates, persistence between instances, sanitizing of corrupt data, limit, invalid identifiers, storage write failure, subscriptions, cross-tab storage events.
- `identifierList` validation, `normalizeCoinDetail` (including missing fields), `/api/markets?ids`, `/api/coin` (details, 404, validation, stale flag), updated translation key checks.

Browser tests (Chromium through Playwright, real API handlers with a stubbed CoinGecko): 161 new checks and the 113 checks from v1.1, all passed (274 of 274 in the final run).

- Detail pages: header, price, statistics, omission of missing fields, chart range requests and tooltip, links from Overview, Markets, trending and movers, client-side navigation, document title, back link to Overview, to the exact market page and sort, and to Watchlist, direct visits, not-found state, very long asset names, stale notice.
- Watchlist: empty state, add and remove from rows and detail pages, localStorage content, restore after reload, live data requested by identifier, removal on the page, second tab sync, empty state after the last removal, corrupt storage, unavailable assets, full watchlist message, loading state, provider failure with retry.
- Mobile: bottom bar with three equal full-width items, content uses the full width, long names wrap, meta line, 24h under price, 44px star target, touch tap saves, controls at least 36px, detail page layout.
- Responsive: no horizontal overflow and no table scrolling at 320, 360, 412, 768, 980, 1100, 1199, 1200, 1280 and 1440px widths and 844x390 landscape, on Overview, Markets, Watchlist, two asset pages and Status; sidebar mode per width (bottom bar, rail, full).
- Translations: navigation, watchlist, detail and statistics in all four languages.
- No console errors, failed requests or CSP violations in the clean runs, with the production CSP header from `vercel.json`.

Bugs found by the tests and fixed:

- The touch device rule gave the labeled watchlist button a fixed 44px width, so its text overflowed the screen on phones.
- Row detail lines could force table scrolling at 320px; they now wrap below 360px.
- Chart tooltip behavior on touch devices (v1.1) remains correct.

Other checks executed:

- `esbuild` (0.28.2, available locally) bundled `src/main.js` with code splitting and the stylesheet without errors. This confirms that imports resolve. It is not a Vite build.
- Source scan: no comments, TODO markers, `console.log`, debugger statements or emoji; no unused exports besides items used by tests.

### Not performed

- `vite build` and `vite dev`: the sandbox has no network, so Vite cannot be installed. The production build was not run. Run `npm install` and `npm run build` before deploying.
- Live CoinGecko requests: none were possible. The stub returned CoinGecko shaped payloads with invented numbers. The extended fields used by detail pages (all-time high and low, supply, 7 day, 30 day and 1 year changes) follow the provider's documented `/coins/markets` response but were not observed live, so check one real asset page after deploying.
- Real devices and other browsers: touch behavior was tested with Chromium emulation only. Android and iOS devices, Firefox and Safari were not tested.

### Known limitations

- No search or filters, no coin descriptions, links or categories on detail pages.
- Watchlist is limited to 50 assets and is local to the browser; it does not sync between devices.
- Rows are ordered by market rank in the watchlist, not by the order assets were added.
- The 7 day sparkline is hidden below 860px.
- Language changes remount the current page and request data again from the server cache; the chart range returns to 7D.
- Prices are in USD only. No `package-lock.json` (run `npm install` and commit it).
- Cache and rate limiting are per serverless instance; Vercel edge caching is the shared layer.

### Suggested commit message

```
feat: add v1.2 asset pages, watchlist and mobile layout

Add /coins/:id detail pages with price chart and market statistics, a
localStorage watchlist with its own page and row actions, and link every
asset to its page. Add /api/coin and an ids parameter on /api/markets.
Rework the mobile layout: full-width bottom bar, icon rail for mid-size
screens, wrapping asset names and larger touch targets.
```

## v1.1 - Market dashboard

Status: complete and verified except for the items listed under "Not performed".

### Completed functionality

- Overview is now a market dashboard: total market capitalization, 24h trading volume (with its share of market cap), Bitcoin dominance (with Ethereum), 24h market movement, a Bitcoin price chart with five ranges (24H, 7D, 1M, 3M, 1Y), a top 10 assets table, a Trending panel and a Top movers panel (gainers and losers).
- Markets page: 50 assets per page with pagination, server-side sorting by market cap or volume, logos, price, 24h change, market cap, 24h volume and a 7 day sparkline. Page and sort live in the URL (`/markets?sort=volume&page=2`).
- System status moved to `/status`, reachable from the footer. It is no longer part of the main experience.
- Navigation: left sidebar on desktop (960px and up), bottom tab bar on mobile. Only Overview and Markets appear in navigation.
- Language selector: custom dropdown replacing the native select. Compact trigger (globe, code on mobile, name on desktop), menu anchored directly under the trigger, no operating system picker. Closes on selection, outside click, Escape and Tab. Keyboard: Enter, Space and arrow keys open it, arrows, Home and End move, Escape returns focus to the trigger. Uses `menu` and `menuitemradio` roles. The translation system, dictionaries, persistence and detection are unchanged.
- All new strings exist in EN, ES, PT and FR; numbers, currencies, percentages and dates follow the active locale.
- States: skeleton loading, per-section error with retry, empty states, and a stale-data notice with the time of the saved data. Each dashboard section loads and fails independently.
- Green and red are used only on market movement elements (change badges and sparklines). A browser test scans every element to enforce this.

### Backend

New endpoints, all built on the existing client, cache, rate limiter, validation and error model:

| Endpoint | Parameters | Provider calls |
| --- | --- | --- |
| `GET /api/global` | none | `/global` |
| `GET /api/markets` | `page` 1-100, `perPage` 1-100, `order` `market_cap_desc` or `volume_desc` | `/coins/markets` |
| `GET /api/chart` | `id` (required), `days` 1, 7, 30, 90 or 365 | `/coins/{id}/market_chart` |
| `GET /api/trending` | none | `/search/trending`, then `/coins/markets` for the listed ids |

- Responses are `{ data, meta }` with `meta = { source, stale, updatedAt }`. `source` is `upstream`, `cache` or `stale`. `updatedAt` is when the provider data was fetched.
- When the provider fails and an older cached copy exists, that copy is served with `stale: true` and only a few seconds of edge caching. Without a cached copy the endpoint returns an error. No substitute data is ever generated.
- Provider payloads are normalized and validated. Unexpected shapes become `upstream_error`. Coin logos are accepted only from `coin-images.coingecko.com` and `assets.coingecko.com`. Sparklines are reduced to 32 points and chart series to 180 points.
- The cache now stores a fetch timestamp with each entry (`fetchedAt`). The client returns it alongside `source`.
- Edge cache lifetimes: global and markets 60 s, trending 300 s, chart 120 s to 1800 s by range.
- Prices are in USD. Currency selection is not part of this version.

### Files and architecture

Added:

- `api/global.js`, `api/markets.js`, `api/chart.js`, `api/trending.js` (thin entry points)
- `api/_lib/endpoints.js`, `market-handler.js`, `normalizers.js`, `downsample.js`
- `src/api/market.js`
- `src/views/markets.js`, `src/views/status.js`
- `src/components/`: `language-menu`, `icon`, `panel`, `segmented`, `stat-card`, `change-badge`, `sparkline`, `coin-cell`, `coin-table`, `asset-list`, `line-chart`, `pagination`, `data-state`
- `src/utils/movers.js`, `src/utils/resource.js`
- `src/styles/data.css`
- Tests: `normalizers`, `endpoints`, `downsample`, `format`, `movers`, `resource`, plus `fixtures.js`

Changed:

- `api/_lib/coingecko.js` (cache entries carry `fetchedAt`)
- `src/views/overview.js` (rewritten as the dashboard), `src/components/shell.js`, `src/routes.js`, `src/router.js` (views receive `navigate`), `src/main.js`, `src/utils/dom.js` (`svg` helper), `src/utils/format.js`
- All stylesheets except `main.css` imports order; locale catalogs; `package.json` version; `tests/coingecko.test.js`, `tests/i18n.test.js`

Removed: `src/components/language-select.js`.

Notes:

- Views follow the contract `{ mount(container, { params, query, navigate }) }` and may return an unmount function.
- Data sections use `createResource` plus `renderResource`: one fetch per section, loading, error and ready states rendered in the same container.
- The Bitcoin price is the reference chart. The provider's total market cap history requires a paid plan, so no total market cap chart is shown.
- Top movers are derived from the 100 largest assets and labeled as such.
- The chart is plain SVG and HTML; no charting dependency was added. `package.json` still has a single dev dependency (Vite).
- Fixed during testing: the chart tooltip disappeared when a finger was lifted on touch devices; compact currency values showed trailing zeros (`$98.20B`).

### Tests executed

Unit tests (`npm test`, Node 22): 90 passed, 0 failed. Includes everything from v1.0 plus:

- Normalizers: global, markets, chart and trending payloads, missing and malformed fields, image host allowlist, sparkline and series reduction.
- Endpoints (mocked provider client): defaults, parameter forwarding, validation of every parameter, stale flag and edge cache headers, provider failures returning errors without data, malformed payloads, trending enrichment and ordering, method restrictions.
- Formatting, movers ranking, resource loader (loading, error, superseded and aborted loads), translation catalogs (identical keys in four languages, referenced keys exist, dynamic keys exist).

Browser tests (Chromium through Playwright): 113 of 113 checks passed. The real API handlers served the app; only the CoinGecko responses were stubbed (see Limitations).

- Overview: stat values and derived details, chart rendering, hover tooltip and crosshair, range change request, table rows, logos, sparklines, gainers and losers verified against the backend response, trending order, green and red restricted to movement elements.
- Markets: columns, pagination and history, server-side volume sort, empty state beyond the ranking.
- Navigation: sidebar geometry on desktop, bottom bar on mobile, active item, client-side navigation, document titles.
- Language dropdown: no native select, anchored position under the trigger, four options, checked state, selection, persistence across reload, Enter, ArrowDown, ArrowUp, Home, End, Escape, outside click and Tab, keyboard selection, touch selection, menu inside the viewport at 375px.
- All four languages on Overview and Markets: headings, stat labels, table headers, navigation, locale number formats.
- States: skeleton and busy state, provider failure with retry, independent chart failure, stale notice with the original timestamp and saved values, error after the stale window ends (old data is not shown), recovery, empty trending, monogram fallback for failed logos.
- Layout: no horizontal overflow at 320, 375, 768, 1024, 1280 and 1440px on Overview, Markets and Status; touch tap on the chart; footer clear of the bottom bar.
- No console errors, failed requests or CSP violations in the clean runs, with the production CSP header from `vercel.json` applied.

Other checks executed:

- `esbuild` (version 0.28.2, available locally) bundled `src/main.js` with code splitting and `src/styles/main.css` without errors. This confirms the module graph and CSS imports resolve. It is not a Vite build.
- Source scan: no comments, TODO markers, `console.log`, debugger statements or emoji.
- Manual HTTP requests to the four new endpoints and to invalid parameters, checking envelopes, cache headers and error bodies.

### Not performed

- `vite build` and `vite dev`: the sandbox has no network, so Vite cannot be installed. The production build was not run. Run `npm install` and `npm run build` before deploying.
- Live CoinGecko requests: none were possible. The stubbed provider returned CoinGecko-shaped payloads built for the tests, with invented numbers. The shapes follow the provider's documented responses, but the live responses were not observed. The trending endpoint and the logo URLs depend on that format.
- Real devices: the dropdown, bottom bar and touch behavior were tested in desktop Chromium emulation, not on an Android or iOS device.
- Other browsers: Firefox and Safari were not tested.

### Known limitations and unfinished work

- No search, filters, watchlist or coin detail page; rows are not links.
- No `package-lock.json` (same reason as v1.0).
- Server cache and rate limiting are per serverless instance; Vercel edge caching is the shared layer.
- Language changes remount the current view, so data is requested again (served from the server cache) and the chart range returns to 7D.
- Keyless CoinGecko access has a low rate limit. The local call budget defaults to 10 per minute without a key and 25 with a demo key; set `COINGECKO_API_KEY` for production.
- Chart colors are monochrome by design; period change is shown in the badge.
- The status page is unchanged from v1.0 apart from its location and translation keys.

### Suggested commit message

```
feat: add v1.1 market dashboard

Replace the status overview with a market dashboard (global stats, Bitcoin
price chart, top assets, trending, movers) and add a Markets page with
pagination and sorting. Add /api/global, /api/markets, /api/chart and
/api/trending on the existing CoinGecko client with stale-data reporting.
Replace the native language select with an accessible dropdown, add a
desktop sidebar and mobile tab bar, and move system status to /status.
```

## v1.0 - Foundation

Status: complete.

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
