import { fetchChart } from '../api/market.js';
import { getLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { formatChartTime, formatChartTooltipTime, formatCompactCurrency, formatPrice, percentChange } from '../utils/format.js';
import { createResource } from '../utils/resource.js';
import { createChangeBadge } from './change-badge.js';
import { createEmptyState, createSkeleton, renderResource } from './data-state.js';
import { createLineChart } from './line-chart.js';
import { createPanel } from './panel.js';
import { createSegmented } from './segmented.js';

const RANGES = ['1', '7', '30', '90', '365'];
const DEFAULT_RANGE = '7';

function createChartBlock(points, days, assetName) {
  const locale = getLanguage();
  if (points.length < 2) return createEmptyState({ message: t('chart.empty') });

  const first = points[0][1];
  const last = points[points.length - 1][1];
  const range = t(`chart.rangeNames.${days}`);

  return el(
    'div',
    { class: 'chart-block' },
    el(
      'div',
      { class: 'chart-summary' },
      el('span', { class: 'chart-summary__price' }, formatPrice(last, locale)),
      createChangeBadge(percentChange(first, last), locale),
      el('span', { class: 'chart-summary__range' }, range),
    ),
    createLineChart({
      points,
      label: t('chart.summary', { asset: assetName, range, from: formatPrice(first, locale), to: formatPrice(last, locale) }),
      formatAxisValue: (value) => formatCompactCurrency(value, locale),
      formatAxisTime: (time) => formatChartTime(time, Number(days), locale),
      formatTooltipValue: (value) => formatPrice(value, locale),
      formatTooltipTime: (time) => formatChartTooltipTime(time, Number(days), locale),
    }),
  );
}

export function createPriceChart({ assetId, assetName }) {
  let days = DEFAULT_RANGE;
  const region = el('div', { class: 'panel__region' });

  const resource = createResource(
    (signal) => fetchChart({ id: assetId, days, signal }),
    (state) =>
      renderResource(region, state, {
        skeleton: () => createSkeleton('chart'),
        ready: (data) => createChartBlock(data.points, days, assetName),
        onRetry: () => resource.load(),
      }),
  );

  const panel = createPanel({
    title: t('chart.title', { asset: assetName }),
    actions: createSegmented({
      label: t('chart.rangeLabel'),
      options: RANGES.map((value) => ({ value, label: t(`chart.ranges.${value}`) })),
      value: days,
      onChange: (value) => {
        days = value;
        resource.load();
      },
    }),
  });
  panel.body.append(region);

  return { element: panel.element, load: resource.load, abort: resource.abort };
}
