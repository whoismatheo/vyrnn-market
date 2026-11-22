import { fetchChart, fetchMarkets } from '../api/market.js';
import { createAssetPicker } from '../components/asset-picker.js';
import { createChangeBadge } from '../components/change-badge.js';
import { createChartLegend } from '../components/chart-legend.js';
import { createCompareAsset } from '../components/compare-asset.js';
import { createEmptyState, createSkeleton, createStaleNote } from '../components/data-state.js';
import { createIcon } from '../components/icon.js';
import { createLineChart } from '../components/line-chart.js';
import { createPanel } from '../components/panel.js';
import { createSegmented } from '../components/segmented.js';
import { createSeriesSwatch } from '../components/series-swatch.js';
import { showToast } from '../components/toast.js';
import { getLanguage, t } from '../i18n/index.js';
import { MAX_ASSETS, MIN_ASSETS, buildComparisonUrl, parseComparison } from '../utils/compare-state.js';
import { el } from '../utils/dom.js';
import { NO_VALUE, formatChartTime, formatChartTooltipTime, formatPercentAxis, formatPercentChange, formatPrice } from '../utils/format.js';
import { normalizePerformance, periodChange, startsLate } from '../utils/performance.js';
import { CHART_RANGES } from '../utils/ranges.js';

const MS_PER_DAY = 86_400_000;
const STYLE_SLOTS = [0, 1, 2, 3];

function chartKey(id, range) {
  return `${id}|${range}`;
}

export default {
  mount(container, { query, replace }) {
    const initial = parseComparison(query);
    let ids = initial.ids;
    let range = initial.range;

    const slots = new Map();
    const identities = new Map();
    const markets = new Map();
    const charts = new Map();
    const controller = new AbortController();
    const { signal } = controller;

    function assignSlot(id) {
      const used = new Set(slots.values());
      slots.set(id, STYLE_SLOTS.find((slot) => !used.has(slot)));
    }
    ids.forEach(assignSlot);

    const identityOf = (id) => identities.get(id) ?? { id, name: id, symbol: '', image: null };

    async function loadMarkets(wanted) {
      const pending = wanted.filter((id) => !markets.has(id) || markets.get(id).phase === 'error');
      if (pending.length === 0) return;

      for (const id of pending) markets.set(id, { phase: 'loading' });
      renderAll();
      try {
        const { data, meta } = await fetchMarkets({ ids: pending, signal });
        const found = new Map(data.coins.map((coin) => [coin.id, coin]));
        for (const id of pending) markets.set(id, found.has(id) ? { phase: 'ready', coin: found.get(id), meta } : { phase: 'missing' });
      } catch (error) {
        if (signal.aborted) return;
        console.error(error);
        for (const id of pending) markets.set(id, { phase: 'error', error });
      }
      renderAll();
    }

    async function loadChart(id) {
      const requestedRange = range;
      const key = chartKey(id, requestedRange);
      if (charts.has(key) && charts.get(key).phase !== 'error') return;

      charts.set(key, { phase: 'loading' });
      renderAll();
      try {
        const { data, meta } = await fetchChart({ id, days: requestedRange, signal });
        charts.set(key, { phase: 'ready', points: data.points, meta });
      } catch (error) {
        if (signal.aborted) return;
        console.error(error);
        charts.set(key, { phase: 'error', error });
      }
      renderAll();
    }

    function ensureData() {
      loadMarkets(ids);
      if (ids.length >= MIN_ASSETS) ids.forEach(loadChart);
    }

    function commit() {
      replace(buildComparisonUrl({ ids, range }));
      picker.update();
      ensureData();
      renderAll();
    }

    function addAsset(coin) {
      if (ids.includes(coin.id) || ids.length >= MAX_ASSETS) return;
      identities.set(coin.id, { id: coin.id, name: coin.name, symbol: coin.symbol, image: coin.image });
      ids = [...ids, coin.id];
      assignSlot(coin.id);
      commit();
    }

    function removeAsset(id) {
      ids = ids.filter((selected) => selected !== id);
      slots.delete(id);
      commit();
      if (!picker.input.disabled) picker.input.focus();
    }

    async function copyLink() {
      try {
        await navigator.clipboard.writeText(new URL(buildComparisonUrl({ ids, range }), window.location.origin).href);
        showToast(t('compare.share.copied'));
      } catch (error) {
        console.error(error);
        showToast(t('compare.share.failed'));
      }
    }

    const picker = createAssetPicker({ max: MAX_ASSETS, getSelected: () => ids, onSelect: addAsset });
    const countLabel = el('p', { class: 'compare-count' });
    const staleRegion = el('div', { class: 'compare-stale' });
    const assetsRegion = el('div', { class: 'compare-assets' });
    const chartRegion = el('div', { class: 'panel__region' });
    const shareButton = el('button', { class: 'button button--quiet button--icon', type: 'button', hidden: true, onclick: copyLink }, createIcon('link', { size: 16 }), t('compare.share.copy'));

    const chartPanel = createPanel({
      title: t('compare.chart.title'),
      description: t('compare.chart.description'),
      actions: createSegmented({
        label: t('chart.rangeLabel'),
        options: CHART_RANGES.map((value) => ({ value, label: t(`chart.ranges.${value}`) })),
        value: range,
        onChange: (value) => {
          range = value;
          commit();
        },
      }),
    });
    chartPanel.body.append(chartRegion);

    function renderAssets() {
      countLabel.textContent = t('compare.status.count', { count: ids.length, max: MAX_ASSETS });
      if (ids.length === 0) {
        assetsRegion.replaceChildren(createEmptyState({ title: t('compare.empty.title'), message: t('compare.empty.message', { min: MIN_ASSETS }) }));
        return;
      }

      const locale = getLanguage();
      const cards = ids.map((id) =>
        createCompareAsset(
          { identity: identityOf(id), market: markets.get(id) ?? { phase: 'loading' }, style: slots.get(id), onRemove: () => removeAsset(id), onRetry: () => loadMarkets([id]) },
          locale,
        ),
      );
      assetsRegion.replaceChildren(
        ...[el('div', { class: 'compare-grid', 'data-count': ids.length }, cards), ids.length < MIN_ASSETS ? el('p', { class: 'compare-hint' }, t('compare.needMore')) : null].filter(Boolean),
      );
    }

    function chartEntries() {
      return ids.map((id) => {
        const market = markets.get(id);
        const identity = market?.phase === 'ready' ? market.coin : identityOf(id);
        const state = charts.get(chartKey(id, range));
        const performance = state?.phase === 'ready' ? normalizePerformance(state.points) : [];

        let status = 'loading';
        if (state?.phase === 'error') status = 'error';
        else if (state?.phase === 'ready') status = performance.length >= 2 ? 'ok' : 'empty';

        return {
          id,
          name: identity.name,
          symbol: identity.symbol,
          style: slots.get(id),
          status,
          performance,
          change: periodChange(performance),
          startsAt: null,
          onRetry: () => loadChart(id),
        };
      });
    }

    function createChartBlock(entries, plottable) {
      const locale = getLanguage();
      const days = Number(range);
      const rangeEnd = Math.max(...plottable.map(({ performance }) => performance[performance.length - 1][0]));
      for (const entry of plottable) {
        if (startsLate(entry.performance, rangeEnd - days * MS_PER_DAY, rangeEnd)) entry.startsAt = new Date(entry.performance[0][0]).toISOString();
      }
      const byId = new Map(plottable.map((entry) => [entry.id, entry]));
      const settled = entries.every(({ status }) => status !== 'loading');

      return el(
        'div',
        { class: 'chart-block' },
        settled && plottable.length < entries.length
          ? el('p', { class: 'compare-hint' }, t('compare.chart.partial', { shown: plottable.length, total: entries.length }))
          : null,
        createLineChart({
          series: plottable.map(({ id, style, performance }) => ({ id, style, points: performance })),
          zeroLine: true,
          label: t('compare.chart.summary', {
            range: t(`chart.rangeNames.${range}`),
            items: plottable.map(({ name, change }) => `${name} ${formatPercentChange(change, locale)}`).join('; '),
          }),
          formatAxisValue: (value) => formatPercentAxis(value, locale),
          formatAxisTime: (time) => formatChartTime(time, days, locale),
          renderTooltip: ({ time, entries: hovered }) => [
            el('span', { class: 'chart__tooltip-time' }, formatChartTooltipTime(time, days, locale)),
            ...hovered.map(({ series, point }) =>
              el(
                'span',
                { class: 'chart__tooltip-row' },
                createSeriesSwatch(series.style),
                el('span', { class: 'chart__tooltip-name' }, byId.get(series.id).symbol || byId.get(series.id).name),
                point === null ? el('span', { class: 'chart__tooltip-price' }, NO_VALUE) : [createChangeBadge(point[1], locale), el('span', { class: 'chart__tooltip-price' }, formatPrice(point[2], locale))],
              ),
            ),
          ],
        }),
        createChartLegend(entries, locale),
      );
    }

    function renderChart() {
      const entries = chartEntries();
      const plottable = entries.filter(({ status }) => status === 'ok');
      const loading = entries.some(({ status }) => status === 'loading');

      if (plottable.length === 0 && loading) {
        chartRegion.setAttribute('aria-busy', 'true');
        chartRegion.replaceChildren(createSkeleton('chart'), el('span', { class: 'sr-only' }, t('state.loading')));
        return;
      }

      chartRegion.setAttribute('aria-busy', 'false');
      if (plottable.length === 0) {
        const failed = entries.some(({ status }) => status === 'error');
        chartRegion.replaceChildren(
          failed
            ? createEmptyState({ title: t('error.dataTitle'), message: t('error.provider'), action: { label: t('common.retry'), onClick: () => ids.forEach(loadChart) } })
            : createEmptyState({ message: t('compare.chart.empty') }),
        );
        return;
      }
      chartRegion.replaceChildren(createChartBlock(entries, plottable));
    }

    function renderStale() {
      const metas = [
        ...ids.map((id) => markets.get(id)?.meta),
        ...(ids.length >= MIN_ASSETS ? ids.map((id) => charts.get(chartKey(id, range))?.meta) : []),
      ].filter((meta) => meta?.stale);
      const oldest = metas.length > 0 ? metas.reduce((a, b) => (a.updatedAt < b.updatedAt ? a : b)) : null;
      staleRegion.replaceChildren(...[oldest ? createStaleNote(oldest) : null].filter(Boolean));
    }

    function renderAll() {
      const comparing = ids.length >= MIN_ASSETS;
      shareButton.hidden = !comparing;
      chartPanel.element.hidden = !comparing;
      renderAssets();
      renderStale();
      if (comparing) renderChart();
    }

    container.append(
      el(
        'section',
        { class: 'page' },
        el(
          'header',
          { class: 'page__header page__header--split' },
          el('div', { class: 'page__heading' }, el('h1', { class: 'page__title' }, t('compare.title')), el('p', { class: 'page__lede' }, t('compare.description'))),
          el('div', { class: 'page__toolbar' }, shareButton),
        ),
        el('div', { class: 'compare-controls' }, countLabel, picker.element),
        staleRegion,
        assetsRegion,
        chartPanel.element,
      ),
    );

    const canonical = buildComparisonUrl({ ids, range });
    if (canonical !== window.location.pathname + window.location.search) replace(canonical);

    ensureData();
    renderAll();

    return () => {
      controller.abort();
      picker.destroy();
    };
  },
};
