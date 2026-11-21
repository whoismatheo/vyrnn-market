export const routes = [
  {
    path: '/',
    name: 'overview',
    titleKey: 'overview.title',
    navKey: 'nav.overview',
    icon: 'overview',
    load: () => import('./views/overview.js'),
  },
  {
    path: '/markets',
    name: 'markets',
    titleKey: 'markets.title',
    navKey: 'nav.markets',
    icon: 'markets',
    load: () => import('./views/markets.js'),
  },
  {
    path: '/watchlist',
    name: 'watchlist',
    titleKey: 'watchlist.title',
    navKey: 'nav.watchlist',
    icon: 'star',
    load: () => import('./views/watchlist.js'),
  },
  {
    path: '/coins/:id',
    name: 'coin',
    section: 'markets',
    titleKey: 'detail.title',
    load: () => import('./views/coin.js'),
  },
  {
    path: '/status',
    name: 'status',
    titleKey: 'status.title',
    load: () => import('./views/status.js'),
  },
];

export const notFoundRoute = {
  name: 'not-found',
  titleKey: 'notFound.title',
  load: () => import('./views/not-found.js'),
};
