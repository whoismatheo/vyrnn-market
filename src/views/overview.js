import { fetchHealth } from '../api/health.js';
import { createStatusList } from '../components/status-list.js';
import { getLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatDateTime } from '../utils/format.js';

function translateValue(prefix, value) {
  const key = `${prefix}.${value}`;
  const text = t(key);
  return text === key ? value : text;
}

function buildRows({ phase, health }) {
  const unavailable = t('overview.value.notAvailable');
  const ready = phase === 'ready';
  const checking = { value: t('overview.value.checking'), state: 'pending' };

  const api = {
    loading: checking,
    ready: { value: t('overview.value.operational'), state: 'on' },
    error: { value: t('overview.value.unreachable'), state: 'off' },
  }[phase];

  let provider = { value: unavailable, state: 'off' };
  if (phase === 'loading') provider = checking;
  if (ready && health.upstream?.reachable) provider = { value: t('overview.value.reachable'), state: 'on' };
  if (ready && !health.upstream?.reachable) provider = { value: t('overview.value.unreachable'), state: 'off' };

  return [
    { label: t('overview.status.api'), ...api },
    { label: t('overview.status.provider'), ...provider },
    { label: t('overview.status.plan'), value: ready ? translateValue('overview.plan', health.provider.plan) : unavailable },
    {
      label: t('overview.status.environment'),
      value: ready ? translateValue('overview.environment', health.environment) : unavailable,
    },
    { label: t('overview.status.build'), value: ready && health.commit ? health.commit : unavailable },
    {
      label: t('overview.status.checked'),
      value: ready ? formatDateTime(new Date(health.timestamp), getLanguage()) : unavailable,
    },
  ];
}

export default {
  mount(container) {
    let controller = null;
    let state = { phase: 'loading' };

    const refresh = el('button', { class: 'button button--quiet', type: 'button', onclick: load }, t('overview.refresh'));
    const body = el('div', { class: 'panel__body', 'aria-live': 'polite' });

    container.append(
      el(
        'section',
        { class: 'page' },
        el(
          'header',
          { class: 'page__header' },
          el('h1', { class: 'page__title' }, t('overview.title')),
          el('p', { class: 'page__lede' }, t('overview.description')),
        ),
        el(
          'div',
          { class: 'panel' },
          el('div', { class: 'panel__header' }, el('h2', { class: 'panel__title' }, t('overview.status.title')), refresh),
          body,
        ),
      ),
    );

    function render() {
      refresh.disabled = state.phase === 'loading';
      body.replaceChildren(createStatusList(buildRows(state)));
    }

    async function load() {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;

      state = { phase: 'loading' };
      render();

      try {
        state = { phase: 'ready', health: await fetchHealth({ signal, checkUpstream: true }) };
      } catch (error) {
        if (signal.aborted) return;
        console.error(error);
        state = { phase: 'error' };
      }
      render();
    }

    load();
    return () => controller?.abort();
  },
};
