import { t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatCompactCurrency, formatInteger, formatPrice } from '../utils/format.js';
import { createChangeBadge } from './change-badge.js';
import { createCoinLogo } from './coin-cell.js';
import { createIcon } from './icon.js';
import { createSeriesSwatch } from './series-swatch.js';

function createMetric(label, value) {
  return el('div', { class: 'compare-asset__metric' }, el('dt', {}, label), el('dd', {}, value));
}

function createBody(asset, locale) {
  const { market, onRetry } = asset;

  if (market.phase === 'loading') {
    return [el('div', { class: 'skeleton skeleton--row' }), el('div', { class: 'skeleton skeleton--row' }), el('span', { class: 'sr-only' }, t('state.loading'))];
  }

  if (market.phase === 'ready') {
    const { coin } = market;
    return [
      el('p', { class: 'compare-asset__price' }, formatPrice(coin.price, locale)),
      el('p', { class: 'compare-asset__change' }, createChangeBadge(coin.change24h, locale), el('span', {}, t('detail.last24h'))),
      el(
        'dl',
        { class: 'compare-asset__metrics' },
        createMetric(t('detail.stats.marketCap'), formatCompactCurrency(coin.marketCap, locale)),
        createMetric(t('detail.stats.volume'), formatCompactCurrency(coin.volume24h, locale)),
      ),
    ];
  }

  return [
    el('p', { class: 'compare-asset__note' }, market.phase === 'missing' ? t('compare.asset.unavailable') : t('error.provider')),
    market.phase === 'error' ? el('button', { class: 'button button--quiet', type: 'button', onclick: onRetry }, t('common.retry')) : null,
  ];
}

export function createCompareAsset(asset, locale) {
  const { identity, market, style, onRemove } = asset;
  const coin = market.phase === 'ready' ? market.coin : identity;
  const rank = market.phase === 'ready' && market.coin.rank !== null ? formatInteger(market.coin.rank, locale) : null;

  return el(
    'article',
    { class: 'compare-asset', 'data-state': market.phase },
    el(
      'header',
      { class: 'compare-asset__head' },
      createSeriesSwatch(style),
      el('button', { class: 'compare-asset__remove', type: 'button', 'aria-label': t('compare.asset.remove', { name: coin.name }), onclick: onRemove }, createIcon('close', { size: 16 })),
    ),
    el(
      'div',
      { class: 'compare-asset__identity' },
      createCoinLogo(coin),
      el(
        'div',
        { class: 'compare-asset__title' },
        el('a', { class: 'compare-asset__name', href: `/coins/${encodeURIComponent(identity.id)}` }, coin.name),
        el('p', { class: 'compare-asset__tags' }, coin.symbol ? el('span', {}, coin.symbol) : null, rank ? el('span', {}, t('detail.rank', { rank })) : null),
      ),
    ),
    createBody(asset, locale),
  );
}
