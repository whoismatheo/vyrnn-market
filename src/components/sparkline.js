import { svg } from '../utils/dom.js';

const WIDTH = 100;
const HEIGHT = 32;
const INSET = 2;

export function createSparkline(values) {
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const last = values.length - 1;

  const path = values
    .map((value, index) => {
      const x = (index / last) * WIDTH;
      const y = HEIGHT - INSET - ((value - min) / range) * (HEIGHT - INSET * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const direction = values[last] > values[0] ? 'up' : values[last] < values[0] ? 'down' : 'flat';

  return svg(
    'svg',
    {
      class: 'sparkline',
      viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
      preserveAspectRatio: 'none',
      'data-direction': direction,
      'aria-hidden': 'true',
      focusable: 'false',
    },
    svg('path', { d: path, fill: 'none', 'vector-effect': 'non-scaling-stroke' }),
  );
}
