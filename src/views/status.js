import { fetchHealth } from '../api/health.js';
import { createPanel } from '../components/panel.js';
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
  const unavailable = t('status.value.notAvailable');
  const ready = phase === 'ready';
  const checking = { value: t('status.value.checking'), state: 'pending' };

  const api = {
    loading: checking,
    ready: { value: t('status.value.operational'), state: 'on' },
    error: { value: t('status.value.unreachable'), state: 'off' },
  }[phase];

  let provider = { value: unavailable, state: 'off' };
  if (phase === 'loading') provider = checking;
  if (ready && health.upstream?.reachable) provider = { value: t('status.value.reachable'), state: 'on' };
  if (ready && !health.upstream?.reachable) provider = { value: t('status.value.unreachable'), state: 'off' };

  return [
    { label: t('status.labels.api'), ...api },
    { label: t('status.labels.provider'), ...provider },
    { label: t('status.labels.plan'), value: ready ? translateValue('status.plan', health.provider.plan) : unavailable },
    { label: t('status.labels.environment'), value: ready ? translateValue('status.environment', health.environment) : unavailable },
    { label: t('status.labels.build'), value: ready && health.commit ? health.commit : unavailable },
    { label: t('status.labels.checked'), value: ready ? formatDateTime(new Date(health.timestamp), getLanguage()) : unavailable },
  ];
}

export default {
  mount(container) {
    let controller = null;
    let state = { phase: 'loading' };

    const refresh = el('button', { class: 'button button--quiet', type: 'button', onclick: load }, t('common.refresh'));
    const panel = createPanel({ title: t('status.panel'), actions: refresh });
    panel.body.setAttribute('aria-live', 'polite');

    container.append(
      el(
        'section',
        { class: 'page page--narrow' },
        el(
          'header',
          { class: 'page__header' },
          el('h1', { class: 'page__title' }, t('status.title')),
          el('p', { class: 'page__lede' }, t('status.description')),
        ),
        panel.element,
      ),
    );

    function render() {
      refresh.disabled = state.phase === 'loading';
      panel.body.replaceChildren(createStatusList(buildRows(state)));
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
