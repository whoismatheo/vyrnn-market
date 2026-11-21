import { fetchGlobal, fetchMarkets, fetchTrending } from '../api/market.js';
import { createAssetList } from '../components/asset-list.js';
import { createChangeBadge } from '../components/change-badge.js';
import { createCoinTable } from '../components/coin-table.js';
import { createEmptyState, createSkeleton, renderResource } from '../components/data-state.js';
import { createIcon } from '../components/icon.js';
import { createPanel } from '../components/panel.js';
import { createPriceChart } from '../components/price-chart.js';
import { createSegmented } from '../components/segmented.js';
import { createStatCard } from '../components/stat-card.js';
import { getLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatCompactCurrency, formatPercentShare, formatTime } from '../utils/format.js';
import { topMovers } from '../utils/movers.js';
import { createResource } from '../utils/resource.js';

const CHART_ASSET = { id: 'bitcoin', name: 'Bitcoin' };
const MARKETS_SAMPLE_SIZE = 100;
const TABLE_ROWS = 10;
const MOVERS_LIMIT = 5;
const TRENDING_LIMIT = 7;
const TABLE_COLUMNS = ['rank', 'asset', 'price', 'change', 'marketCap', 'trend', 'watch'];

function createStatsGrid(global) {
  const locale = getLanguage();
  const volumeShare = global.marketCap > 0 ? (global.volume24h / global.marketCap) * 100 : null;

  return el(
    'div',
    { class: 'stats__grid' },
    createStatCard({ label: t('overview.stats.marketCap'), value: formatCompactCurrency(global.marketCap, locale) }),
    createStatCard({
      label: t('overview.stats.volume'),
      value: formatCompactCurrency(global.volume24h, locale),
      detail: volumeShare === null ? null : t('overview.stats.volumeShare', { value: formatPercentShare(volumeShare, locale) }),
    }),
    createStatCard({
      label: t('overview.stats.dominance'),
      value: formatPercentShare(global.btcDominance, locale),
      detail: global.ethDominance === null ? null : t('overview.stats.ethDominance', { value: formatPercentShare(global.ethDominance, locale) }),
    }),
    createStatCard({
      label: t('overview.stats.movement'),
      value: createChangeBadge(global.marketCapChange24h, locale, { large: true }),
      detail: t('overview.stats.movementDetail'),
    }),
  );
}

export default {
  mount(container) {
    let moversMode = 'gainers';
    let marketsState = { phase: 'loading' };

    const statsRegion = el('div', { class: 'stats' });
    const updated = el('span', { class: 'page__updated' });
    const tableRegion = el('div', { class: 'panel__region' });
    const trendingRegion = el('div', { class: 'panel__region' });
    const moversRegion = el('div', { class: 'panel__region' });

    const stats = createResource(
      (signal) => fetchGlobal({ signal }),
      (state) => {
        updated.textContent = state.phase === 'ready' ? t('common.updatedAt', { time: formatTime(new Date(state.meta.updatedAt), getLanguage()) }) : '';
        renderResource(statsRegion, state, {
          skeleton: () => createSkeleton('stat', 4),
          ready: createStatsGrid,
          onRetry: () => stats.load(),
        });
      },
    );

    const chart = createPriceChart({ assetId: CHART_ASSET.id, assetName: CHART_ASSET.name });

    function renderTable() {
      renderResource(tableRegion, marketsState, {
        skeleton: () => createSkeleton('table-row', TABLE_ROWS),
        ready: ({ coins }) =>
          coins.length === 0
            ? createEmptyState({ message: t('markets.empty.message') })
            : createCoinTable({ coins: coins.slice(0, TABLE_ROWS), columns: TABLE_COLUMNS, caption: t('overview.table.caption'), locale: getLanguage() }),
        onRetry: () => markets.load(),
      });
    }

    function renderMovers() {
      renderResource(moversRegion, marketsState, {
        skeleton: () => createSkeleton('row', MOVERS_LIMIT),
        ready: ({ coins }) => {
          const movers = topMovers(coins, MOVERS_LIMIT);
          const list = moversMode === 'gainers' ? movers.gainers : movers.losers;
          if (list.length > 0) return createAssetList(list, getLanguage());
          return createEmptyState({ message: t(moversMode === 'gainers' ? 'overview.movers.emptyGainers' : 'overview.movers.emptyLosers') });
        },
        onRetry: () => markets.load(),
      });
    }

    const markets = createResource(
      (signal) => fetchMarkets({ perPage: MARKETS_SAMPLE_SIZE, signal }),
      (state) => {
        marketsState = state;
        renderTable();
        renderMovers();
      },
    );

    const trending = createResource(
      (signal) => fetchTrending({ signal }),
      (state) =>
        renderResource(trendingRegion, state, {
          skeleton: () => createSkeleton('row', MOVERS_LIMIT),
          ready: ({ coins }) =>
            coins.length === 0 ? createEmptyState({ message: t('overview.trending.empty') }) : createAssetList(coins.slice(0, TRENDING_LIMIT), getLanguage()),
          onRetry: () => trending.load(),
        }),
    );

    const tablePanel = createPanel({
      title: t('overview.table.title'),
      flush: true,
      actions: el('a', { class: 'button button--quiet', href: '/markets' }, t('overview.table.viewAll')),
    });
    tablePanel.body.append(tableRegion);

    const trendingPanel = createPanel({ title: t('overview.trending.title'), description: t('overview.trending.description') });
    trendingPanel.body.append(trendingRegion);

    const moversPanel = createPanel({
      title: t('overview.movers.title'),
      description: t('overview.movers.description'),
      actions: createSegmented({
        label: t('overview.movers.mode'),
        options: [
          { value: 'gainers', label: t('overview.movers.gainers') },
          { value: 'losers', label: t('overview.movers.losers') },
        ],
        value: moversMode,
        onChange: (value) => {
          moversMode = value;
          renderMovers();
        },
      }),
    });
    moversPanel.body.append(moversRegion);

    function loadAll() {
      stats.load();
      chart.load();
      markets.load();
      trending.load();
    }

    container.append(
      el(
        'section',
        { class: 'page' },
        el(
          'header',
          { class: 'page__header page__header--split' },
          el('div', { class: 'page__heading' }, el('h1', { class: 'page__title' }, t('overview.title')), el('p', { class: 'page__lede' }, t('overview.description'))),
          el(
            'div',
            { class: 'page__toolbar' },
            updated,
            el('button', { class: 'button button--quiet button--icon', type: 'button', onclick: loadAll }, createIcon('refresh', { size: 16 }), t('common.refresh')),
          ),
        ),
        statsRegion,
        chart.element,
        tablePanel.element,
        el('div', { class: 'panel-grid' }, trendingPanel.element, moversPanel.element),
      ),
    );

    loadAll();

    return () => {
      for (const resource of [stats, markets, trending, chart]) resource.abort();
    };
  },
};
