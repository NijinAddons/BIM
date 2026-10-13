// Generates src/config.ts from .env before the app starts / builds.
// Keeps secrets out of source control while giving the JS bundle a plain import.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const OUT_PATH = path.join(ROOT, 'src', 'config.ts');

// Keys bundled into the app.
//
// GOOGLE_MAPS_API_KEY is a public, referrer-restricted key.
//
// FRAPPE_API_KEY / FRAPPE_API_SECRET are bundled so the app can call the Frappe
// REST API directly (e.g. the Sales Order list). Note: anything shipped here is
// extractable from the built app — scope this key to the minimum doctype
// permissions it needs, and prefer a whitelisted server method long-term.
//
// STRIPE_PUBLISHABLE_KEY (pk_...) is meant to be public — safe to bundle.
// The matching secret key must only ever live on the backend.
const PUBLIC_KEYS = [
  'GOOGLE_MAPS_API_KEY',
  'FRAPPE_API_KEY',
  'FRAPPE_API_SECRET',
  'STRIPE_PUBLISHABLE_KEY',
];

function parseEnv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

let env = {};
try {
  env = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
} catch {
  console.warn('[gen-env] no .env file found — generating config with empty values');
}

const lines = [
  '// AUTO-GENERATED from .env by scripts/gen-env.js — do not edit, do not commit.',
];
for (const key of PUBLIC_KEYS) {
  lines.push(`export const ${key} = ${JSON.stringify(env[key] ?? '')};`);
}
lines.push('');

fs.writeFileSync(OUT_PATH, lines.join('\n'));
console.log(`[gen-env] wrote ${path.relative(ROOT, OUT_PATH)} [${PUBLIC_KEYS.join(', ')}]`);
