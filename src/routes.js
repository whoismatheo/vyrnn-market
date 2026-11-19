export const routes = [
  {
    path: '/',
    name: 'overview',
    titleKey: 'overview.title',
    navKey: 'nav.overview',
    load: () => import('./views/overview.js'),
  },
];

export const notFoundRoute = {
  name: 'not-found',
  titleKey: 'notFound.title',
  load: () => import('./views/not-found.js'),
};
