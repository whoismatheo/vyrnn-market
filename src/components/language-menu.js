import { SUPPORTED_LANGUAGES, getLanguage, onLanguageChange, setLanguage, t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { createChoiceMenu } from './choice-menu.js';
import { createIcon } from './icon.js';

export function createLanguageMenu() {
  const menu = createChoiceMenu({
    name: 'language',
    label: () => t('shell.language'),
    getItems: () => SUPPORTED_LANGUAGES.map(({ code, label }) => ({ value: code, label, lang: code })),
    getValue: getLanguage,
    async onSelect(code) {
      try {
        await setLanguage(code);
      } catch (error) {
        console.error(error);
      }
    },
    renderTrigger: (item) => [createIcon('globe', { size: 16 }), el('span', { class: 'choice-trigger__short' }, item.value.toUpperCase()), el('span', { class: 'choice-trigger__long' }, item.label)],
  });

  onLanguageChange(menu.sync);
  return menu.element;
}
