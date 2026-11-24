import { t } from '../i18n/index.js';
import { MAX_NAME_LENGTH } from '../state/saved-screens.js';
import { el } from '../utils/dom.js';

export function openNameDialog({ title, initial = '', confirm, validate }) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'dialog__input', type: 'text', maxlength: String(MAX_NAME_LENGTH), autocomplete: 'off', value: initial, 'aria-label': t('screener.saved.dialog.name') });
    const error = el('p', { class: 'dialog__error', role: 'alert', hidden: true });
    let result = null;

    const form = el(
      'form',
      {
        class: 'dialog__form',
        onsubmit: (event) => {
          event.preventDefault();
          const message = validate(input.value);
          if (message) {
            error.textContent = message;
            error.hidden = false;
            input.setAttribute('aria-invalid', 'true');
            input.focus();
            return;
          }
          result = input.value;
          dialog.close();
        },
      },
      el('h2', { class: 'dialog__title' }, title),
      el('label', { class: 'dialog__label' }, t('screener.saved.dialog.name'), input),
      error,
      el(
        'div',
        { class: 'dialog__actions' },
        el('button', { class: 'button button--quiet', type: 'button', onclick: () => dialog.close() }, t('screener.saved.dialog.cancel')),
        el('button', { class: 'button', type: 'submit' }, confirm),
      ),
    );

    const dialog = el('dialog', { class: 'dialog', 'aria-label': title }, form);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });

    document.body.append(dialog);
    dialog.showModal();
    input.select();
  });
}
