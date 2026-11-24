import { t } from '../i18n/index.js';
import { MAX_NAME_LENGTH, savedScreens } from '../state/saved-screens.js';
import { el } from '../utils/dom.js';
import { activeFilters, parseScreener } from '../utils/screener-state.js';
import { openNameDialog } from './name-dialog.js';
import { createPanel } from './panel.js';
import { showToast } from './toast.js';

function validateName(rawName, ignoreId = null) {
  const name = rawName.replace(/\s+/g, ' ').trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH || /\p{C}/u.test(name)) return t('screener.saved.dialog.invalid', { max: MAX_NAME_LENGTH });
  const taken = savedScreens.list().some((item) => item.id !== ignoreId && item.name.toLowerCase() === name.toLowerCase());
  return taken ? t('screener.saved.dialog.duplicate') : null;
}

function reportStorage(result) {
  if (result.persisted === false) showToast(t('screener.saved.toast.notSaved'));
}

export function createSavedScreensPanel({ getSearch, onApply }) {
  const list = el('div', { class: 'saved-list' });
  const saveButton = el('button', { class: 'button button--quiet', type: 'button', onclick: save }, t('screener.saved.save'));
  const panel = createPanel({ title: t('screener.saved.title'), actions: saveButton });
  panel.body.append(list);

  async function save() {
    if (activeFilters(parseScreener(getSearch())).length === 0) {
      showToast(t('screener.saved.nothing'));
      return;
    }
    if (savedScreens.list().length >= savedScreens.max) {
      showToast(t('screener.saved.dialog.full', { max: savedScreens.max }));
      return;
    }

    const name = await openNameDialog({ title: t('screener.saved.dialog.saveTitle'), confirm: t('screener.saved.dialog.confirm'), validate: (value) => validateName(value) });
    if (name === null) return;
    const result = savedScreens.save(name, getSearch());
    if (result.ok) {
      showToast(t('screener.saved.toast.saved', { name: result.item.name }));
      reportStorage(result);
    }
  }

  async function rename(item) {
    const name = await openNameDialog({ title: t('screener.saved.dialog.renameTitle'), initial: item.name, confirm: t('screener.saved.dialog.confirm'), validate: (value) => validateName(value, item.id) });
    if (name === null) return;
    const result = savedScreens.rename(item.id, name);
    if (result.ok) {
      showToast(t('screener.saved.toast.renamed', { name: name.replace(/\s+/g, ' ').trim() }));
      reportStorage(result);
    }
  }

  function remove(item) {
    const result = savedScreens.remove(item.id);
    if (result.ok) {
      showToast(t('screener.saved.toast.deleted', { name: item.name }));
      reportStorage(result);
    }
  }

  function render(items) {
    if (items.length === 0) {
      list.replaceChildren(el('p', { class: 'inline-state__text' }, t('screener.saved.empty')));
      return;
    }

    list.replaceChildren(
      el(
        'ul',
        { class: 'saved-list__items' },
        items.map((item) =>
          el(
            'li',
            { class: 'saved-item' },
            el('div', { class: 'saved-item__text' }, el('span', { class: 'saved-item__name' }, item.name), el('span', { class: 'saved-item__summary' }, t('screener.saved.summary', { count: activeFilters(parseScreener(item.search)).length }))),
            el(
              'div',
              { class: 'saved-item__actions' },
              el('button', { class: 'button button--quiet', type: 'button', 'aria-label': t('screener.saved.applyNamed', { name: item.name }), onclick: () => onApply(item.search) }, t('screener.saved.apply')),
              el('button', { class: 'button button--quiet', type: 'button', 'aria-label': t('screener.saved.renameNamed', { name: item.name }), onclick: () => rename(item) }, t('screener.saved.rename')),
              el('button', { class: 'button button--quiet', type: 'button', 'aria-label': t('screener.saved.deleteNamed', { name: item.name }), onclick: () => remove(item) }, t('screener.saved.delete')),
            ),
          ),
        ),
      ),
    );
  }

  render(savedScreens.list());
  const unsubscribe = savedScreens.subscribe(render);

  return { element: panel.element, save, destroy: unsubscribe };
}
