import { fetchMarkets } from '../api/market.js';
import { createCoinTable } from '../components/coin-table.js';
import { createEmptyState, createSkeleton, renderResource } from '../components/data-state.js';
import { createPanel } from '../components/panel.js';
import { getLanguage, t } from '../i18n/index.js';
import { watchlist } from '../state/watchlist.js';
import { el } from '../utils/dom.js';
import { createResource } from '../utils/resource.js';

const COLUMNS = ['rank', 'asset', 'price', 'change', 'marketCap', 'volume', 'trend', 'watch'];

function createMissingNote(ids) {
  return el(
    'div',
    { class: 'missing-assets' },
    el('p', { class: 'inline-state__title' }, t('watchlist.missing.title')),
    el('p', { class: 'inline-state__text' }, t('watchlist.missing.message')),
    el(
      'ul',
      { class: 'missing-assets__list' },
      ids.map((id) =>
        el(
          'li',
          {},
          el('span', {}, id),
          el('button', { class: 'button button--quiet', type: 'button', 'aria-label': t('watchlist.missing.removeNamed', { name: id }), onclick: () => watchlist.remove(id) }, t('watchlist.missing.remove')),
        ),
      ),
    ),
  );
}

export default {
  mount(container, { navigate }) {
    let state = { phase: 'loading' };
    let requested = new Set();
    const count = el('span', { class: 'page__updated' });
    const region = el('div', { class: 'panel__region' });

    function savedIds() {
      return watchlist.list();
    }

    function render() {
      const ids = savedIds();
      count.textContent = ids.length > 0 ? t('watchlist.count', { count: ids.length }) : '';

      if (ids.length === 0) {
        region.setAttribute('aria-busy', 'false');
        region.replaceChildren(
          createEmptyState({
            title: t('watchlist.empty.title'),
            message: t('watchlist.empty.message'),
            action: { label: t('watchlist.empty.action'), onClick: () => navigate('/markets') },
          }),
        );
        return;
      }

      renderResource(region, state, {
        skeleton: () => createSkeleton('table-row', Math.min(ids.length, 8)),
        ready: ({ coins }) => {
          const visible = coins.filter((coin) => ids.includes(coin.id)).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
          const found = new Set(coins.map((coin) => coin.id));
          const missing = ids.filter((id) => !found.has(id));
          return el(
            'div',
            { class: 'watchlist-content' },
            visible.length > 0 ? createCoinTable({ coins: visible, columns: COLUMNS, caption: t('watchlist.caption'), locale: getLanguage() }) : null,
            missing.length > 0 ? createMissingNote(missing) : null,
          );
        },
        onRetry: () => load(),
      });
    }

    const resource = createResource(
      (signal) => fetchMarkets({ ids: savedIds(), signal }),
      (next) => {
        state = next;
        render();
      },
    );

    function load() {
      const ids = savedIds();
      if (ids.length === 0) {
        resource.abort();
        render();
        return;
      }
      requested = new Set(ids);
      resource.load();
    }

    const unsubscribe = watchlist.subscribe((ids) => {
      if (ids.some((id) => !requested.has(id))) load();
      else render();
    });

    const panel = createPanel({ flush: true });
    panel.body.append(region);

    container.append(
      el(
        'section',
        { class: 'page' },
        el(
          'header',
          { class: 'page__header page__header--split' },
          el('div', { class: 'page__heading' }, el('h1', { class: 'page__title' }, t('watchlist.title')), el('p', { class: 'page__lede' }, t('watchlist.description'))),
          el('div', { class: 'page__toolbar' }, count),
        ),
        panel.element,
      ),
    );

    load();

    return () => {
      unsubscribe();
      resource.abort();
    };
  },
};
