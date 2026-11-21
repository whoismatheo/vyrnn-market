import { el } from '../utils/dom.js';

function createMonogram(symbol, large) {
  return el('span', { class: large ? 'coin__logo coin__logo--fallback coin__logo--large' : 'coin__logo coin__logo--fallback', 'aria-hidden': 'true' }, symbol.slice(0, 1));
}

export function createCoinLogo(coin, { large = false } = {}) {
  if (!coin.image) return createMonogram(coin.symbol, large);

  const size = large ? 56 : 28;
  const image = el('img', {
    class: large ? 'coin__logo coin__logo--large' : 'coin__logo',
    src: coin.image,
    alt: '',
    width: size,
    height: size,
    loading: large ? 'eager' : 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  });
  image.addEventListener('error', () => image.replaceWith(createMonogram(coin.symbol, large)), { once: true });
  return image;
}

export function createCoinCell(coin, { meta = null } = {}) {
  return el(
    'a',
    { class: 'coin', href: `/coins/${encodeURIComponent(coin.id)}` },
    createCoinLogo(coin),
    el(
      'span',
      { class: 'coin__text' },
      el('span', { class: 'coin__name' }, coin.name),
      el('span', { class: 'coin__symbol' }, coin.symbol),
      meta?.length > 0
        ? el(
            'span',
            { class: 'coin__meta' },
            meta.flatMap((part, index) => [index > 0 ? ' \u00b7 ' : null, el('span', { class: 'coin__meta-part' }, part)]),
          )
        : null,
    ),
  );
}
