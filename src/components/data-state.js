import { getLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatTime } from '../utils/format.js';

function errorMessageKey(error) {
  const code = error?.code ?? '';
  if (code === 'network' || code === 'timeout') return 'error.network';
  if (code === 'rate_limited' || code.startsWith('upstream_')) return 'error.provider';
  return 'error.generic';
}

export function createSkeleton(kind, count = 1) {
  return el(
    'div',
    { class: `skeleton-group skeleton-group--${kind}`, 'aria-hidden': 'true' },
    Array.from({ length: count }, () => el('div', { class: `skeleton skeleton--${kind}` })),
  );
}

function createInlineError({ error, onRetry }) {
  return el(
    'div',
    { class: 'inline-state', role: 'alert' },
    el('p', { class: 'inline-state__title' }, t('error.dataTitle')),
    el('p', { class: 'inline-state__text' }, t(errorMessageKey(error))),
    el('button', { class: 'button button--quiet', type: 'button', onclick: onRetry }, t('common.retry')),
  );
}

export function createEmptyState({ title, message, action }) {
  return el(
    'div',
    { class: 'inline-state' },
    title ? el('p', { class: 'inline-state__title' }, title) : null,
    el('p', { class: 'inline-state__text' }, message),
    action ? el('button', { class: 'button button--quiet', type: 'button', onclick: action.onClick }, action.label) : null,
  );
}

export function createStaleNote(meta) {
  if (!meta?.stale) return null;
  const time = formatTime(new Date(meta.updatedAt), getLanguage());
  return el('p', { class: 'stale-note', role: 'status' }, t('state.stale', { time }));
}

export function renderResource(container, state, { skeleton, ready, onRetry }) {
  container.setAttribute('aria-busy', String(state.phase === 'loading'));

  if (state.phase === 'loading') {
    container.replaceChildren(skeleton(), el('span', { class: 'sr-only' }, t('state.loading')));
  } else if (state.phase === 'error') {
    container.replaceChildren(createInlineError({ error: state.error, onRetry }));
  } else {
    container.replaceChildren(...[createStaleNote(state.meta), ready(state.data, state.meta)].filter(Boolean));
  }
}
