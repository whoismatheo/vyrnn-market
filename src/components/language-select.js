import { SUPPORTED_LANGUAGES, getLanguage, onLanguageChange, setLanguage } from '../i18n/index.js';
import { el } from '../utils/dom.js';

export function createLanguageSelect() {
  const select = el(
    'select',
    { id: 'language-select', class: 'select', onchange: handleChange },
    SUPPORTED_LANGUAGES.map(({ code, label }) => el('option', { value: code, lang: code }, label)),
  );
  select.value = getLanguage();

  async function handleChange() {
    try {
      await setLanguage(select.value);
    } catch (error) {
      console.error(error);
      select.value = getLanguage();
    }
  }

  onLanguageChange((code) => {
    select.value = code;
  });

  return el(
    'div',
    { class: 'language-select' },
    el('label', { class: 'sr-only', for: 'language-select', 'data-i18n': 'shell.language' }),
    select,
  );
}
