import { fetchMarkets } from '../api/market.js';
import { createCoinTable } from '../components/coin-table.js';
import { createEmptyState, createSkeleton, renderResource } from '../components/data-state.js';
import { createPagination } from '../components/pagination.js';
import { createPanel } from '../components/panel.js';
import { createSegmented } from '../components/segmented.js';
import { getLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { createResource } from '../utils/resource.js';

const PER_PAGE = 50;
const MAX_PAGE = 100;
const SORT_ORDERS = { cap: 'market_cap_desc', volume: 'volume_desc' };
const COLUMNS = ['rank', 'asset', 'price', 'change', 'marketCap', 'volume', 'trend', 'watch'];

function parsePage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

function marketsUrl({ page, sort }) {
  const params = new URLSearchParams();
  if (sort !== 'cap') params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/markets?${search}` : '/markets';
}

export default {
  mount(container, { query, navigate }) {
    const requestedSort = query.get('sort');
    const sort = Object.hasOwn(SORT_ORDERS, requestedSort) ? requestedSort : 'cap';
    const page = parsePage(query.get('page'));

    const tableRegion = el('div', { class: 'panel__region' });
    const paginationRegion = el('div', { class: 'pagination-region' });

    const resource = createResource(
      (signal) => fetchMarkets({ page, perPage: PER_PAGE, order: SORT_ORDERS[sort], signal }),
      (state) => {
        renderResource(tableRegion, state, {
          skeleton: () => createSkeleton('table-row', 12),
          ready: ({ coins }) =>
            coins.length === 0
              ? createEmptyState({
                  title: t('markets.empty.title'),
                  message: t('markets.empty.message'),
                  action: page > 1 ? { label: t('markets.empty.action'), onClick: () => navigate(marketsUrl({ page: 1, sort })) } : null,
                })
              : createCoinTable({ coins, columns: COLUMNS, caption: t('markets.caption'), locale: getLanguage() }),
          onRetry: () => resource.load(),
        });

        const showPagination = state.phase === 'ready' && (state.data.coins.length > 0 || page > 1);
        paginationRegion.replaceChildren(
          ...(showPagination
            ? [createPagination({ page, hasNext: state.data.coins.length === PER_PAGE, onNavigate: (next) => navigate(marketsUrl({ page: next, sort })) })]
            : []),
        );
      },
    );

    const panel = createPanel({ flush: true });
    panel.body.append(tableRegion);

    container.append(
      el(
        'section',
        { class: 'page' },
        el(
          'header',
          { class: 'page__header page__header--split' },
          el('div', { class: 'page__heading' }, el('h1', { class: 'page__title' }, t('markets.title')), el('p', { class: 'page__lede' }, t('markets.description'))),
          el(
            'div',
            { class: 'page__toolbar' },
            createSegmented({
              label: t('markets.sort.label'),
              options: Object.keys(SORT_ORDERS).map((value) => ({ value, label: t(`markets.sort.${value}`) })),
              value: sort,
              onChange: (value) => navigate(marketsUrl({ page: 1, sort: value })),
            }),
          ),
        ),
        panel.element,
        paginationRegion,
      ),
    );

    resource.load();
    return () => resource.abort();
  },
};
