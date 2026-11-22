import { svg } from '../utils/dom.js';

export function createSeriesSwatch(style) {
  return svg(
    'svg',
    { class: 'swatch', viewBox: '0 0 28 10', width: 28, height: 10, 'aria-hidden': 'true', focusable: 'false' },
    svg('path', { class: `swatch__line chart__line--${style}`, d: 'M2 5H26', fill: 'none' }),
  );
}
