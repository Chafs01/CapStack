// Recomputes every captured case from the live engine and compares against
// tests/fixtures.json. Exact equality required — any drift is a regression.
// Cases are read from the fixture file, so adding a case to capture-fixtures
// automatically extends the guarantee here.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { snapshot, HELPERS } from './capture-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));

const replacer = (k, v) => (typeof v === 'number' && Number.isNaN(v) ? '__NaN__' : v);
const norm = (o) => JSON.parse(JSON.stringify(o, replacer) ?? 'null');

let failures = 0, checks = 0;
function compare(label, actual, expected) {
  checks++;
  const a = JSON.stringify(norm(actual));
  const e = JSON.stringify(norm(expected));
  if (a === e) { console.log('  PASS', label); return; }
  failures++;
  console.log('  FAIL', label);
  diffPath(norm(actual), norm(expected), label);
}
function diffPath(a, e, p) {
  if (typeof a !== typeof e || typeof a !== 'object' || a === null || e === null) {
    if (JSON.stringify(a) !== JSON.stringify(e)) console.log(`    at ${p}: got ${JSON.stringify(a)} expected ${JSON.stringify(e)}`);
    return;
  }
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(e || {})])) diffPath(a?.[k], e?.[k], p + '.' + k);
}

for (const name of Object.keys(fixtures)) {
  if (name === '__helpers') continue;
  const fx = fixtures[name];
  console.log(name + ':');
  const got = snapshot(fx.inp);
  for (const part of ['core', 'waterfall', 'afterTax', 'timeline', 'refinance', 'scenarios', 'devCredits']) {
    compare(part, got[part], fx[part]);
  }
}

console.log('helpers:');
const h = HELPERS(), hx = fixtures.__helpers;
for (const k of Object.keys(hx)) compare(k, h[k], hx[k]);

if (failures) { console.log(`\n${failures} FAILURE(S) — engine outputs differ from fixtures.`); process.exit(1); }
console.log(`\nAll ${checks} engine checks match golden fixtures exactly.`);
