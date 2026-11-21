import { ApiError } from './errors.js';

function invalid(name, expectation) {
  return ApiError.badRequest(`Query parameter "${name}" must be ${expectation}`, { parameter: name });
}

export function integer({ min, max, fallback, required = false }) {
  return {
    required,
    fallback,
    parse(raw, name) {
      if (!/^-?\d+$/.test(raw)) throw invalid(name, 'an integer');
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw invalid(name, `an integer between ${min} and ${max}`);
      }
      return value;
    },
  };
}

export function oneOf(values, { fallback, required = false } = {}) {
  return {
    required,
    fallback,
    parse(raw, name) {
      if (!values.includes(raw)) throw invalid(name, `one of: ${values.join(', ')}`);
      return raw;
    },
  };
}

export function identifier({ maxLength = 100, fallback, required = false } = {}) {
  return {
    required,
    fallback,
    parse(raw, name) {
      if (raw.length > maxLength || !/^[a-z0-9][a-z0-9._-]*$/.test(raw)) {
        throw invalid(name, `a lowercase identifier of at most ${maxLength} characters`);
      }
      return raw;
    },
  };
}

export function identifierList({ max, fallback, required = false }) {
  const pattern = /^[a-z0-9][a-z0-9._-]*$/;
  return {
    required,
    fallback,
    parse(raw, name) {
      const ids = [...new Set(raw.split(',').filter(Boolean))];
      if (ids.length === 0 || ids.length > max || ids.some((id) => id.length > 100 || !pattern.test(id))) {
        throw invalid(name, `a comma separated list of up to ${max} lowercase identifiers`);
      }
      return ids.sort();
    },
  };
}

export function validateQuery(query, schema) {
  const unknown = Object.keys(query).filter((name) => !Object.hasOwn(schema, name));
  if (unknown.length > 0) {
    throw ApiError.badRequest('Unknown query parameters', { parameters: unknown });
  }

  const result = {};
  for (const [name, rule] of Object.entries(schema)) {
    const raw = query[name];

    if (raw === undefined || raw === '') {
      if (rule.required) throw ApiError.badRequest(`Missing query parameter "${name}"`, { parameter: name });
      result[name] = rule.fallback;
      continue;
    }

    if (Array.isArray(raw)) throw invalid(name, 'provided only once');
    result[name] = rule.parse(String(raw), name);
  }
  return result;
}
