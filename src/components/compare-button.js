import { t } from '../i18n/index.js';
import { compareTray } from '../state/compare-tray.js';
import { el } from '../utils/dom.js';
import { createIcon } from './icon.js';
import { showToast } from './toast.js';

function apply(button) {
  const selected = compareTray.has(button.dataset.compareId);
  button.setAttribute('aria-pressed', String(selected));
  button.setAttribute('aria-label', t(selected ? 'screener.actions.compareRemove' : 'screener.actions.compareAdd', { name: button.dataset.compareName }));
}

compareTray.subscribe(() => {
  for (const button of document.querySelectorAll('[data-compare-id]')) apply(button);
});

export function createCompareButton(coin) {
  const button = el(
    'button',
    {
      class: 'compare-button',
      type: 'button',
      'data-compare-id': coin.id,
      'data-compare-name': coin.name,
      onclick: (event) => {
        const result = compareTray.toggle(event.currentTarget.dataset.compareId);
        if (result.full) showToast(t('screener.tray.full', { max: compareTray.max }));
      },
    },
    createIcon('compare', { size: 20 }),
  );
  apply(button);
  return button;
}
