import { el } from '../utils/dom.js';

export function createStatusList(rows) {
  return el(
    'dl',
    { class: 'status-list' },
    rows.map(({ label, value, state }) =>
      el(
        'div',
        { class: 'status-list__row' },
        el('dt', { class: 'status-list__label' }, label),
        el(
          'dd',
          { class: 'status-list__value' },
          state ? el('span', { class: 'status-dot', 'data-state': state, 'aria-hidden': 'true' }) : null,
          el('span', {}, value),
        ),
      ),
    ),
  );
}
