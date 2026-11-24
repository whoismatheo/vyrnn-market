import { fetchCategories, fetchScreener } from '../api/market.js';
import { createChoiceMenu } from '../components/choice-menu.js';
import { createCoinTable } from '../components/coin-table.js';
import { createCompareTray } from '../components/compare-tray.js';
import { createEmptyState, createSkeleton, renderResource } from '../components/data-state.js';
import { createIcon } from '../components/icon.js';
import { createPagination } from '../components/pagination.js';
import { createPanel } from '../components/panel.js';
import { createRangeField } from '../components/range-field.js';
import { createSavedScreensPanel } from '../components/saved-screens-panel.js';
import { createSegmented } from '../components/segmented.js';
import { getLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatCompactCurrency, formatInteger, formatPercentChange, formatPrice } from '../utils/format.js';
import { createResource } from '../utils/resource.js';
import { DEPTHS, RANGE_FIELDS, SORTS, activeFilters, buildScreenerSearch, buildScreenerUrl, clearFilters, defaultDirection, parseScreener } from '../utils/screener-state.js';

const COLUMNS = ['rank', 'asset', 'price', 'change', 'marketCap', 'volume', 'compare', 'watch'];
const SEARCH_DEBOUNCE_MS = 450;

function formatBound(key, value, locale) {
  if (key === 'price') return formatPrice(value, locale);
  if (key === 'change') return formatPercentChange(value, locale);
  if (key === 'rank') return `#${formatInteger(value, locale)}`;
  return formatCompactCurrency(value, locale);
}

function describeRange(key, { min, max }, locale) {
  const label = t(`screener.ranges.${key}`);
  if (min !== undefined && max !== undefined) return `${label}: ${formatBound(key, min, locale)} \u2013 ${formatBound(key, max, locale)}`;
  if (min !== undefined) return `${label}: \u2265 ${formatBound(key, min, locale)}`;
  return `${label}: \u2264 ${formatBound(key, max, locale)}`;
}

export default {
  mount(container, { query, navigate, replace }) {
    let state = parseScreener(query);
    let categories = { phase: 'loading' };
    let timer = null;

    const canonical = buildScreenerUrl(state);
    if (canonical !== window.location.pathname + window.location.search) replace(canonical);

    const locale = getLanguage();
    const search = () => buildScreenerSearch(state);

    function categoryName(id) {
      return categories.phase === 'ready' ? (categories.data.categories.find((category) => category.id === id)?.name ?? id) : id;
    }

    const resource = createResource((signal) => fetchScreener({ search: search(), signal }), render);
    const categoriesResource = createResource((signal) => fetchCategories({ signal }), (next) => {
      categories = next;
      categoryMenu.sync();
      categoryHint.hidden = next.phase !== 'error';
    });

    function commit({ immediate = false } = {}) {
      clearTimeout(timer);
      const run = () => {
        state = { ...state, page: 1 };
        replace(buildScreenerUrl(state));
        renderChips();
        resource.load();
      };
      if (immediate) run();
      else timer = setTimeout(run, SEARCH_DEBOUNCE_MS);
    }

    const searchInput = el('input', {
      class: 'field__input',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      maxlength: '40',
      placeholder: t('screener.search.placeholder'),
      'aria-label': t('screener.search.label'),
      value: state.q,
      oninput: () => {
        state = { ...state, q: searchInput.value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 40) };
        if (!/^[\p{L}\p{N} ._-]*$/u.test(state.q)) state = { ...state, q: '' };
        commit();
      },
    });

    const categoryHint = el('p', { class: 'field__hint', hidden: true }, t('screener.category.unavailable'));
    const categoryMenu = createChoiceMenu({
      name: 'category',
      className: 'choice--start choice--field',
      label: () => t('screener.category.label'),
      getItems: () => [
        { value: '', label: t('screener.category.all') },
        ...(categories.phase === 'ready' ? categories.data.categories.map(({ id, name }) => ({ value: id, label: name })) : []),
        ...(state.category && !(categories.data?.categories ?? []).some(({ id }) => id === state.category) ? [{ value: state.category, label: state.category }] : []),
      ],
      getValue: () => state.category,
      onSelect(value) {
        state = { ...state, category: value };
        categoryMenu.sync();
        renderChipsAndCommit();
      },
      renderTrigger: (item) => [el('span', { class: 'choice-trigger__long' }, item.label)],
    });

    const sortMenu = createChoiceMenu({
      name: 'sort',
      className: 'choice--start choice--field',
      label: () => t('screener.sort.label'),
      getItems: () => SORTS.map((value) => ({ value, label: t(`screener.sort.${value}`) })),
      getValue: () => state.sort,
      onSelect(value) {
        state = { ...state, sort: value, dir: defaultDirection(value) };
        sortMenu.sync();
        syncDirection();
        commit({ immediate: true });
      },
      renderTrigger: (item) => [el('span', { class: 'choice-trigger__long' }, item.label)],
    });

    const directionButton = el('button', { class: 'button button--quiet field__direction', type: 'button', onclick: () => {
      state = { ...state, dir: state.dir === 'asc' ? 'desc' : 'asc' };
      syncDirection();
      commit({ immediate: true });
    } });

    function syncDirection() {
      directionButton.replaceChildren(createIcon('chevron', { size: 16 }), el('span', { class: 'sr-only' }, t(`screener.direction.${state.dir}`)));
      directionButton.setAttribute('aria-label', `${t('screener.direction.toggle')}: ${t(`screener.direction.${state.dir}`)}`);
      directionButton.dataset.dir = state.dir;
    }

    const rangeFields = Object.keys(RANGE_FIELDS).map((key) =>
      createRangeField({
        key,
        value: state.ranges[key],
        onInput({ range, error }) {
          if (error) return;
          const ranges = { ...state.ranges };
          if (Object.keys(range).length === 0) delete ranges[key];
          else ranges[key] = { min: range.min, max: range.max };
          state = { ...state, ranges };
          commit();
        },
      }),
    );

    const depth = createSegmented({
      label: t('screener.depth.label'),
      options: DEPTHS.map((value) => ({ value, label: t('screener.depth.option', { count: value }) })),
      value: state.depth,
      onChange(value) {
        state = { ...state, depth: value };
        commit({ immediate: true });
      },
    });

    const chips = el('div', { class: 'chips' });
    const filtersBody = el(
      'div',
      { class: 'filters' },
      el('label', { class: 'field' }, el('span', { class: 'field__label' }, t('screener.search.label')), searchInput),
      el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('screener.category.label')), categoryMenu.element, categoryHint),
      el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('screener.sort.label')), el('div', { class: 'field__sort' }, sortMenu.element, directionButton)),
      ...rangeFields,
      el('div', { class: 'field' }, el('span', { class: 'field__label' }, t('screener.depth.label')), depth, el('p', { class: 'field__hint' }, t('screener.depth.hint'))),
      el('p', { class: 'field__hint filters__note' }, t('screener.hint')),
    );

    const details = el('details', { class: 'panel filters-panel' }, el('summary', { class: 'filters-panel__summary' }, el('span', {}, t('screener.filters')), el('span', { class: 'filters-panel__count' })), filtersBody);
    details.open = window.matchMedia('(min-width: 900px)').matches;

    function renderChips() {
      const active = activeFilters(state);
      details.querySelector('.filters-panel__count').textContent = active.length > 0 ? String(active.length) : '';

      const items = active.map((filter) => {
        const text = filter.type === 'q' ? t('screener.active.search', { value: state.q }) : filter.type === 'category' ? t('screener.active.category', { value: categoryName(state.category) }) : describeRange(filter.key, state.ranges[filter.key], locale);
        return el(
          'button',
          {
            class: 'chip',
            type: 'button',
            'aria-label': t('screener.active.remove', { label: text }),
            onclick: () => {
              const next = { ...state, ranges: { ...state.ranges } };
              if (filter.type === 'q') next.q = '';
              else if (filter.type === 'category') next.category = '';
              else delete next.ranges[filter.key];
              navigate(buildScreenerUrl({ ...next, page: 1 }));
            },
          },
          el('span', {}, text),
          createIcon('close', { size: 14 }),
        );
      });

      chips.replaceChildren(
        ...(items.length > 0
          ? [
              el('p', { class: 'sr-only' }, t('screener.active.label')),
              ...items,
              el('button', { class: 'chips__clear', type: 'button', onclick: () => navigate(buildScreenerUrl(clearFilters(state))) }, t('screener.active.clear')),
            ]
          : []),
      );
    }

    function renderChipsAndCommit() {
      commit({ immediate: true });
    }

    const resultsRegion = el('div', { class: 'panel__region' });
    const resultsPanel = createPanel({ flush: true });
    resultsPanel.body.append(resultsRegion);

    function render(next) {
      renderResource(resultsRegion, next, {
        skeleton: () => createSkeleton('table-row', 10),
        ready: (data) => {
          const summary = el(
            'div',
            { class: 'screener-summary' },
            el('p', { class: 'screener-summary__count', role: 'status' }, t('screener.results.count', { count: formatInteger(data.total, locale) })),
            el('p', { class: 'screener-summary__scope' }, `${t('screener.results.scanned', { count: formatInteger(data.scanned, locale) })}. ${t('screener.results.searchScope')}`),
            data.complete ? null : el('p', { class: 'stale-note' }, t('screener.results.partial', { scanned: formatInteger(data.scanned, locale), requested: formatInteger(Number(state.depth), locale) })),
          );

          if (data.coins.length === 0) {
            return el(
              'div',
              {},
              summary,
              createEmptyState({
                title: t('screener.empty.title'),
                message: t('screener.empty.message'),
                action: { label: data.total > 0 ? t('markets.empty.action') : t('screener.empty.action'), onClick: () => navigate(buildScreenerUrl(data.total > 0 ? { ...state, page: 1 } : clearFilters(state))) },
              }),
            );
          }

          return el(
            'div',
            {},
            summary,
            createCoinTable({ coins: data.coins, columns: COLUMNS, caption: t('screener.results.caption'), locale }),
            data.pages > 1 ? el('div', { class: 'screener-pagination' }, createPagination({ page: data.page, hasNext: data.page < data.pages, onNavigate: (page) => navigate(buildScreenerUrl({ ...state, page })) })) : null,
          );
        },
        onRetry: () => resource.load(),
      });
    }

    const saved = createSavedScreensPanel({ getSearch: () => buildScreenerSearch(state, { includePage: false }), onApply: (savedSearch) => navigate(buildScreenerUrl(parseScreener(savedSearch))) });
    const tray = createCompareTray();

    container.append(
      el(
        'section',
        { class: 'page' },
        el(
          'header',
          { class: 'page__header page__header--split' },
          el('div', { class: 'page__heading' }, el('h1', { class: 'page__title' }, t('screener.title')), el('p', { class: 'page__lede' }, t('screener.description'))),
          el('div', { class: 'page__toolbar' }, el('button', { class: 'button button--quiet', type: 'button', onclick: saved.save }, t('screener.saved.save'))),
        ),
        details,
        chips,
        resultsPanel.element,
        saved.element,
        tray.element,
      ),
    );

    syncDirection();
    renderChips();
    categoriesResource.load();
    resource.load();

    return () => {
      clearTimeout(timer);
      resource.abort();
      categoriesResource.abort();
      saved.destroy();
      tray.destroy();
      categoryMenu.destroy();
      sortMenu.destroy();
    };
  },
};
