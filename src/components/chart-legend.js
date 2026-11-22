import { t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatDate } from '../utils/format.js';
import { createChangeBadge } from './change-badge.js';
import { createSeriesSwatch } from './series-swatch.js';

function describeStatus(entry, locale) {
  if (entry.status === 'ok') return [createChangeBadge(entry.change, locale), entry.startsAt ? el('span', { class: 'legend__note' }, t('compare.chart.startsOn', { date: formatDate(entry.startsAt, locale) })) : null];
  if (entry.status === 'loading') return [el('span', { class: 'legend__note' }, t('state.loading'))];
  if (entry.status === 'empty') return [el('span', { class: 'legend__note' }, t('compare.chart.noHistory'))];
  return [
    el('span', { class: 'legend__note' }, t('compare.chart.unavailable')),
    el('button', { class: 'legend__retry', type: 'button', onclick: entry.onRetry }, t('common.retry')),
  ];
}

export function createChartLegend(entries, locale) {
  return el(
    'ul',
    { class: 'legend' },
    entries.map((entry) =>
      el(
        'li',
        { class: 'legend__item', 'data-status': entry.status },
        createSeriesSwatch(entry.style),
        el('span', { class: 'legend__name' }, entry.name, entry.symbol ? el('span', { class: 'legend__symbol' }, entry.symbol) : null),
        el('span', { class: 'legend__status' }, describeStatus(entry, locale)),
      ),
    ),
  );
}
