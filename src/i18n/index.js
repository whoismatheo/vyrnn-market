import { readStorage, writeStorage } from '../utils/storage.js';

export const SUPPORTED_LANGUAGES = Object.freeze([
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
]);

const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'vyrnn.language';
const TRANSLATED_ATTRIBUTES = ['aria-label', 'title'];

let language = DEFAULT_LANGUAGE;
let fallbackMessages = {};
let messages = {};
const listeners = new Set();

function isSupported(code) {
  return SUPPORTED_LANGUAGES.some((entry) => entry.code === code);
}

async function loadCatalog(code) {
  const response = await fetch(`/locales/${code}.json`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Unable to load locale "${code}" (${response.status})`);
  return response.json();
}

function lookup(catalog, key) {
  let node = catalog;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function detectLanguage() {
  const stored = readStorage(STORAGE_KEY);
  if (stored && isSupported(stored)) return stored;

  for (const candidate of navigator.languages ?? [navigator.language]) {
    const base = candidate?.split('-')[0]?.toLowerCase();
    if (base && isSupported(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

async function activate(code) {
  const catalog = code === DEFAULT_LANGUAGE ? fallbackMessages : await loadCatalog(code);
  messages = catalog;
  language = code;
  document.documentElement.lang = code;
}

export async function initI18n() {
  fallbackMessages = await loadCatalog(DEFAULT_LANGUAGE);
  const code = detectLanguage();

  try {
    await activate(code);
  } catch (error) {
    console.error(error);
    await activate(DEFAULT_LANGUAGE);
  }
}

export async function setLanguage(code) {
  if (!isSupported(code)) throw new Error(`Unsupported language "${code}"`);
  if (code === language) return;

  await activate(code);
  writeStorage(STORAGE_KEY, code);
  for (const listener of listeners) listener(code);
}

export function getLanguage() {
  return language;
}

export function onLanguageChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key, params = {}) {
  const template = lookup(messages, key) ?? lookup(fallbackMessages, key);
  if (template === undefined) return key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}

export function applyTranslations(root) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const attribute of TRANSLATED_ATTRIBUTES) {
    for (const node of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
    }
  }
}
