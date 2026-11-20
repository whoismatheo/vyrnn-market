export function createResource(fetcher, onChange) {
  let controller = null;

  async function load() {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;

    onChange({ phase: 'loading' });
    try {
      const { data, meta } = await fetcher(signal);
      if (!signal.aborted) onChange({ phase: 'ready', data, meta });
    } catch (error) {
      if (signal.aborted) return;
      console.error(error);
      onChange({ phase: 'error', error });
    }
  }

  return { load, abort: () => controller?.abort() };
}
