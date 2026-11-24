import { t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatCompactCurrency, formatInteger, formatPrice } from '../utils/format.js';
import { createChangeBadge } from './change-badge.js';
import { createCompareButton } from './compare-button.js';
import { createCoinCell } from './coin-cell.js';
import { createSparkline } from './sparkline.js';
import { createWatchButton } from './watch-button.js';

const COLUMNS = {
  rank: { className: 'col-rank', cell: (coin, locale) => formatInteger(coin.rank, locale) },
  asset: { className: 'col-asset' },
  price: {
    className: 'col-price',
    cell: (coin, locale) => [
      el('span', { class: 'price' }, formatPrice(coin.price, locale)),
      el('span', { class: 'price-change' }, createChangeBadge(coin.change24h, locale)),
    ],
  },
  change: { className: 'col-change', cell: (coin, locale) => createChangeBadge(coin.change24h, locale) },
  marketCap: { className: 'col-cap', cell: (coin, locale) => formatCompactCurrency(coin.marketCap, locale) },
  volume: { className: 'col-volume', cell: (coin, locale) => formatCompactCurrency(coin.volume24h, locale) },
  trend: { className: 'col-trend', cell: (coin) => (coin.sparkline ? createSparkline(coin.sparkline) : null) },
  compare: { className: 'col-compare', cell: (coin) => createCompareButton(coin) },
  watch: { className: 'col-watch', cell: (coin) => createWatchButton(coin) },
};

function buildMeta(coin, columns, locale) {
  const parts = [];
  if (columns.includes('rank')) parts.push(`#${formatInteger(coin.rank, locale)}`);
  if (columns.includes('marketCap')) parts.push(`${t('table.marketCapShort')} ${formatCompactCurrency(coin.marketCap, locale)}`);
  if (columns.includes('volume')) parts.push(`${t('table.volumeShort')} ${formatCompactCurrency(coin.volume24h, locale)}`);
  return parts;
}

function createHeaderCell(name) {
  const { className } = COLUMNS[name];
  if (name === 'watch' || name === 'compare') return el('th', { scope: 'col', class: className }, el('span', { class: 'sr-only' }, t(`table.${name}`)));
  return el('th', { scope: 'col', class: className }, t(`table.${name}`));
}

export function createCoinTable({ coins, columns, caption, locale }) {
  const rows = coins.map((coin) =>
    el(
      'tr',
      {},
      columns.map((name) => {
        const { className, cell } = COLUMNS[name];
        if (name === 'asset') return el('th', { scope: 'row', class: className }, createCoinCell(coin, { meta: buildMeta(coin, columns, locale) }));
        return el('td', { class: className }, cell(coin, locale));
      }),
    ),
  );

  return el(
    'div',
    { class: 'table-wrap' },
    el(
      'table',
      { class: 'coin-table' },
      el('caption', { class: 'sr-only' }, caption),
      el('thead', {}, el('tr', {}, columns.map(createHeaderCell))),
      el('tbody', {}, rows),
    ),
  );
}
