import { svg } from '../utils/dom.js';

const ICONS = {
  overview: [
    ['rect', { x: 3, y: 3, width: 7, height: 9, rx: 1.5 }],
    ['rect', { x: 14, y: 3, width: 7, height: 5, rx: 1.5 }],
    ['rect', { x: 14, y: 12, width: 7, height: 9, rx: 1.5 }],
    ['rect', { x: 3, y: 16, width: 7, height: 5, rx: 1.5 }],
  ],
  markets: [
    ['path', { d: 'M3 3v16a2 2 0 0 0 2 2h16' }],
    ['path', { d: 'M8 16v-5' }],
    ['path', { d: 'M13 16V8' }],
    ['path', { d: 'M18 16v-3' }],
  ],
  globe: [
    ['circle', { cx: 12, cy: 12, r: 9.5 }],
    ['path', { d: 'M2.5 12h19' }],
    ['path', { d: 'M12 2.5c2.6 2.7 4 6 4 9.5s-1.4 6.8-4 9.5c-2.6-2.7-4-6-4-9.5s1.4-6.8 4-9.5z' }],
  ],
  star: [['path', { d: 'm12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.1l-5.7 3.2 1.2-6.4L2.8 9.5l6.4-.8z' }]],
  back: [['path', { d: 'M19 12H5' }], ['path', { d: 'm12 19-7-7 7-7' }]],
  compare: [['path', { d: 'm3 17 5-5 4 4 8-8' }], ['path', { d: 'm3 8 5 5 4-4 8 8' }]],
  link: [['path', { d: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7' }], ['path', { d: 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7' }]],
  search: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'm21 21-4.3-4.3' }]],
  close: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]],
  screener: [['path', { d: 'M3 5h18l-7 8.5V20l-4-2v-4.5z' }]],
  sun: [
    ['circle', { cx: 12, cy: 12, r: 4 }],
    ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }],
  ],
  moon: [['path', { d: 'M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.7 6.7 0 0 0 10.7 10.7z' }]],
  monitor: [['rect', { x: 2.5, y: 3.5, width: 19, height: 13, rx: 2 }], ['path', { d: 'M8 20.5h8M12 16.5v4' }]],
  chevron: [['path', { d: 'm6 9 6 6 6-6' }]],
  check: [['path', { d: 'M20 6 9 17l-5-5' }]],
  refresh: [
    ['path', { d: 'M3 12a9 9 0 0 1 15.4-6.4L21 8' }],
    ['path', { d: 'M21 3v5h-5' }],
    ['path', { d: 'M21 12a9 9 0 0 1-15.4 6.4L3 16' }],
    ['path', { d: 'M3 21v-5h5' }],
  ],
};

export function createIcon(name, { size = 18 } = {}) {
  return svg(
    'svg',
    {
      class: 'icon',
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.75,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ICONS[name].map(([tag, attributes]) => svg(tag, attributes)),
  );
}
