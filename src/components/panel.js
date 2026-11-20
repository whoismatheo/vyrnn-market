import { el } from '../utils/dom.js';

export function createPanel({ title, description, actions, flush = false }) {
  const body = el('div', { class: 'panel__body' });
  const header = title
    ? el(
        'header',
        { class: 'panel__header' },
        el(
          'div',
          { class: 'panel__heading' },
          el('h2', { class: 'panel__title' }, title),
          description ? el('p', { class: 'panel__description' }, description) : null,
        ),
        actions ?? null,
      )
    : null;

  const element = el('section', { class: flush ? 'panel panel--flush' : 'panel' }, header, body);
  return { element, body };
}
