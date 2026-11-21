import { el } from '../utils/dom.js';

const VISIBLE_MS = 4000;

let toast = null;
let timer = null;

export function showToast(message) {
  if (!toast) {
    toast = el('div', { class: 'toast', role: 'status', hidden: true });
    document.body.append(toast);
  }

  clearTimeout(timer);
  requestAnimationFrame(() => {
    toast.textContent = message;
    toast.hidden = false;
    timer = setTimeout(() => {
      toast.hidden = true;
    }, VISIBLE_MS);
  });
}
