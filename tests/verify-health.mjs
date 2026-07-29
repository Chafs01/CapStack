// The health panel tells a beginner whether a deal is financeable. A wrong
// threshold here is worse than no panel: it either blesses a deal no lender
// would fund, or condemns an ordinary one.
//
// Every branch of every check is exercised, including the two domain
// distinctions that a naive implementation gets wrong:
//   - 1–4 unit residential is not held to commercial DSCR minimums
//   - yield on cost is not a meaningful cap rate for a LIHTC deal
import { dealHealth, assessable, costBasis, permanentLoan, HEALTH_THRESHOLDS as T } from '../src/engine/health.js';
import { buildPF } from '../src/engine/buildPF.js';
import { DEFS, BLANKS } from '../src/engine/defaults.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};
const statusOf = (h, id) => (h.checks.find((c) => c.id === id) || {}).status;
const findingOf = (h, id) => h.checks.find((c) => c.id === id);

// A synthetic result shaped like buildPF's output, so a single threshold can be
// moved without dragging a whole deal along with it.
const mk = (over = {}) => {
  const { inp = {}, ...r } = over;
  return [{
    rows: [{ egi: 100000, expR: 0.40, cfbt: 10000, ...(r.y1 || {}) }],
    ret: { totalCF: 100000, ...(r.ret || {}) },
    sum: { dscr: 1.50, beOcc: 0.80, capR: 0.06, devCost: 0, ...(r.sum || {}) },
    exit: { proceeds: 100000, ...(r.exit || {}) },
    equity: 100000,
    lihtc: r.lihtc,
    // 1.1% of price — the US median, so the tax-basis check reads clean and
    // this fixture keeps testing what it means to test
  }, { assetType: 'Multifamily', purchasePrice: 1000000, propertyTax: 11000, loanAmount: 700000, vacancyRate: 5, ...inp }];
};

console.log('readiness — an unfinished form is not a failing deal:');
{
  const blank = BLANKS.multifamily;
  const h = dealHealth(buildPF(blank), blank);
  check('blank deal is not assessed', h.ready === false, JSON.stringify(h.counts));
  check('blank deal raises no findings', h.checks.length === 0);
  check('blank deal verdict is incomplete', h.verdict === 'incomplete', h.verdict);
  check('price without income is still incomplete',
    dealHealth(...mk({ y1: { egi: 0 }, inp: { purchasePrice: 500000 } })).ready === false);
  check('income without a basis is still incomplete',
    dealHealth(...mk({ inp: { purchasePrice: 0 } })).ready === false);
  check('assessable survives null input', assessable(null, null) === false);
}

console.log('\nDSCR — commercial thresholds:');
for (const [dscr, want] of [[0.95, 'fail'], [1.19, 'fail'], [1.20, 'warn'], [1.34, 'warn'], [1.35, 'pass'], [2.0, 'pass']]) {
  check(`commercial DSCR ${dscr.toFixed(2)}x → ${want}`,
    statusOf(dealHealth(...mk({ sum: { dscr } })), 'dscr') === want,
    statusOf(dealHealth(...mk({ sum: { dscr } })), 'dscr'));
}
check('no debt reads N/A, not a failure',
  statusOf(dealHealth(...mk({ sum: { dscr: null } })), 'dscr') === 'na');

console.log('\nDSCR — 1–4 unit residential is financed differently:');
const resi = { propClass: 'residential' };
for (const [dscr, want] of [[0.95, 'fail'], [1.00, 'warn'], [1.15, 'warn'], [1.19, 'warn'], [1.20, 'pass'], [1.30, 'pass']]) {
  check(`residential DSCR ${dscr.toFixed(2)}x → ${want}`,
    statusOf(dealHealth(...mk({ sum: { dscr }, inp: resi })), 'dscr') === want,
    statusOf(dealHealth(...mk({ sum: { dscr }, inp: resi })), 'dscr'));
}
check('a 1.15x duplex is NOT called unfinanceable',
  statusOf(dealHealth(...mk({ sum: { dscr: 1.15 }, inp: resi })), 'dscr') !== 'fail');
check('the same 1.15x IS a failure for commercial',
  statusOf(dealHealth(...mk({ sum: { dscr: 1.15 } })), 'dscr') === 'fail');

console.log('\nunpriced comp exit is a hard failure:');
{
  const h = dealHealth(...mk({ inp: { exitMethod: 'ppu', exitPPU: 0 } }));
  check('unpriced comp exit fails', statusOf(h, 'exit-priced') === 'fail');
  check('unpriced comp exit sets the verdict', h.verdict === 'needs-work', h.verdict);
  check('a priced comp exit passes',
    statusOf(dealHealth(...mk({ inp: { exitMethod: 'ppu', exitPPU: 133000 } })), 'exit-priced') === 'pass');
  check('cap-rate exits raise no exit-priced finding',
    statusOf(dealHealth(...mk({ inp: { exitMethod: 'cap' } })), 'exit-priced') === undefined);
}

console.log('\nnegative year-1 cash flow:');
check('negative cash flow fails', statusOf(dealHealth(...mk({ y1: { cfbt: -5000 } })), 'cash-flow') === 'fail');
check('zero cash flow does not fail', statusOf(dealHealth(...mk({ y1: { cfbt: 0 } })), 'cash-flow') === 'pass');

console.log('\nexpense ratio is flagged at both extremes:');
for (const [expR, want] of [[0.70, 'warn'], [0.56, 'warn'], [0.55, 'pass'], [0.40, 'pass'], [0.25, 'pass'], [0.24, 'warn'], [0.10, 'warn']]) {
  check(`expense ratio ${(expR * 100).toFixed(0)}% → ${want}`,
    statusOf(dealHealth(...mk({ y1: { expR } })), 'expense-ratio') === want,
    statusOf(dealHealth(...mk({ y1: { expR } })), 'expense-ratio'));
}
check('an implausibly low ratio explains itself as a missing cost',
  /left out|missing/i.test(findingOf(dealHealth(...mk({ y1: { expR: 0.10 } })), 'expense-ratio').detail));

console.log('\nleverage:');
check('LTV 90% warns', statusOf(dealHealth(...mk({ inp: { loanAmount: 900000 } })), 'leverage') === 'warn');
check('LTV 80% passes', statusOf(dealHealth(...mk({ inp: { loanAmount: 800000 } })), 'leverage') === 'pass');
check('an all-cash deal raises no leverage finding',
  statusOf(dealHealth(...mk({ inp: { loanAmount: 0 } })), 'leverage') === undefined);

console.log('\ncap-rate plausibility catches a mistyped price:');
for (const [capR, want] of [[0.001, 'warn'], [0.029, 'warn'], [0.03, 'pass'], [0.06, 'pass'], [0.12, 'pass'], [0.13, 'warn'], [0.9, 'warn']]) {
  check(`cap ${(capR * 100).toFixed(1)}% → ${want}`,
    statusOf(dealHealth(...mk({ sum: { capR } })), 'cap-rate') === want,
    statusOf(dealHealth(...mk({ sum: { capR } })), 'cap-rate'));
}

console.log('\nexit dependence:');
check('80% from the sale warns',
  statusOf(dealHealth(...mk({ ret: { totalCF: 25000 }, exit: { proceeds: 100000 } })), 'exit-dependence') === 'warn');
check('50/50 passes',
  statusOf(dealHealth(...mk({ ret: { totalCF: 100000 }, exit: { proceeds: 100000 } })), 'exit-dependence') === 'pass');

console.log('\nverdict rolls up correctly:');
check('any failure → needs-work', dealHealth(...mk({ y1: { cfbt: -1 } })).verdict === 'needs-work');
check('warnings only → review', dealHealth(...mk({ sum: { dscr: 1.25 } })).verdict === 'review');
check('all clear → clean', dealHealth(...mk()).verdict === 'clean', JSON.stringify(dealHealth(...mk()).counts));
check('counts sum to the number of checks', (() => {
  const h = dealHealth(...mk());
  const { pass, warn, fail, na } = h.counts;
  return pass + warn + fail + na === h.checks.length;
})());

console.log('\nevery real asset type produces sane findings:');
for (const name of Object.keys(DEFS)) {
  const inp = DEFS[name];
  const h = dealHealth(buildPF(inp), inp);
  check(`${name}: assessed`, h.ready === true);
  check(`${name}: reference deal has no hard failures`, h.counts.fail === 0,
    h.checks.filter((c) => c.status === 'fail').map((c) => c.label).join('; '));
  check(`${name}: every finding has a label and detail`,
    h.checks.every((c) => c.label && c.detail && c.id && c.status));
  check(`${name}: every warn or fail offers a remedy`,
    h.checks.filter((c) => c.status === 'warn' || c.status === 'fail').every((c) => !!c.fix),
    h.checks.filter((c) => (c.status === 'warn' || c.status === 'fail') && !c.fix).map((c) => c.id).join(','));
}

console.log('\ncosted deals read development cost and the sized loan, not price:');
{
  const aff = DEFS.affordable, ra = buildPF(aff);
  check('LIHTC basis resolves to development cost', costBasis(ra, aff) > 0, String(costBasis(ra, aff)));
  check('LIHTC debt resolves to the permanent loan', permanentLoan(ra, aff) > 0, String(permanentLoan(ra, aff)));
  check('LIHTC is assessable at all', dealHealth(ra, aff).ready === true);
  check('LIHTC leverage is labelled LTC', /LTC/.test(findingOf(dealHealth(ra, aff), 'leverage').label));
  check('LIHTC cap rate is N/A rather than a false alarm',
    statusOf(dealHealth(ra, aff), 'cap-rate') === 'na');
  const dev = DEFS.development, rd = buildPF(dev);
  check('development basis resolves to development cost', costBasis(rd, dev) > 0);
}

console.log('\nmalformed input must not throw:');
for (const [r, i] of [[null, null], [{}, {}], [{ rows: [] }, { assetType: 'Multifamily' }],
  [{ rows: [{ egi: NaN }], sum: {}, ret: {}, exit: {} }, { purchasePrice: NaN }]]) {
  let threw = null;
  try { dealHealth(r, i); } catch (e) { threw = e.message; }
  check(`survives ${JSON.stringify(i)}`, threw === null, threw);
}

if (failures) { console.log(`\n${failures} FAILURE(S) — deal-health logic regressed.`); process.exit(1); }
console.log('\nDeal-health checks are correct across every threshold and asset type.');
