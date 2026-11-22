import { el, svg } from '../utils/dom.js';
import { nearestIndex } from '../utils/series.js';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 300;
const PADDING_RATIO = 0.08;
const GRID_LINES = 4;
const TIME_TICKS = 5;
const COVERAGE_RATIO = 1 / 60;

let chartCount = 0;

export function createLineChart({ series, area = false, zeroLine = false, label, formatAxisValue, formatAxisTime, renderTooltip }) {
  const timeLists = series.map(({ points }) => points.map(([time]) => time));
  const startTime = Math.min(...timeLists.map((times) => times[0]));
  const endTime = Math.max(...timeLists.map((times) => times[times.length - 1]));
  const timeSpan = endTime - startTime;
  const values = series.flatMap(({ points }) => points.map(([, value]) => value));
  const minValue = Math.min(...values, ...(zeroLine ? [0] : []));
  const maxValue = Math.max(...values, ...(zeroLine ? [0] : []));
  const span = maxValue - minValue || Math.abs(maxValue) * 0.02 || 1;
  const low = minValue - span * PADDING_RATIO;
  const high = maxValue + span * PADDING_RATIO;
  const primary = timeLists.reduce((best, times, index) => (times.length > timeLists[best].length ? index : best), 0);

  const toX = (time) => (timeSpan === 0 ? 0 : (time - startTime) / timeSpan);
  const toY = (value) => 1 - (value - low) / (high - low);

  const paths = series.map(({ points }) =>
    points.map(([time, value], index) => `${index === 0 ? 'M' : 'L'}${(toX(time) * VIEW_WIDTH).toFixed(1)} ${(toY(value) * VIEW_HEIGHT).toFixed(1)}`).join(' '),
  );

  const gradientId = `chart-fill-${++chartCount}`;
  const fractions = Array.from({ length: GRID_LINES }, (_, index) => (index + 0.5) / GRID_LINES);

  const graphic = svg(
    'svg',
    { class: 'chart__svg', viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
    area
      ? svg(
          'defs',
          {},
          svg(
            'linearGradient',
            { id: gradientId, x1: 0, y1: 0, x2: 0, y2: 1 },
            svg('stop', { offset: '0%', 'stop-color': 'currentColor', 'stop-opacity': 0.14 }),
            svg('stop', { offset: '100%', 'stop-color': 'currentColor', 'stop-opacity': 0 }),
          ),
        )
      : null,
    fractions.map((fraction) =>
      svg('line', { class: 'chart__grid', x1: 0, x2: VIEW_WIDTH, y1: fraction * VIEW_HEIGHT, y2: fraction * VIEW_HEIGHT, 'vector-effect': 'non-scaling-stroke' }),
    ),
    zeroLine
      ? svg('line', { class: 'chart__zero', x1: 0, x2: VIEW_WIDTH, y1: toY(0) * VIEW_HEIGHT, y2: toY(0) * VIEW_HEIGHT, 'vector-effect': 'non-scaling-stroke' })
      : null,
    area ? svg('path', { class: 'chart__area', d: `${paths[0]} L${VIEW_WIDTH} ${VIEW_HEIGHT} L0 ${VIEW_HEIGHT} Z`, fill: `url(#${gradientId})` }) : null,
    paths.map((d, index) =>
      svg('path', { class: `chart__line chart__line--${series[index].style ?? 0}`, d, fill: 'none', 'vector-effect': 'non-scaling-stroke' }),
    ),
  );

  const cursor = el('div', { class: 'chart__cursor', hidden: true });
  const dots = series.map(({ style }) => el('div', { class: `chart__dot chart__dot--${style ?? 0}`, hidden: true }));
  const tooltip = el('div', { class: 'chart__tooltip', hidden: true });

  const plot = el('div', { class: 'chart__plot', role: 'img', 'aria-label': label }, graphic, cursor, dots, tooltip);

  const axisValues = el(
    'div',
    { class: 'chart__axis-y', 'aria-hidden': 'true' },
    fractions.map((fraction) => {
      const labelNode = el('span', { class: 'chart__axis-label' }, formatAxisValue(high - fraction * (high - low)));
      labelNode.style.top = `${fraction * 100}%`;
      return labelNode;
    }),
  );

  const axisTimes = el(
    'div',
    { class: 'chart__axis-x', 'aria-hidden': 'true' },
    Array.from({ length: TIME_TICKS }, (_, index) => el('span', {}, formatAxisTime(startTime + (timeSpan * index) / (TIME_TICKS - 1)))),
  );

  function hide() {
    cursor.hidden = true;
    tooltip.hidden = true;
    for (const dot of dots) dot.hidden = true;
  }

  function show(clientX) {
    const rect = plot.getBoundingClientRect();
    if (rect.width === 0) return;

    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const snapTime = timeLists[primary][nearestIndex(timeLists[primary], startTime + ratio * timeSpan)];
    const tolerance = timeSpan * COVERAGE_RATIO;

    const entries = series.map((item, index) => {
      const times = timeLists[index];
      const covered = snapTime >= times[0] - tolerance && snapTime <= times[times.length - 1] + tolerance;
      return { series: item, point: covered ? item.points[nearestIndex(times, snapTime)] : null };
    });

    const x = toX(snapTime) * rect.width;
    cursor.hidden = false;
    tooltip.hidden = false;
    cursor.style.left = `${x}px`;

    entries.forEach(({ point }, index) => {
      dots[index].hidden = point === null;
      if (point === null) return;
      dots[index].style.left = `${toX(point[0]) * rect.width}px`;
      dots[index].style.top = `${toY(point[1]) * rect.height}px`;
    });

    tooltip.replaceChildren(...[].concat(renderTooltip({ time: snapTime, entries })));
    const left = Math.min(Math.max(0, x - tooltip.offsetWidth / 2), rect.width - tooltip.offsetWidth);
    tooltip.style.left = `${left}px`;
  }

  plot.addEventListener('pointermove', (event) => show(event.clientX));
  plot.addEventListener('pointerdown', (event) => show(event.clientX));
  plot.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') hide();
  });
  plot.addEventListener('pointercancel', hide);

  return el('div', { class: 'chart' }, plot, axisValues, axisTimes);
}
