// Recomputes everything capture-fixtures.cjs captured, but from the MIGRATED
// engine modules (src/engine/), and compares against tests/fixtures.json.
// Exact equality required — any drift is a migration bug.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as E from '../src/engine/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));

const replacer = (k, v) => (typeof v === 'number' && Number.isNaN(v) ? '__NaN__' : v);
const norm = (o) => JSON.parse(JSON.stringify(o, replacer) ?? 'null');

let failures = 0;
function compare(label, actual, expected) {
  const a = JSON.stringify(norm(actual));
  const e = JSON.stringify(norm(expected));
  if (a === e) { console.log('  PASS', label); return; }
  failures++;
  console.log('  FAIL', label);
  // find first differing path for a useful message
  diffPath(norm(actual), norm(expected), label);
}
function diffPath(a, e, p) {
  if (typeof a !== typeof e || (typeof a !== 'object' || a === null || e === null)) {
    if (JSON.stringify(a) !== JSON.stringify(e)) console.log(`    at ${p}: got ${JSON.stringify(a)} expected ${JSON.stringify(e)}`);
    return;
  }
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(e || {})]);
  for (const k of keys) diffPath(a?.[k], e?.[k], p + '.' + k);
}

for (const type of ['multifamily', 'commercial', 'mixed-use', 'development', 'affordable']) {
  console.log(type + ':');
  const fx = fixtures[type];
  const inp = fx.inp;
  const res = E.buildPF(inp);
  compare('buildPF core', {
    equity: res.equity, totalCost: res.totalCost, acqC: res.acqC, LF: res.LF,
    rows: res.rows, exit: res.exit, ret: res.ret, sum: res.sum,
    lihtc: res.lihtc, debtSizing: res.debtSizing,
  }, fx.core);
  compare('waterfall', E.calcWaterfall(res, inp), fx.waterfall);
  compare('afterTax', E.calcAfterTax(res, inp), fx.afterTax);
  compare('timeline', E.calcProjectTimeline(res, inp), fx.timeline);
  compare('refinance', E.calcRefinance(res, { ...inp, refiEnabled: true, refiYear: 3 }), fx.refinance);
  compare('scenarios', E.calcScenarios(res, inp), fx.scenarios);
  compare('devCredits', E.calcDevCredits(res, { ...inp, devCredits: [{ type: 'Historic', basis: 1000000, rate: 20, price: 0.9 }] }), fx.devCredits);
}

console.log('helpers:');
const h = fixtures.__helpers;
compare('monthlyPmt', E.monthlyPmt(1000000, 0.065, 30), h.monthlyPmt);
compare('monthlyPmtZeroRate', E.monthlyPmt(1000000, 0, 30), h.monthlyPmtZeroRate);
compare('loanBal', E.loanBal(1000000, 0.065, 30, 60), h.loanBal);
compare('irr', E.calcIRR([-100, 20, 20, 20, 20, 120]), h.irr);
compare('npv', E.calcNPV([-100, 50, 50, 50], 0.1), h.npv);
compare('gpiMF', E.getGPI(E.DEFS.multifamily), h.gpiMF);
compare('opexMF', E.getOpEx(E.DEFS.multifamily), h.opexMF);
compare('devCost', E.getDevCost(E.DEFS.development), h.devCost);

if (failures) { console.log('\n' + failures + ' FAILURE(S) — engine outputs differ from fixtures.'); process.exit(1); }
console.log('\nAll engine outputs match golden fixtures exactly.');
