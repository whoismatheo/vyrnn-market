import { createShell } from './components/shell.js';
import { createStateMessage } from './components/state-message.js';
import { applyTranslations, initI18n, onLanguageChange, t } from './i18n/index.js';
import { createRouter } from './router.js';
import { notFoundRoute, routes } from './routes.js';

function updateDocumentTitle(route) {
  document.title = route.titleKey ? `${t(route.titleKey)} - vyrnn` : 'vyrnn';
}

async function bootstrap() {
  const root = document.getElementById('app');

  try {
    await initI18n();
  } catch (error) {
    console.error(error);
    root.textContent = 'vyrnn could not start. Reload the page to try again.';
    return;
  }

  const shell = createShell({ routes });
  root.replaceChildren(shell.element);
  applyTranslations(shell.element);

  let activeRoute = null;

  const router = createRouter({
    routes,
    notFoundRoute,
    outlet: shell.outlet,
    renderLoadError: () =>
      createStateMessage({
        title: t('error.loadView.title'),
        message: t('error.loadView.message'),
        action: { label: t('common.retry'), onClick: () => window.location.reload() },
      }),
    onRouteChange(route, pathname) {
      activeRoute = route;
      shell.setActive(pathname);
      updateDocumentTitle(route);
    },
  });

  onLanguageChange(() => {
    applyTranslations(shell.element);
    if (activeRoute) updateDocumentTitle(activeRoute);
    router.refresh();
  });

  await router.start();
}

bootstrap();
