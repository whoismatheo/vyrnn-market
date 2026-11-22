import { fetchMarkets, fetchSearch } from '../api/market.js';
import { t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { createCoinLogo } from './coin-cell.js';
import { createIcon } from './icon.js';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const SUGGESTION_POOL = 40;
const MAX_VISIBLE = 8;

export function createAssetPicker({ max, getSelected, onSelect }) {
  const listId = 'asset-picker-list';
  let suggestions = null;
  let results = [];
  let status = 'idle';
  let heading = null;
  let active = -1;
  let timer = null;
  let controller = null;

  const input = el('input', {
    class: 'picker__input',
    type: 'text',
    role: 'combobox',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    maxlength: '40',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
    'aria-label': t('compare.picker.label'),
    placeholder: t('compare.picker.placeholder'),
  });
  const list = el('ul', { id: listId, class: 'picker__list', role: 'listbox', 'aria-label': t('compare.picker.label'), hidden: true });
  const live = el('p', { class: 'sr-only', role: 'status' });
  const hint = el('p', { class: 'picker__hint', hidden: true }, t('compare.picker.full', { max }));
  const root = el(
    'div',
    { class: 'picker' },
    el('div', { class: 'picker__field' }, createIcon('search', { size: 18 }), input),
    list,
    hint,
    live,
  );

  const isOpen = () => !list.hidden;
  const visible = () => results.filter((coin) => !getSelected().includes(coin.id)).slice(0, MAX_VISIBLE);

  function announce(message) {
    live.textContent = message;
  }

  function setActive(index, { scroll = false } = {}) {
    active = index;
    input.setAttribute('aria-activedescendant', index >= 0 ? `${listId}-${index}` : '');
    list.querySelectorAll('[role="option"]').forEach((option, position) => option.setAttribute('aria-selected', String(position === index)));
    if (scroll) list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function createOption(coin, index) {
    const option = el(
      'li',
      { id: `${listId}-${index}`, class: 'picker__option', role: 'option', 'aria-selected': 'false', onclick: () => choose(coin) },
      createCoinLogo(coin),
      el('span', { class: 'picker__name' }, coin.name),
      el('span', { class: 'picker__symbol' }, coin.symbol),
      coin.rank === null ? null : el('span', { class: 'picker__rank' }, `#${coin.rank}`),
    );
    option.addEventListener('pointermove', () => setActive(index));
    return option;
  }

  function renderList() {
    if (!isOpen()) return;
    const items = visible();
    let message = null;
    if (status === 'loading') message = t('compare.picker.loading');
    else if (status === 'error') message = t('compare.picker.unavailable');
    else if (items.length === 0) message = t('compare.picker.noResults');

    list.replaceChildren(
      ...(heading && items.length > 0 ? [el('li', { class: 'picker__heading', role: 'presentation' }, heading)] : []),
      ...items.map(createOption),
      ...(message ? [el('li', { class: 'picker__message', role: 'presentation' }, message)] : []),
    );
    setActive(items.length > 0 && status === 'ready' ? Math.min(Math.max(active, 0), items.length - 1) : -1);
    announce(status === 'ready' && items.length > 0 ? t('compare.picker.results', { count: items.length }) : (message ?? ''));
  }

  function open() {
    if (input.disabled || isOpen()) return;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    refresh();
  }

  function close() {
    if (!isOpen()) return;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }

  function handleOutsidePointer(event) {
    if (!root.contains(event.target)) close();
  }

  async function showSuggestions() {
    controller?.abort();
    heading = t('compare.picker.suggestions');
    if (suggestions) {
      results = suggestions;
      status = 'ready';
      renderList();
      return;
    }

    controller = new AbortController();
    const { signal } = controller;
    status = 'loading';
    results = [];
    renderList();
    try {
      const { data } = await fetchMarkets({ perPage: 100, signal });
      suggestions = data.coins.slice(0, SUGGESTION_POOL);
      results = suggestions;
      status = 'ready';
    } catch (error) {
      if (signal.aborted) return;
      console.error(error);
      status = 'error';
    }
    renderList();
  }

  async function runSearch(query) {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    heading = null;
    status = 'loading';
    results = [];
    renderList();
    try {
      const { data } = await fetchSearch({ q: query, signal });
      results = data.coins;
      status = 'ready';
    } catch (error) {
      if (signal.aborted) return;
      console.error(error);
      status = 'error';
    }
    renderList();
  }

  function refresh() {
    clearTimeout(timer);
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) showSuggestions();
    else runSearch(query);
  }

  function choose(coin) {
    input.value = '';
    close();
    onSelect(coin);
    if (!input.disabled) input.focus();
  }

  input.addEventListener('click', open);
  input.addEventListener('input', () => {
    open();
    clearTimeout(timer);
    timer = setTimeout(refresh, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (event) => {
    const count = visible().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen()) {
        open();
        return;
      }
      if (count > 0 && status === 'ready') {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((active + step + count) % count, { scroll: true });
      }
    } else if (event.key === 'Enter') {
      if (isOpen() && active >= 0 && status === 'ready') {
        event.preventDefault();
        choose(visible()[active]);
      }
    } else if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  });

  function update() {
    const full = getSelected().length >= max;
    input.disabled = full;
    hint.hidden = !full;
    if (full) close();
    else renderList();
  }

  function destroy() {
    clearTimeout(timer);
    controller?.abort();
    document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }

  update();

  return { element: root, input, update, destroy };
}
