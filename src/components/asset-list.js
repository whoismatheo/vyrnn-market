import { el } from '../utils/dom.js';
import { formatPrice } from '../utils/format.js';
import { createChangeBadge } from './change-badge.js';
import { createCoinCell } from './coin-cell.js';

export function createAssetList(coins, locale) {
  return el(
    'ul',
    { class: 'asset-list' },
    coins.map((coin) =>
      el(
        'li',
        { class: 'asset-list__item' },
        createCoinCell(coin),
        el(
          'span',
          { class: 'asset-list__figures' },
          el('span', { class: 'asset-list__price' }, formatPrice(coin.price, locale)),
          createChangeBadge(coin.change24h, locale),
        ),
      ),
    ),
  );
}
