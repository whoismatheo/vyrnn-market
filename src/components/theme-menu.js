import { themeController } from '../state/theme.js';
import { t } from '../i18n/index.js';
import { el } from '../utils/dom.js';
import { createChoiceMenu } from './choice-menu.js';
import { createIcon } from './icon.js';

const ICONS = { light: 'sun', dark: 'moon', system: 'monitor' };

export function createThemeMenu() {
  const menu = createChoiceMenu({
    name: 'theme',
    label: () => t('theme.label'),
    getItems: () => ['light', 'dark', 'system'].map((value) => ({ value, label: t(`theme.${value}`) })),
    getValue: themeController.getPreference,
    onSelect: (value) => themeController.setPreference(value),
    renderTrigger: (item) => [createIcon(ICONS[item.value], { size: 16 }), el('span', { class: 'choice-trigger__long' }, item.label)],
  });

  themeController.subscribe(menu.sync);
  return menu.element;
}
