import { el, svg } from '../utils/dom.js';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 300;
const PADDING_RATIO = 0.08;
const GRID_LINES = 4;
const TIME_TICKS = 5;

let chartCount = 0;

function nearestIndex(times, target) {
  let low = 0;
  let high = times.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (times[middle] < target) low = middle;
    else high = middle;
  }
  return target - times[low] <= times[high] - target ? low : high;
}

export function createLineChart({ points, label, formatAxisValue, formatAxisTime, formatTooltipValue, formatTooltipTime }) {
  const times = points.map(([time]) => time);
  const values = points.map(([, value]) => value);
  const startTime = times[0];
  const endTime = times[times.length - 1];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue || Math.abs(maxValue) * 0.02 || 1;
  const low = minValue - span * PADDING_RATIO;
  const high = maxValue + span * PADDING_RATIO;

  const toX = (time) => (endTime === startTime ? 0 : (time - startTime) / (endTime - startTime));
  const toY = (value) => 1 - (value - low) / (high - low);

  const line = points
    .map(([time, value], index) => `${index === 0 ? 'M' : 'L'}${(toX(time) * VIEW_WIDTH).toFixed(1)} ${(toY(value) * VIEW_HEIGHT).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${VIEW_WIDTH} ${VIEW_HEIGHT} L0 ${VIEW_HEIGHT} Z`;

  const gradientId = `chart-fill-${++chartCount}`;
  const fractions = Array.from({ length: GRID_LINES }, (_, index) => (index + 0.5) / GRID_LINES);

  const graphic = svg(
    'svg',
    { class: 'chart__svg', viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' },
    svg(
      'defs',
      {},
      svg(
        'linearGradient',
        { id: gradientId, x1: 0, y1: 0, x2: 0, y2: 1 },
        svg('stop', { offset: '0%', 'stop-color': 'currentColor', 'stop-opacity': 0.14 }),
        svg('stop', { offset: '100%', 'stop-color': 'currentColor', 'stop-opacity': 0 }),
      ),
    ),
    fractions.map((fraction) =>
      svg('line', { class: 'chart__grid', x1: 0, x2: VIEW_WIDTH, y1: fraction * VIEW_HEIGHT, y2: fraction * VIEW_HEIGHT, 'vector-effect': 'non-scaling-stroke' }),
    ),
    svg('path', { class: 'chart__area', d: area, fill: `url(#${gradientId})` }),
    svg('path', { class: 'chart__line', d: line, fill: 'none', 'vector-effect': 'non-scaling-stroke' }),
  );

  const cursor = el('div', { class: 'chart__cursor', hidden: true });
  const dot = el('div', { class: 'chart__dot', hidden: true });
  const tooltipValue = el('span', { class: 'chart__tooltip-value' });
  const tooltipTime = el('span', { class: 'chart__tooltip-time' });
  const tooltip = el('div', { class: 'chart__tooltip', hidden: true }, tooltipValue, tooltipTime);

  const plot = el('div', { class: 'chart__plot', role: 'img', 'aria-label': label }, graphic, cursor, dot, tooltip);

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
    Array.from({ length: TIME_TICKS }, (_, index) =>
      el('span', {}, formatAxisTime(startTime + ((endTime - startTime) * index) / (TIME_TICKS - 1))),
    ),
  );

  function hide() {
    cursor.hidden = true;
    dot.hidden = true;
    tooltip.hidden = true;
  }

  function show(clientX) {
    const rect = plot.getBoundingClientRect();
    if (rect.width === 0) return;

    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const index = nearestIndex(times, startTime + ratio * (endTime - startTime));
    const x = toX(times[index]) * rect.width;

    cursor.hidden = false;
    dot.hidden = false;
    tooltip.hidden = false;
    cursor.style.left = `${x}px`;
    dot.style.left = `${x}px`;
    dot.style.top = `${toY(values[index]) * rect.height}px`;

    tooltipValue.textContent = formatTooltipValue(values[index]);
    tooltipTime.textContent = formatTooltipTime(times[index]);
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
