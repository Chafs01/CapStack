// The property-tax basis check.
//
// Underwriting the seller's tax bill is the most expensive routine mistake a
// small investor makes: in many states the assessment resets at or near the
// sale price, so a long-held property is taxed on a value far below what the
// buyer will pay. Tax is usually the largest single operating expense, so
// getting it from the seller's bill overstates NOI, the cap rate, and every
// return beneath them.
//
// The check cannot know the state, so it works off the implied effective rate.
// That makes the false-positive behaviour as important as the true positives:
// a warning that fires on a legitimate Hawaii deal teaches people to ignore
// the panel, which costs more than the check saves.
import { DEFS, buildPF } from '../src/engine/index.js';
import { dealHealth, propertyTaxOf, HEALTH_THRESHOLDS as T } from '../src/engine/health.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};
const taxCheck = (inp) => dealHealth(buildPF(inp), inp).checks.find((c) => c.id === 'tax-basis');
const statusFor = (inp) => (taxCheck(inp) || {}).status;
const PRICE = 7750000;
const at = (rate, over = {}) => ({ ...DEFS.multifamily, purchasePrice: PRICE, propertyTax: PRICE * rate, ...over });

console.log('the reference deals are all plausible and must not nag:');
for (const name of ['multifamily', 'residential', 'commercial', 'mixed-use']) {
  check(`${name}: passes`, statusFor(DEFS[name]) === 'pass', statusFor(DEFS[name]));
}

console.log('\nthe mistake it exists to catch:');
{
  // long-held California property: assessed value capped for decades
  const propThirteen = at(0.0012);
  check('a 0.12% effective rate warns', statusFor(propThirteen) === 'warn');
  const c = taxCheck(propThirteen);
  check('it names the seller\'s assessment as the likely cause', /seller/i.test(c.detail));
  check('it explains reassessment on change of ownership', /reassess/i.test(c.detail));
  check('it offers a concrete next step', /assessor/i.test(c.fix));
  check('it says which figure is wrong, with the number', /0\.12%/.test(c.label));
}

console.log('\nboundaries, exactly:');
const cases = [
  [0.0000, 'warn'],  // nothing entered at all
  [0.0005, 'warn'],
  [0.0034, 'warn'],
  [T.taxRateLow - 1e-9, 'warn'],
  [T.taxRateLow, 'pass'],          // the floor itself is acceptable
  [0.0050, 'pass'],
  [0.0110, 'pass'],                // US median
  [0.0240, 'pass'],                // New Jersey, the high end of legitimate
  [T.taxRateHigh, 'pass'],
  [T.taxRateHigh + 1e-6, 'warn'],
  [0.0500, 'warn'],
];
for (const [rate, want] of cases) {
  const got = statusFor(at(rate));
  check(`${(rate * 100).toFixed(3)}% → ${want}`, got === want, String(got));
}

console.log('\nlow-rate states must not be nagged into ignoring the panel:');
// real effective rates; anything at or above the floor has to pass cleanly
for (const [state, rate] of [['Colorado', 0.0051], ['Nevada', 0.0055], ['Utah', 0.0057],
  ['South Carolina', 0.0057], ['Louisiana', 0.0056], ['Delaware', 0.0061]]) {
  check(`${state} at ${(rate * 100).toFixed(2)}% passes`, statusFor(at(rate)) === 'pass', statusFor(at(rate)));
}
{
  // Hawaii and Alabama sit below the floor and will warn — that is a known,
  // accepted false positive, so the wording must make it harmless
  const c = taxCheck(at(0.0029));
  check('a genuinely low-rate jurisdiction still warns (accepted)', c.status === 'warn');
  check('...but the copy names those states so it reads as a question, not an error',
    /Hawaii|Alabama|Colorado/.test(c.detail));
  check('...and explicitly says to ignore it if the rate is just the jurisdiction',
    /ignore this/i.test(c.fix));
}

console.log('\nhigh side: typos and special assessment districts:');
{
  const c = taxCheck(at(0.05));
  check('5% warns', c.status === 'warn');
  check('it suggests a typo or a special assessment', /typo|special assessment/i.test(c.detail));
}

console.log('\nmissing tax is called out, because it is the biggest line:');
{
  const c = taxCheck({ ...DEFS.multifamily, propertyTax: 0 });
  check('no tax entered warns', c.status === 'warn');
  check('it says why that matters', /largest single operating expense/i.test(c.detail));
  check('it does not pretend to know a rate', !/%/.test(c.label));
}

console.log('\nit reads the tax from either expense shape:');
{
  const listed = {
    ...DEFS.multifamily, propertyTax: 0, insurance: 0, maintenance: 0, utilities: 0, reserves: 0, administrative: 0,
    opexItems: [{ cat: 'Property Taxes', amount: 9000 }, { cat: 'Insurance', amount: 28000 }],
  };
  check('finds the itemised tax line', propertyTaxOf(listed) === 9000, String(propertyTaxOf(listed)));
  check('and warns on it', statusFor(listed) === 'warn');
  check('legacy field is still read when there is no list',
    propertyTaxOf({ propertyTax: 95000 }) === 95000);
  // an itemised deal that genuinely has no tax line must not resurrect a stale
  // legacy value — that would hide the very omission being checked for
  const noLine = { ...DEFS.multifamily, propertyTax: 95000, opexItems: [{ cat: 'Insurance', amount: 28000 }] };
  check('an itemised list without a tax line reports zero, not the stale field',
    propertyTaxOf(noLine) === 0, String(propertyTaxOf(noLine)));
  check('...and that surfaces as "no property tax entered"',
    /No property tax entered/.test(taxCheck(noLine).label));
  // several tax-ish lines should sum rather than pick one
  const split = {
    ...DEFS.multifamily, propertyTax: 0,
    opexItems: [{ cat: 'Property Taxes', amount: 60000 }, { cat: 'Custom', label: 'x', amount: 5000 },
      { cat: 'Property Taxes', amount: 35000 }],
  };
  check('multiple tax lines are summed', propertyTaxOf(split) === 95000, String(propertyTaxOf(split)));
}

console.log('\ncosted deals have no purchase price, so the check stays silent:');
for (const name of ['development', 'affordable']) {
  check(`${name}: no tax-basis finding`, taxCheck(DEFS[name]) === undefined,
    JSON.stringify(taxCheck(DEFS[name])));
}
check('a deal with no price at all raises nothing',
  taxCheck({ ...DEFS.multifamily, purchasePrice: 0 }) === undefined);

console.log('\nmalformed input cannot throw or produce nonsense:');
const junk = [
  ['negative tax', { propertyTax: -5000 }],
  ['NaN tax', { propertyTax: NaN }],
  ['string tax', { propertyTax: '9000' }],
  ['null tax', { propertyTax: null }],
  ['negative price', { purchasePrice: -100 }],
  ['tax list is a string', { opexItems: 'nope' }],
  ['tax row with no amount', { opexItems: [{ cat: 'Property Taxes' }] }],
  ['tax row amount NaN', { opexItems: [{ cat: 'Property Taxes', amount: NaN }] }],
  ['null rows', { opexItems: [null, { cat: 'Property Taxes', amount: 9000 }] }],
  ['weird cat casing', { propertyTax: 0, opexItems: [{ cat: 'PROPERTY TAXES', amount: 9000 }] }],
];
for (const [label, over] of junk) {
  const inp = { ...DEFS.multifamily, ...over };
  let threw = null, c;
  try { c = taxCheck(inp); } catch (e) { threw = e.message; }
  check(`${label}: no throw`, threw === null, threw);
  check(`${label}: no NaN in the message`, !c || !/NaN|Infinity|undefined/.test(c.label + c.detail),
    c && c.label);
}
check('a lowercase category still matches',
  propertyTaxOf({ opexItems: [{ cat: 'property taxes', amount: 1234 }] }) === 1234);

console.log('\nit is a warning, never a hard failure:');
for (const rate of [0, 0.0001, 0.002, 0.05, 0.5]) {
  const c = taxCheck(at(rate));
  check(`${(rate * 100).toFixed(2)}%: warns rather than fails`, !c || c.status !== 'fail', c && c.status);
}
{
  // it must not be able to drive an otherwise sound deal to "needs-work"
  const h = dealHealth(buildPF(at(0.0012)), at(0.0012));
  check('a stale tax figure alone does not condemn the deal', h.verdict === 'review', h.verdict);
}

console.log('\nevery finding is actionable:');
for (const rate of [0, 0.001, 0.011, 0.05]) {
  const c = taxCheck(at(rate));
  if (!c) continue;
  check(`${(rate * 100).toFixed(2)}%: has label, detail and a remedy where needed`,
    !!c.label && !!c.detail && (c.status === 'pass' || !!c.fix));
}

if (failures) { console.log(`\n${failures} FAILURE(S) — the tax-basis check regressed.`); process.exit(1); }
console.log('\nThe tax-basis check catches the stale-assessment mistake without nagging legitimate deals.');
