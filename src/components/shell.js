import { matchRoute } from '../router.js';
import { el } from '../utils/dom.js';
import { createIcon } from './icon.js';
import { createLanguageMenu } from './language-menu.js';

function createBrand(className) {
  return el(
    'a',
    { class: `brand ${className}`, href: '/', 'aria-label': 'vyrnn' },
    el('span', { class: 'brand__mark', 'aria-hidden': 'true' }),
    el('span', { class: 'brand__name' }, 'vyrnn'),
  );
}

export function createShell({ routes }) {
  const outlet = el('main', { id: 'main', class: 'app-main', tabindex: '-1' });
  const navigation = routes
    .filter((route) => route.navKey)
    .map((route) => ({
      route,
      link: el('a', { class: 'nav-link', href: route.path }, createIcon(route.icon, { size: 20 }), el('span', { 'data-i18n': route.navKey })),
    }));

  const element = el(
    'div',
    { class: 'app' },
    el('a', { class: 'skip-link', href: '#main', 'data-i18n': 'shell.skipToContent' }),
    el(
      'aside',
      { class: 'sidebar' },
      createBrand('brand--sidebar'),
      el(
        'nav',
        { class: 'nav', 'data-i18n-aria-label': 'shell.navigation' },
        el('ul', { class: 'nav__list' }, navigation.map(({ link }) => el('li', {}, link))),
      ),
    ),
    el(
      'div',
      { class: 'app-body' },
      el('header', { class: 'topbar' }, createBrand('brand--topbar'), el('div', { class: 'topbar__tools' }, createLanguageMenu())),
      outlet,
      el(
        'footer',
        { class: 'app-footer' },
        el(
          'p',
          {},
          el('span', { 'data-i18n': 'footer.dataBy' }),
          ' ',
          el('a', { href: 'https://www.coingecko.com/en/api', target: '_blank', rel: 'noopener noreferrer' }, 'CoinGecko'),
        ),
        el('a', { class: 'footer-link', href: '/status', 'data-i18n': 'footer.status' }),
        el('p', { 'data-i18n': 'footer.disclaimer' }),
      ),
    ),
  );

  function setActive(pathname) {
    const current = matchRoute(routes, pathname)?.route;
    const section = current?.section ?? current?.name;
    for (const { route, link } of navigation) {
      if (route.name === section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  return { element, outlet, setActive };
}
