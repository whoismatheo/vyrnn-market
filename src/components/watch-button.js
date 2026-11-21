import { t } from '../i18n/index.js';
import { watchlist } from '../state/watchlist.js';
import { el } from '../utils/dom.js';
import { createIcon } from './icon.js';
import { showToast } from './toast.js';

function apply(button) {
  const watched = watchlist.has(button.dataset.watchId);
  button.setAttribute('aria-pressed', String(watched));
  button.setAttribute('aria-label', t(watched ? 'watchlist.removeNamed' : 'watchlist.addNamed', { name: button.dataset.watchName }));

  const label = button.querySelector('.watch-button__label');
  if (label) label.textContent = t(watched ? 'watchlist.saved' : 'watchlist.add');
}

function refreshAll() {
  for (const button of document.querySelectorAll('[data-watch-id]')) apply(button);
}

watchlist.subscribe(refreshAll);

function handleClick(button) {
  const result = watchlist.toggle(button.dataset.watchId);
  if (result.full) showToast(t('watchlist.full', { max: watchlist.max }));
  else if (!result.persisted) showToast(t('watchlist.notSaved'));
}

export function createWatchButton(coin, { labeled = false } = {}) {
  const button = el(
    'button',
    {
      class: labeled ? 'watch-button watch-button--labeled' : 'watch-button',
      type: 'button',
      'data-watch-id': coin.id,
      'data-watch-name': coin.name,
      onclick: (event) => handleClick(event.currentTarget),
    },
    createIcon('star', { size: 20 }),
    labeled ? el('span', { class: 'watch-button__label' }) : null,
  );
  apply(button);
  return button;
}
