#!/usr/bin/env node
// Validate demo/atidim-data.json against schemas/atidim-board.schema.json.
// Local check only — no GitHub Actions, no paid services.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const schemaPath = path.join(root, 'schemas', 'atidim-board.schema.json');
const dataPath = path.join(root, 'demo', 'atidim-data.json');

function fail(msg) {
  console.error('check:data FAILED: ' + msg);
  process.exit(1);
}

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validate(schema, data) {
  const errors = [];
  if (schema.type === 'object') {
    if (!isObject(data)) {
      errors.push('data must be an object');
      return errors;
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!schema.properties || !Object.prototype.hasOwnProperty.call(schema.properties, key)) {
          errors.push(`unexpected property "${key}"`);
        }
      }
    }
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        errors.push(`missing required property "${key}"`);
      }
    }
    for (const [key, prop] of Object.entries(schema.properties || {})) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      const value = data[key];
      if (prop.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`"${key}" must be a string`);
        } else if (typeof prop.minLength === 'number' && value.length < prop.minLength) {
          errors.push(`"${key}" must have minLength ${prop.minLength}`);
        }
      } else if (prop.type === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          errors.push(`"${key}" must be an integer`);
        } else if (typeof prop.minimum === 'number' && value < prop.minimum) {
          errors.push(`"${key}" must be >= ${prop.minimum}`);
        }
      }
    }
  }
  return errors;
}

let schema;
let data;
try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
} catch (err) {
  fail(`cannot read schema at ${schemaPath}: ${err.message}`);
}
try {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
  fail(`cannot read data at ${dataPath}: ${err.message}`);
}

const errors = validate(schema, data);

if (typeof data.timezone === 'string' && data.timezone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: data.timezone });
  } catch {
    errors.push(`"timezone" is not a valid IANA time zone: ${data.timezone}`);
  }
}

if (errors.length) {
  fail(errors.join('\n  - '));
}

const bays = data.cols * data.rows;
console.log(
  'check:data OK: ' +
    path.relative(root, dataPath) +
    ' matches ' +
    path.relative(root, schemaPath) +
    ` (site=${JSON.stringify(data.site)}, ${data.cols}x${data.rows}=${bays} bays, timezone=${data.timezone})`
);
