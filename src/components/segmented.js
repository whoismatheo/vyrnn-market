import { el } from '../utils/dom.js';

export function createSegmented({ label, options, value, onChange }) {
  let current = String(value);

  const buttons = options.map((option) =>
    el(
      'button',
      {
        class: 'segmented__button',
        type: 'button',
        'data-value': String(option.value),
        'aria-pressed': String(String(option.value) === current),
        onclick: () => select(String(option.value)),
      },
      option.label,
    ),
  );

  function select(next) {
    if (next === current) return;
    current = next;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.value === next));
    onChange(next);
  }

  return el('div', { class: 'segmented', role: 'group', 'aria-label': label }, buttons);
}
