import { el } from '../utils/dom.js';
import { createIcon } from './icon.js';

export function createChoiceMenu({ name, label, getItems, getValue, onSelect, renderTrigger, className = '' }) {
  const menuId = `choice-menu-${name}`;
  const trigger = el('button', {
    class: 'choice-trigger',
    type: 'button',
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
    'aria-controls': menuId,
  });
  const menu = el('div', { id: menuId, class: 'choice-menu', role: 'menu', hidden: true });
  const root = el('div', { class: `choice ${className}`.trim(), 'data-menu': name }, trigger, menu);
  let items = [];

  const isOpen = () => !menu.hidden;
  const buttons = () => [...menu.querySelectorAll('.choice-item')];

  function sync() {
    items = getItems();
    const value = getValue();
    const selected = items.find((item) => item.value === value) ?? items[0];

    trigger.replaceChildren(...renderTrigger(selected), createIcon('chevron', { size: 14 }));
    trigger.setAttribute('aria-label', `${label()}: ${selected?.label ?? ''}`);
    menu.setAttribute('aria-label', label());
    menu.replaceChildren(
      ...items.map((item) =>
        el(
          'button',
          {
            class: 'choice-item',
            type: 'button',
            role: 'menuitemradio',
            'aria-checked': String(item.value === value),
            tabindex: '-1',
            lang: item.lang,
            'data-value': item.value,
            onclick: () => select(item.value),
          },
          el('span', {}, item.label),
          createIcon('check', { size: 16 }),
        ),
      ),
    );
  }

  function handleOutsidePointer(event) {
    if (!root.contains(event.target)) close();
  }

  function open() {
    if (items.length === 0) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', handleOutsidePointer, true);
    const list = buttons();
    (list.find((button) => button.dataset.value === getValue()) ?? list[0]).focus();
  }

  function close({ restoreFocus = false } = {}) {
    if (!isOpen()) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', handleOutsidePointer, true);
    if (restoreFocus) trigger.focus();
  }

  function moveFocus(step) {
    const list = buttons();
    const index = list.indexOf(document.activeElement);
    if (index === -1) list[step > 0 ? 0 : list.length - 1].focus();
    else list[(index + step + list.length) % list.length].focus();
  }

  async function select(value) {
    close({ restoreFocus: true });
    await onSelect(value);
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
      Home: () => buttons()[0].focus(),
      End: () => buttons().at(-1).focus(),
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

  sync();

  return { element: root, sync, destroy: () => document.removeEventListener('pointerdown', handleOutsidePointer, true) };
}
