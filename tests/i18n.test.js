import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGUAGES = ['en', 'es', 'pt', 'fr'];

const catalogs = Object.fromEntries(
  LANGUAGES.map((code) => [code, JSON.parse(readFileSync(path.join(root, 'public/locales', `${code}.json`), 'utf8'))]),
);

function flatten(node, prefix = '') {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : flatten(value, `${prefix}${key}.`),
  );
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.js') ? [full] : [];
  });
}

const english = new Map(flatten(catalogs.en));

test('every language defines exactly the same keys as English', () => {
  for (const code of LANGUAGES) {
    assert.deepEqual([...new Map(flatten(catalogs[code])).keys()].sort(), [...english.keys()].sort(), code);
  }
});

test('no translation is empty and placeholders match English', () => {
  const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join();
  for (const code of LANGUAGES) {
    for (const [key, value] of flatten(catalogs[code])) {
      assert.ok(value.trim().length > 0, `${code}:${key} is empty`);
      assert.equal(placeholders(value), placeholders(english.get(key)), `${code}:${key} placeholders`);
    }
  }
});

test('every translation key referenced in the source exists', () => {
  const pattern = /(?:\bt\(|[Kk]ey['"]?\s*:\s*|data-i18n(?:-[a-z-]+)?['"]?\s*:\s*)['"]([a-z][A-Za-z0-9_.]*)['"]/g;
  const missing = [];
  for (const file of sourceFiles(path.join(root, 'src'))) {
    for (const [, key] of readFileSync(file, 'utf8').matchAll(pattern)) {
      if (!english.has(key)) missing.push(`${path.relative(root, file)}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('dynamically resolved plan and environment keys exist', () => {
  for (const key of ['plan.public', 'plan.demo', 'plan.pro', 'environment.production', 'environment.preview', 'environment.development']) {
    assert.ok(english.has(`overview.${key}`), key);
  }
});
