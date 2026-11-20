import { formatPercentChange } from '../utils/format.js';
import { el } from '../utils/dom.js';

export function createChangeBadge(value, locale, { large = false } = {}) {
  const measured = typeof value === 'number' && Number.isFinite(value);
  const rounded = measured && Math.abs(value) < 0.005 ? 0 : value;
  const direction = !measured ? 'none' : rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';

  return el(
    'span',
    { class: large ? 'change change--large' : 'change', 'data-direction': direction },
    formatPercentChange(rounded, locale),
  );
}
