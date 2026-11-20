import { SUPPORTED_LANGUAGES, getLanguage, onLanguageChange, setLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { createIcon } from './icon.js';

const MENU_ID = 'language-menu';

export function createLanguageMenu() {
  const codeLabel = el('span', { class: 'lang-trigger__code' });
  const nameLabel = el('span', { class: 'lang-trigger__name' });
  const trigger = el(
    'button',
    {
      class: 'lang-trigger',
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      'aria-controls': MENU_ID,
    },
    createIcon('globe', { size: 16 }),
    codeLabel,
    nameLabel,
    createIcon('chevron', { size: 14 }),
  );

  const items = SUPPORTED_LANGUAGES.map(({ code, label }) =>
    el(
      'button',
      {
        class: 'lang-menu__item',
        type: 'button',
        role: 'menuitemradio',
        'aria-checked': 'false',
        tabindex: '-1',
        lang: code,
        'data-code': code,
        onclick: () => select(code),
      },
      el('span', {}, label),
      createIcon('check', { size: 16 }),
    ),
  );

  const menu = el('div', { id: MENU_ID, class: 'lang-menu', role: 'menu', hidden: true, 'data-i18n-aria-label': 'shell.language' }, items);
  const root = el('div', { class: 'lang-picker' }, trigger, menu);

  const isOpen = () => !menu.hidden;

  function sync() {
    const current = getLanguage();
    const { label } = SUPPORTED_LANGUAGES.find(({ code }) => code === current);
    codeLabel.textContent = current.toUpperCase();
    nameLabel.textContent = label;
    trigger.setAttribute('aria-label', `${t('shell.language')}: ${label}`);
    for (const item of items) item.setAttribute('aria-checked', String(item.dataset.code === current));
  }

  function handleOutsidePointer(event) {
    if (!root.contains(event.target)) close();
  }

  function open() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    (items.find((item) => item.dataset.code === getLanguage()) ?? items[0]).focus();
  }

  function close({ restoreFocus = false } = {}) {
    if (!isOpen()) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', handleOutsidePointer, true);
    if (restoreFocus) trigger.focus();
  }

  function moveFocus(step) {
    const index = items.indexOf(document.activeElement);
    if (index === -1) {
      items[step > 0 ? 0 : items.length - 1].focus();
      return;
    }
    items[(index + step + items.length) % items.length].focus();
  }

  async function select(code) {
    close({ restoreFocus: true });
    try {
      await setLanguage(code);
    } catch (error) {
      console.error(error);
    }
  }

  trigger.addEventListener('click', () => (isOpen() ? close() : open()));

  trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!isOpen()) open();
  });

  menu.addEventListener('keydown', (event) => {
    const actions = {
      ArrowDown: () => moveFocus(1),
      ArrowUp: () => moveFocus(-1),
      Home: () => items[0].focus(),
      End: () => items[items.length - 1].focus(),
    };

    if (event.key === 'Tab') {
      close();
    } else if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close({ restoreFocus: true });
    }
  });

  onLanguageChange(sync);
  sync();

  return root;
}
