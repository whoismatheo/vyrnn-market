import { t } from '../i18n/index.js';
import { el } from '../utils/dom.js';

export function createPagination({ page, hasNext, onNavigate }) {
  return el(
    'nav',
    { class: 'pagination', 'aria-label': t('markets.pagination.label') },
    el(
      'button',
      { class: 'button button--quiet', type: 'button', disabled: page <= 1, onclick: () => onNavigate(page - 1) },
      t('markets.pagination.previous'),
    ),
    el('span', { class: 'pagination__page', 'aria-current': 'page' }, t('markets.pagination.page', { page })),
    el(
      'button',
      { class: 'button button--quiet', type: 'button', disabled: !hasNext, onclick: () => onNavigate(page + 1) },
      t('markets.pagination.next'),
    ),
  );
}
