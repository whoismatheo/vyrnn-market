import { el } from '../utils/dom.js';

function createAction({ label, href, onClick }) {
  if (href) return el('a', { class: 'button', href }, label);
  return el('button', { class: 'button', type: 'button', onclick: onClick }, label);
}

export function createStateMessage({ title, message, action }) {
  return el(
    'section',
    { class: 'state-message' },
    el('h1', { class: 'state-message__title' }, title),
    el('p', { class: 'state-message__text' }, message),
    action ? createAction(action) : null,
  );
}
