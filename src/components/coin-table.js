import { t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatCompactCurrency, formatInteger, formatPrice } from '../utils/format.js';
import { createChangeBadge } from './change-badge.js';
import { createCoinCell } from './coin-cell.js';
import { createSparkline } from './sparkline.js';

const COLUMNS = {
  rank: { className: 'col-rank', cell: (coin, locale) => formatInteger(coin.rank, locale) },
  asset: { className: 'col-asset', cell: (coin) => createCoinCell(coin) },
  price: {
    className: 'col-price',
    cell: (coin, locale) => [
      el('span', { class: 'price' }, formatPrice(coin.price, locale)),
      el('span', { class: 'price-cap' }, `${t('table.marketCapShort')} ${formatCompactCurrency(coin.marketCap, locale)}`),
    ],
  },
  change: { className: 'col-change', cell: (coin, locale) => createChangeBadge(coin.change24h, locale) },
  marketCap: { className: 'col-cap', cell: (coin, locale) => formatCompactCurrency(coin.marketCap, locale) },
  volume: { className: 'col-volume', cell: (coin, locale) => formatCompactCurrency(coin.volume24h, locale) },
  trend: { className: 'col-trend', cell: (coin) => (coin.sparkline ? createSparkline(coin.sparkline) : null) },
};

export function createCoinTable({ coins, columns, caption, locale }) {
  const header = columns.map((name) => el('th', { scope: 'col', class: COLUMNS[name].className }, t(`table.${name}`)));

  const rows = coins.map((coin) =>
    el(
      'tr',
      {},
      columns.map((name) => {
        const { className, cell } = COLUMNS[name];
        return name === 'asset'
          ? el('th', { scope: 'row', class: className }, cell(coin, locale))
          : el('td', { class: className }, cell(coin, locale));
      }),
    ),
  );

  return el(
    'div',
    { class: 'table-wrap' },
    el('table', { class: 'coin-table' }, el('caption', { class: 'sr-only' }, caption), el('thead', {}, el('tr', {}, header)), el('tbody', {}, rows)),
  );
}
