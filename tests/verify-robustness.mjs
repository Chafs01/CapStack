// Written after a bug hunt that found two crashes able to blank the whole app:
//
//   - calcRefinance threw on a one-year hold, because the refi year clamps to
//     hp-1 and then indexes rows[ry-1] — rows[-1] on a one-year hold. The
//     dashboard unmounted and the user was dropped on the landing page with no
//     explanation and no results.
//   - a malformed saved-deals entry in localStorage crashed the deal list,
//     which took the entire page down to a blank screen.
//
// Both were reachable without doing anything exotic. This locks the whole
// surface: no engine path may throw or leak a non-finite number for any input
// a user can actually type.
import * as E from '../src/engine/index.js';
import { buildWorkbook } from '../src/engine/excel.js';
import { openMemo, downloadMemo, generateMemo } from '../src/engine/memo.js';
import { dealHealth } from '../src/engine/health.js';
import { isDealLike, loadDealsLocal, DEALS_KEY } from '../src/lib/dealStore.js';

const { DEFS, buildPF } = E;
let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};

// Walk every numeric leaf. An IRR is legitimately undefined when there is no
// positive equity to return on, so those are exempt by name.
function nonFinite(o, path = '', out = []) {
  if (o == null) return out;
  if (typeof o === 'number') {
    if (!Number.isFinite(o) && !/irr/i.test(path)) out.push(`${path}=${o}`);
    return out;
  }
  if (Array.isArray(o)) { o.forEach((v, i) => nonFinite(v, `${path}[${i}]`, out)); return out; }
  if (typeof o === 'object') for (const k of Object.keys(o)) nonFinite(o[k], path ? `${path}.${k}` : k, out);
  return out;
}

console.log('the one-year hold that crashed the dashboard:');
for (const name of Object.keys(DEFS)) {
  for (const refiYear of [0, 1, 2, 3, 5, 99]) {
    const inp = { ...DEFS[name], holdingPeriod: 1, refiEnabled: true, refiYear };
    let threw = null, out;
    try { out = E.calcRefinance(buildPF(inp), inp); } catch (e) { threw = e.message; }
    check(`${name}: 1-year hold, refiYear ${refiYear} does not throw`, threw === null, threw);
    if (!threw) check(`${name}: 1-year hold, refiYear ${refiYear} declines to refinance`, out === null, JSON.stringify(out && Object.keys(out)));
  }
}
// and a hold long enough to refinance still does
{
  const inp = { ...DEFS.multifamily, holdingPeriod: 7, refiEnabled: true, refiYear: 3 };
  check('a 7-year hold still produces a refinance', E.calcRefinance(buildPF(inp), inp) !== null);
}

console.log('\nno engine path throws or leaks a non-finite number:');
const FIELDS = {
  interestRate: [0, 3, 12], amortYears: [0, 15, 30], ioPeriod: [0, 3, 30],
  holdingPeriod: [0, 1, 2, 7, 10], loanAmount: [0, 100000, 99999999],
  purchasePrice: [0, 1, 7750000], numUnits: [0, 1, 40], vacancyRate: [0, 50, 100],
  exitCapRate: [0, 5.75], exitPPU: [0, 133000], avgRent: [0, 1500],
  sellingCostsPct: [0, 100], discountRate: [0, 8], refiYear: [0, 1, 20],
};
const MODULES = {
  waterfall: (r, i) => E.calcWaterfall(r, { ...i, waterfallEnabled: true }),
  afterTax: (r, i) => E.calcAfterTax(r, { ...i, afterTax: true }),
  timeline: (r, i) => E.calcProjectTimeline(r, i),
  refinance: (r, i) => E.calcRefinance(r, { ...i, refiEnabled: true }),
  scenarios: (r, i) => E.calcScenarios(r, i),
  devCredits: (r, i) => E.calcDevCredits(r, { ...i, devCredits: [{ type: 'Historic', basis: 1e6, rate: 20, price: 0.9 }] }),
  health: (r, i) => dealHealth(r, i),
};
let throws = 0, leaks = 0, runs = 0;
const firstThrow = []; const firstLeak = [];
for (const name of Object.keys(DEFS)) {
  for (const [field, vals] of Object.entries(FIELDS)) {
    for (const v of vals) {
      const inp = { ...DEFS[name], [field]: v };
      let res;
      try { res = buildPF(inp); } catch (e) { throws++; firstThrow.push(`buildPF ${name} ${field}=${v}: ${e.message}`); continue; }
      const coreLeak = nonFinite({ rows: res.rows, sum: res.sum, exit: res.exit, equity: res.equity });
      if (coreLeak.length) { leaks++; firstLeak.push(`core ${name} ${field}=${v}: ${coreLeak[0]}`); }
      for (const [mod, fn] of Object.entries(MODULES)) {
        runs++;
        let out;
        try { out = fn(res, inp); } catch (e) { throws++; firstThrow.push(`${mod} ${name} ${field}=${v}: ${e.message}`); continue; }
        const bad = nonFinite(out);
        if (bad.length) { leaks++; firstLeak.push(`${mod} ${name} ${field}=${v}: ${bad[0]}`); }
      }
    }
  }
}
check(`no throws across ${runs} module evaluations`, throws === 0, firstThrow.slice(0, 3).join(' | '));
check('no non-finite values escape', leaks === 0, firstLeak.slice(0, 3).join(' | '));

console.log('\nexport paths survive the same inputs:');
{
  let xlFail = 0, memoFail = 0;
  globalThis.window = { open: () => ({ document: { write() {}, close() {} } }) };
  globalThis.Blob = class {};
  globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  globalThis.document = { createElement: () => ({ click() {}, style: {} }), body: { appendChild() {}, removeChild() {} } };
  const edge = [];
  for (const n of Object.keys(DEFS)) {
    edge.push({ ...DEFS[n] });
    edge.push({ ...DEFS[n], holdingPeriod: 1, refiEnabled: true, afterTax: true, waterfallEnabled: true });
    edge.push({ ...DEFS[n], purchasePrice: 0, loanAmount: 0, numUnits: 0, avgRent: 0, unitMix: [] });
    edge.push({ ...DEFS[n], loanAmount: 99999999 });
  }
  for (const inp of edge) {
    const res = buildPF(inp);
    try { const wb = await buildWorkbook(res, inp); if (!wb.worksheets.length) xlFail++; } catch (e) { xlFail++; }
    try { generateMemo(res, inp); openMemo(res, inp); downloadMemo(res, inp); } catch (e) { memoFail++; }
  }
  check(`Excel export builds for all ${edge.length} edge cases`, xlFail === 0, String(xlFail));
  check(`memo generates for all ${edge.length} edge cases`, memoFail === 0, String(memoFail));
}

console.log('\ncorrupt saved-deal storage cannot reach the UI:');
{
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const shapes = {
    'invalid json': '{{{',
    'null': 'null',
    'an object, not a list': '{"a":1}',
    'a list of nulls': '[null,null]',
    'a list of numbers': '[1,2,3]',
    'rows with no inp': '[{"id":"1","name":"X"}]',
    'inp is a string': '[{"id":"1","name":"X","inp":"nope"}]',
    'inp is an array': '[{"id":"1","name":"X","inp":[1,2]}]',
    'no id': '[{"name":"X","inp":{}}]',
  };
  for (const [label, raw] of Object.entries(shapes)) {
    store.set(DEALS_KEY, raw);
    let out, threw = null;
    try { out = loadDealsLocal(); } catch (e) { threw = e.message; }
    check(`${label} yields a safe empty list`, threw === null && Array.isArray(out) && out.length === 0,
      threw || JSON.stringify(out));
  }
  // a genuine deal still loads
  store.set(DEALS_KEY, JSON.stringify([{ id: 'a', name: 'Real', inp: { assetType: 'Multifamily' } }]));
  const good = loadDealsLocal();
  check('a well-formed deal still loads', good.length === 1 && good[0].name === 'Real');
  check('mixed good and bad keeps only the good', (() => {
    store.set(DEALS_KEY, JSON.stringify([null, { id: 'a', name: 'Real', inp: {} }, 5, { nope: true }]));
    const m = loadDealsLocal();
    return m.length === 1 && m[0].id === 'a';
  })());
  check('isDealLike rejects a null', isDealLike(null) === false);
}

console.log('\nimpossible leverage is called an error, not aggressive:');
{
  const bad = { ...DEFS.residential, loanAmount: 7750000 };
  const h = dealHealth(buildPF(bad), bad);
  const lev = h.checks.find((c) => c.id === 'leverage');
  check('a loan exceeding the price fails rather than warns', lev && lev.status === 'fail', lev && lev.status);
  check('...and says the debt exceeds the asset', lev && /exceeds the asset|larger than the/i.test(lev.label + lev.detail));
  const okDeal = DEFS.residential;
  const okLev = dealHealth(buildPF(okDeal), okDeal).checks.find((c) => c.id === 'leverage');
  check('ordinary leverage still passes', okLev && okLev.status === 'pass', okLev && okLev.status);
}

if (failures) { console.log(`\n${failures} FAILURE(S) — robustness regressed.`); process.exit(1); }
console.log('\nNo reachable input crashes the engine, the exports, or the deal list.');
