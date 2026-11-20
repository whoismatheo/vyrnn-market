import { el } from '../utils/dom.js';

export function createStatCard({ label, value, detail }) {
  return el(
    'article',
    { class: 'stat' },
    el('h3', { class: 'stat__label' }, label),
    el('p', { class: 'stat__value' }, value),
    detail ? el('p', { class: 'stat__detail' }, detail) : null,
  );
}
