export function compilePath(pattern) {
  const names = [];
  const source = pattern
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(':')) {
        names.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return { names, regex: new RegExp(`^/${source}/?$`) };
}

export function matchRoute(routes, pathname) {
  for (const route of routes) {
    const { names, regex } = compilePath(route.path);
    const result = regex.exec(pathname);
    if (!result) continue;

    try {
      const params = Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(result[index + 1])]));
      return { route, params };
    } catch {
      return null;
    }
  }
  return null;
}

function replaceUrl(target) {
  window.history.replaceState(window.history.state, '', target);
}

function setTitle(title) {
  document.title = title ? `${title} - vyrnn` : 'vyrnn';
}

export function createRouter({ routes, notFoundRoute, outlet, renderLoadError, onRouteChange }) {
  let current = null;
  let renderToken = 0;

  async function render({ resetScroll }) {
    const token = ++renderToken;
    const { pathname, search } = window.location;
    const match = matchRoute(routes, pathname);
    const route = match?.route ?? notFoundRoute;
    const params = match?.params ?? {};

    let view;
    try {
      view = (await route.load()).default;
    } catch (error) {
      if (token !== renderToken) return;
      console.error(error);
      current?.unmount?.();
      current = null;
      outlet.replaceChildren(renderLoadError());
      onRouteChange(route, pathname);
      return;
    }
    if (token !== renderToken) return;

    current?.unmount?.();
    outlet.replaceChildren();
    const unmount = view.mount(outlet, {
      params,
      query: new URLSearchParams(search),
      navigate,
      replace: replaceUrl,
      from: window.history.state?.from ?? null,
      setTitle,
    });
    current = { route, unmount };

    onRouteChange(route, pathname);
    if (resetScroll) {
      window.scrollTo(0, 0);
      outlet.focus({ preventScroll: true });
    }
  }

  function navigate(target) {
    const url = new URL(target, window.location.origin);
    if (url.pathname + url.search === window.location.pathname + window.location.search) return;
    window.history.pushState({ from: window.location.pathname + window.location.search }, '', url.pathname + url.search + url.hash);
    render({ resetScroll: true });
  }

  function handleClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;

    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
    if (url.pathname + url.search === window.location.pathname + window.location.search) return;

    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  }

  function start() {
    window.history.scrollRestoration = 'manual';
    document.addEventListener('click', handleClick);
    window.addEventListener('popstate', () => render({ resetScroll: true }));
    return render({ resetScroll: false });
  }

  return { start, navigate, refresh: () => render({ resetScroll: false }) };
}
