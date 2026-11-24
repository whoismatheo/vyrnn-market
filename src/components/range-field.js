import { t } from '../i18n/index.js';
import { RANGE_FIELDS, parseAmount, plainNumber } from '../utils/screener-state.js';
import { el } from '../utils/dom.js';

export function createRangeField({ key, value, onInput }) {
  const field = RANGE_FIELDS[key];
  const label = t(`screener.ranges.${key}`);

  const createInput = (side, initial) =>
    el('input', {
      class: 'field__input',
      type: 'text',
      inputmode: field.integer ? 'numeric' : 'decimal',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      maxlength: '24',
      placeholder: t(`screener.${side}`),
      'aria-label': `${label}: ${t(`screener.${side}`)}`,
      value: initial === undefined ? '' : plainNumber(initial),
      oninput: () => onInput(read()),
    });

  const min = createInput('min', value?.min);
  const max = createInput('max', value?.max);
  const error = el('p', { class: 'field__error', role: 'alert', hidden: true });

  function read() {
    const parsed = {};
    let message = null;

    for (const [side, input] of [['min', min], ['max', max]]) {
      const text = input.value.trim();
      const amount = text === '' ? undefined : parseAmount(text, field);
      const invalid = text !== '' && amount === null;
      input.setAttribute('aria-invalid', String(invalid));
      if (invalid) message = t('screener.invalid');
      else if (amount !== undefined) parsed[side] = amount;
    }

    if (!message && parsed.min !== undefined && parsed.max !== undefined && parsed.min > parsed.max) message = t('screener.inverted');
    error.textContent = message ?? '';
    error.hidden = message === null;
    return { range: message ? null : parsed, error: message };
  }

  return el('fieldset', { class: 'field' }, el('legend', { class: 'field__label' }, label), el('div', { class: 'field__pair' }, min, max), error);
}
