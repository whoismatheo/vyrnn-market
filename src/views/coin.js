import { fetchCoin } from '../api/market.js';
import { ApiRequestError } from '../api/client.js';
import { createChangeBadge } from '../components/change-badge.js';
import { createCoinLogo } from '../components/coin-cell.js';
import { createEmptyState, createSkeleton, renderResource } from '../components/data-state.js';
import { createIcon } from '../components/icon.js';
import { createPanel } from '../components/panel.js';
import { createPriceChart } from '../components/price-chart.js';
import { createStatCard } from '../components/stat-card.js';
import { createStatusList } from '../components/status-list.js';
import { createWatchButton } from '../components/watch-button.js';
import { getLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatCompactCurrency, formatCompactNumber, formatDate, formatInteger, formatPercentShare, formatPrice } from '../utils/format.js';
import { createResource } from '../utils/resource.js';

const BACK_SECTIONS = [
  { prefix: '/markets', navKey: 'nav.markets' },
  { prefix: '/watchlist', navKey: 'nav.watchlist' },
  { prefix: '/', navKey: 'nav.overview', exact: true },
];

function resolveBack(from) {
  const section = from && BACK_SECTIONS.find(({ prefix, exact }) => (exact ? from.split('?')[0] === prefix : from.startsWith(prefix)));
  return section ? { href: from, navKey: section.navKey } : { href: '/markets', navKey: 'nav.markets' };
}

function createBackLink(back) {
  return el('a', { class: 'back-link', href: back.href }, createIcon('back', { size: 16 }), t('detail.back', { section: t(back.navKey) }));
}

function createHead(coin) {
  const locale = getLanguage();
  return el(
    'header',
    { class: 'detail-head' },
    el(
      'div',
      { class: 'detail-head__top' },
      el(
        'div',
        { class: 'detail-identity' },
        createCoinLogo(coin, { large: true }),
        el(
          'div',
          { class: 'detail-identity__text' },
          el('h1', { class: 'detail-name' }, coin.name),
          el('p', { class: 'detail-tags' }, el('span', { class: 'tag' }, coin.symbol), coin.rank === null ? null : el('span', { class: 'tag' }, t('detail.rank', { rank: formatInteger(coin.rank, locale) }))),
        ),
      ),
      el(
        'div',
        { class: 'detail-actions' },
        el('a', { class: 'button button--quiet', href: `/compare?ids=${encodeURIComponent(coin.id)}` }, createIcon('compare', { size: 16 }), t('detail.compare')),
        createWatchButton(coin, { labeled: true }),
      ),
    ),
    el(
      'div',
      { class: 'detail-price' },
      el('span', { class: 'detail-price__value' }, formatPrice(coin.price, locale)),
      createChangeBadge(coin.change24h, locale, { large: true }),
      el('span', { class: 'detail-price__label' }, t('detail.last24h')),
    ),
  );
}

function createStats(coin) {
  const locale = getLanguage();
  const volumeShare = coin.marketCap > 0 && coin.volume24h !== null ? (coin.volume24h / coin.marketCap) * 100 : null;
  const supplyShare = coin.circulatingSupply !== null && coin.maxSupply > 0 ? (coin.circulatingSupply / coin.maxSupply) * 100 : null;

  const cards = [
    createStatCard({
      label: t('detail.stats.marketCap'),
      value: formatCompactCurrency(coin.marketCap, locale),
      detail: coin.marketCapChange24h === null ? null : el('span', {}, createChangeBadge(coin.marketCapChange24h, locale), ' ', t('detail.last24h')),
    }),
    createStatCard({
      label: t('detail.stats.volume'),
      value: formatCompactCurrency(coin.volume24h, locale),
      detail: volumeShare === null ? null : t('overview.stats.volumeShare', { value: formatPercentShare(volumeShare, locale) }),
    }),
  ];

  if (coin.fullyDilutedValuation !== null) {
    cards.push(createStatCard({ label: t('detail.stats.fdv'), value: formatCompactCurrency(coin.fullyDilutedValuation, locale) }));
  }
  if (coin.circulatingSupply !== null) {
    cards.push(
      createStatCard({
        label: t('detail.stats.circulating'),
        value: `${formatCompactNumber(coin.circulatingSupply, locale)} ${coin.symbol}`,
        detail: supplyShare === null ? null : t('detail.stats.ofMax', { value: formatPercentShare(supplyShare, locale) }),
      }),
    );
  }

  return el('div', { class: 'stats__grid' }, cards);
}

function describeExtreme(price, date, change, locale) {
  return el(
    'span',
    { class: 'detail-value' },
    el('span', {}, formatPrice(price, locale)),
    date ? el('span', { class: 'detail-value__note' }, formatDate(date, locale)) : null,
    change === null ? null : createChangeBadge(change, locale),
  );
}

function buildInfoRows(coin) {
  const locale = getLanguage();
  const supply = (value) => `${formatCompactNumber(value, locale)} ${coin.symbol}`;
  const change = (value) => createChangeBadge(value, locale);
  const has = (value) => value !== null;

  return [
    has(coin.low24h) && has(coin.high24h) ? { label: t('detail.info.range24h'), value: `${formatPrice(coin.low24h, locale)} \u2013 ${formatPrice(coin.high24h, locale)}` } : null,
    has(coin.change7d) ? { label: t('detail.info.change7d'), value: change(coin.change7d) } : null,
    has(coin.change30d) ? { label: t('detail.info.change30d'), value: change(coin.change30d) } : null,
    has(coin.change1y) ? { label: t('detail.info.change1y'), value: change(coin.change1y) } : null,
    has(coin.ath) ? { label: t('detail.info.ath'), value: describeExtreme(coin.ath, coin.athDate, coin.athChange, locale) } : null,
    has(coin.atl) ? { label: t('detail.info.atl'), value: describeExtreme(coin.atl, coin.atlDate, coin.atlChange, locale) } : null,
    has(coin.totalSupply) ? { label: t('detail.info.totalSupply'), value: supply(coin.totalSupply) } : null,
    has(coin.maxSupply) ? { label: t('detail.info.maxSupply'), value: supply(coin.maxSupply) } : null,
  ].filter(Boolean);
}

export default {
  mount(container, { params, navigate, from, setTitle }) {
    const { id } = params;
    const back = resolveBack(from);
    let chart = null;

    const headRegion = el('div', { class: 'panel__region' });
    const statsRegion = el('div', { class: 'stats' });
    const chartSlot = el('div', { class: 'detail-chart' });
    const infoPanel = createPanel({ title: t('detail.info.title') });
    infoPanel.element.hidden = true;

    function renderSecondary(region, state, build) {
      if (state.phase === 'loading') region.replaceChildren(createSkeleton('stat', 4));
      else if (state.phase === 'ready') region.replaceChildren(build(state.data.coin));
      else region.replaceChildren();
    }

    function renderFailure(state) {
      if (state.error instanceof ApiRequestError && state.error.status === 404) {
        return createEmptyState({
          title: t('detail.notFound.title'),
          message: t('detail.notFound.message'),
          action: { label: t('detail.notFound.action', { section: t(back.navKey) }), onClick: () => navigate(back.href) },
        });
      }
      return null;
    }

    function syncChart(state) {
      if (state.phase !== 'ready' || chart) return;
      chart = createPriceChart({ assetId: id, assetName: state.data.coin.name });
      chartSlot.replaceChildren(chart.element);
      chart.load();
    }

    const resource = createResource(
      (signal) => fetchCoin({ id, signal }),
      (state) => {
        if (state.phase === 'ready') setTitle(state.data.coin.name);

        const failure = state.phase === 'error' ? renderFailure(state) : null;
        if (failure) headRegion.replaceChildren(failure);
        else renderResource(headRegion, state, { skeleton: () => createSkeleton('head'), ready: ({ coin }) => createHead(coin), onRetry: () => resource.load() });

        renderSecondary(statsRegion, state, createStats);

        const rows = state.phase === 'ready' ? buildInfoRows(state.data.coin) : [];
        infoPanel.element.hidden = rows.length === 0;
        infoPanel.body.replaceChildren(rows.length > 0 ? createStatusList(rows) : '');
        infoPanel.body.firstElementChild?.classList.add('status-list--columns');

        syncChart(state);
      },
    );

    container.append(el('section', { class: 'page' }, createBackLink(back), headRegion, statsRegion, chartSlot, infoPanel.element));

    resource.load();

    return () => {
      resource.abort();
      chart?.abort();
    };
  },
};
