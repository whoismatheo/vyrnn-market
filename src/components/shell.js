import { matchRoute } from '../router.js';
import { el } from '../utils/dom.js';
import { createLanguageSelect } from './language-select.js';

export function createShell({ routes }) {
  const outlet = el('main', { id: 'main', class: 'app-main', tabindex: '-1' });
  const navigation = routes
    .filter((route) => route.navKey)
    .map((route) => ({ route, link: el('a', { class: 'nav-link', href: route.path, 'data-i18n': route.navKey }) }));

  const element = el(
    'div',
    { class: 'app' },
    el('a', { class: 'skip-link', href: '#main', 'data-i18n': 'shell.skipToContent' }),
    el(
      'header',
      { class: 'app-header' },
      el(
        'div',
        { class: 'container app-header__inner' },
        el(
          'a',
          { class: 'brand', href: '/', 'aria-label': 'vyrnn' },
          el('span', { class: 'brand__mark', 'aria-hidden': 'true' }),
          el('span', { class: 'brand__name' }, 'vyrnn'),
        ),
        el(
          'nav',
          { class: 'app-nav', 'data-i18n-aria-label': 'shell.navigation' },
          el('ul', { class: 'app-nav__list' }, navigation.map(({ link }) => el('li', {}, link))),
        ),
        el('div', { class: 'app-tools' }, createLanguageSelect()),
      ),
    ),
    outlet,
    el(
      'footer',
      { class: 'app-footer' },
      el(
        'div',
        { class: 'container app-footer__inner' },
        el(
          'p',
          {},
          el('span', { 'data-i18n': 'footer.dataBy' }),
          ' ',
          el('a', { href: 'https://www.coingecko.com/en/api', target: '_blank', rel: 'noopener noreferrer' }, 'CoinGecko'),
        ),
        el('p', { 'data-i18n': 'footer.disclaimer' }),
      ),
    ),
  );

  function setActive(pathname) {
    for (const { route, link } of navigation) {
      if (matchRoute([route], pathname)) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  return { element, outlet, setActive };
}
