import { el } from '../utils/dom.js';

function createMonogram(symbol) {
  return el('span', { class: 'coin__logo coin__logo--fallback', 'aria-hidden': 'true' }, symbol.slice(0, 1));
}

function createLogo(coin) {
  if (!coin.image) return createMonogram(coin.symbol);

  const image = el('img', {
    class: 'coin__logo',
    src: coin.image,
    alt: '',
    width: 28,
    height: 28,
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  });
  image.addEventListener('error', () => image.replaceWith(createMonogram(coin.symbol)), { once: true });
  return image;
}

export function createCoinCell(coin) {
  return el(
    'span',
    { class: 'coin' },
    createLogo(coin),
    el('span', { class: 'coin__text' }, el('span', { class: 'coin__name' }, coin.name), el('span', { class: 'coin__symbol' }, coin.symbol)),
  );
}
