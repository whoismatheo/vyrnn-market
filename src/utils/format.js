export const NO_VALUE = '\u2013';

const formatters = new Map();

function formatter(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat(locale, options));
  return formatters.get(key);
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export function formatCompactCurrency(value, locale) {
  if (!isNumber(value)) return NO_VALUE;
  return formatter(locale, {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPrice(value, locale) {
  if (!isNumber(value)) return NO_VALUE;

  let digits = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (value < 0.01) digits = { minimumSignificantDigits: 4, maximumSignificantDigits: 4 };
  else if (value < 1) digits = { minimumFractionDigits: 2, maximumFractionDigits: 4 };

  return formatter(locale, { style: 'currency', currency: 'USD', ...digits }).format(value);
}

export function formatPercentChange(value, locale) {
  if (!isNumber(value)) return NO_VALUE;
  return formatter(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value / 100);
}

export function formatPercentShare(value, locale) {
  if (!isNumber(value)) return NO_VALUE;
  return formatter(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
}

export function formatInteger(value, locale) {
  if (!isNumber(value)) return NO_VALUE;
  return formatter(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatCompactNumber(value, locale) {
  if (!isNumber(value)) return NO_VALUE;
  return formatter(locale, { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
}

export function formatTime(date, locale) {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);
}

export function formatDateTime(date, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
}

export function formatChartTime(timestamp, days, locale) {
  const options =
    days <= 1
      ? { hour: 'numeric', minute: '2-digit' }
      : days <= 90
        ? { month: 'short', day: 'numeric' }
        : { month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(locale, options).format(timestamp);
}

export function formatChartTooltipTime(timestamp, days, locale) {
  const options =
    days <= 7
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' };
  return new Intl.DateTimeFormat(locale, options).format(timestamp);
}

export function percentChange(from, to) {
  if (!isNumber(from) || !isNumber(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}
