import { t } from '../i18n/index.js';
import { compareTray } from '../state/compare-tray.js';
import { buildComparisonUrl } from '../utils/compare-state.js';
import { DEFAULT_RANGE } from '../utils/ranges.js';
import { el } from '../utils/dom.js';

export function createCompareTray() {
  const root = el('nav', { class: 'tray', 'aria-label': t('screener.tray.label'), hidden: true });

  function render(ids) {
    root.hidden = ids.length === 0;
    root.replaceChildren(
      el('p', { class: 'tray__count' }, t('screener.tray.count', { count: ids.length, max: compareTray.max })),
      ids.length >= 2
        ? el('a', { class: 'button', href: buildComparisonUrl({ ids, range: DEFAULT_RANGE }) }, t('screener.tray.open'))
        : el('button', { class: 'button', type: 'button', disabled: true }, t('screener.tray.open')),
      el('button', { class: 'button button--quiet', type: 'button', onclick: () => ids.forEach((id) => compareTray.remove(id)) }, t('screener.tray.clear')),
    );
  }

  render(compareTray.list());
  const unsubscribe = compareTray.subscribe(render);
  return { element: root, destroy: unsubscribe };
}
