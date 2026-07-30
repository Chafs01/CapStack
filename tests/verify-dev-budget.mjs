// Itemised development hard and soft costs.
//
// The risk here is the same one the operating expense list carried, with more
// leverage behind it: a development deal's total cost is the denominator for
// the yield, the loan sizing, the exit, and — on an affordable deal — the
// eligible basis the entire credit calculation is built from. If an itemised
// budget and the two legacy fields were ever both counted, or if the credit
// calculation kept reading the old fields while the pro forma read the list,
// every figure downstream would be wrong with nothing announcing it.
import { DEFS, buildPF, calcWaterfall, calcAfterTax } from '../src/engine/index.js';
import { BLANKS } from '../src/engine/defaults.js';
import { getDevCost, getHardCost, getSoftCost, resolveCostLine, costListTotal } from '../src/engine/income.js';
import { calcLIHTC } from '../src/engine/lihtc.js';
import { buildWorkbook } from '../src/engine/excel.js';
import { openMemo, generateMemo } from '../src/engine/memo.js';
import { dealHealth } from '../src/engine/health.js';
import { hasContent } from '../src/lib/draft.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

// the reference development deal: 30,000 SF at $185, softs at 18% of hard
const DEV = DEFS.development;                    // hard 5,550,000 soft 999,000
const AFF = DEFS.affordable;                     // hard 15,000,000 soft 3,750,000
// the same budget expressed as lines instead of two fields
const asLines = (base, over = {}) => ({
  ...base,
  hardCostItems: [{ cat: 'Structure & Shell', basis: 'perSF', amount: base.hardCostPerSF }],
  softCostItems: [{ cat: 'Custom', label: 'Soft costs', basis: 'pctHard', amount: base.softCostsPct }],
  ...over,
});

console.log('the two shapes must agree exactly:');
{
  check('legacy hard cost is 30,000 SF x $185', near(getHardCost(DEV), 5550000, 1e-6), String(getHardCost(DEV)));
  check('legacy soft cost is 18% of that', near(getSoftCost(DEV, getHardCost(DEV)), 999000, 1e-6));
  const listed = asLines(DEV);
  check('same hard total', near(getHardCost(DEV), getHardCost(listed), 1e-6));
  check('same soft total',
    near(getSoftCost(DEV, getHardCost(DEV)), getSoftCost(listed, getHardCost(listed)), 1e-6));
  check('same total development cost', near(getDevCost(DEV), getDevCost(listed), 1e-6),
    `${getDevCost(DEV)} vs ${getDevCost(listed)}`);
  const a = buildPF(DEV), b = buildPF(listed);
  check('same IRR', a.ret.irr === b.ret.irr);
  check('same equity multiple', a.ret.em === b.ret.em);
  check('same cap rate on cost', a.sum.capR === b.sum.capR);
  check('every year identical', JSON.stringify(a.rows) === JSON.stringify(b.rows));
}

console.log('\nexactly one of the two shapes is ever counted:');
{
  // a hand-built payload could carry both; the list must win, never sum
  const both = { ...DEV, hardCostItems: [{ cat: 'Structure & Shell', basis: 'perSF', amount: 185 }] };
  check('list wins for hard costs — no double count', near(getHardCost(both), 5550000, 1e-6), String(getHardCost(both)));
  check('the doubled figure is NOT what comes out', !near(getHardCost(both), 11100000, 1));
  const softBoth = { ...DEV, softCostItems: [{ cat: 'Legal', amount: 250000 }] };
  check('list wins for soft costs', near(getSoftCost(softBoth, getHardCost(softBoth)), 250000, 1e-6));
}

console.log('\nadding and removing lines does what it says:');
{
  const base = asLines(DEV);
  const plus = { ...base, hardCostItems: [...base.hardCostItems, { cat: 'Elevators & Conveyance', amount: 240000 }] };
  check('a hard line adds its amount to the hard total',
    near(getHardCost(plus) - getHardCost(base), 240000, 1e-6));
  // and it pulls the softs with it, because this deal quotes them as a share
  // of hard — a budget where adding an elevator did not move the contingency
  // or the A&E fee would be wrong
  check('...and drags the percent-quoted softs up with it',
    near(getDevCost(plus) - getDevCost(base), 240000 * 1.18, 1e-6),
    String(getDevCost(plus) - getDevCost(base)));
  const lumpSoft = { ...base, softCostItems: [{ cat: 'Legal', amount: 100000 }] };
  const lumpSoftPlus = { ...lumpSoft, softCostItems: [{ cat: 'Legal', amount: 100000 }, { cat: 'Survey', amount: 25000 }] };
  check('a lump-sum soft line adds exactly its amount, and nothing else moves',
    near(getDevCost(lumpSoftPlus) - getDevCost(lumpSoft), 25000, 1e-6));
  const emptied = { ...DEV, hardCostItems: [] };
  check('an emptied hard list is zero, not a fallback to $/SF', getHardCost(emptied) === 0);
  check('...and the total drops to land alone',
    near(getDevCost({ ...emptied, softCostItems: [] }), DEV.landCost, 1e-6));
  check('an emptied soft list is zero', getSoftCost({ ...DEV, softCostItems: [] }, 5550000) === 0);
  check('a deal with no lists at all still reads the legacy fields',
    near(getDevCost(DEV), 1200000 + 5550000 + 999000, 1e-6));
}

console.log('\na line can be quoted the three ways a budget is actually quoted:');
{
  const sf = 30000, units = 24;
  check('$185/SF resolves off buildable area', resolveCostLine({ amount: 185, basis: 'perSF' }, sf, units, 0) === 5550000);
  check('$12,000/unit resolves off unit count', resolveCostLine({ amount: 12000, basis: 'perUnit' }, sf, units, 0) === 288000);
  check('5% of hard resolves off the hard total', resolveCostLine({ amount: 5, basis: 'pctHard' }, sf, units, 5550000) === 277500);
  check('no basis is a plain lump sum', resolveCostLine({ amount: 90000 }, sf, units, 0) === 90000);
  check('an unknown basis falls back to a lump sum', resolveCostLine({ amount: 90000, basis: 'nonsense' }, sf, units, 0) === 90000);
  check('per-SF with no area yields nothing', resolveCostLine({ amount: 185, basis: 'perSF' }, 0, units, 0) === 0);
  check('per-unit with no units yields nothing', resolveCostLine({ amount: 12000, basis: 'perUnit' }, sf, 0, 0) === 0);
  check('a malformed amount yields nothing', resolveCostLine({ amount: 'x', basis: 'perSF' }, sf, units, 0) === 0);

  // the same budget expressed three ways must produce the same deal
  const lump = { ...DEV, hardCostItems: [{ cat: 'Structure & Shell', amount: 5550000 }] };
  const perSF = { ...DEV, hardCostItems: [{ cat: 'Structure & Shell', basis: 'perSF', amount: 185 }] };
  const perUnit = { ...DEV, hardCostItems: [{ cat: 'Structure & Shell', basis: 'perUnit', amount: 5550000 / 24 }] };
  check('a lump sum and a per-SF quote agree', near(getHardCost(lump), getHardCost(perSF), 1e-6));
  check('...and a per-unit quote agrees too', near(getHardCost(lump), getHardCost(perUnit), 1e-6));
  check('...and all three produce identical years',
    JSON.stringify(buildPF(lump).rows) === JSON.stringify(buildPF(perSF).rows));

  // a percent-of-hard soft line must follow the hard total it is a share of
  const bigger = { ...asLines(DEV), hardCostItems: [{ cat: 'Structure & Shell', basis: 'perSF', amount: 200 }] };
  check('softs quoted as a percent follow the hard total up',
    near(getSoftCost(bigger, getHardCost(bigger)), 30000 * 200 * 0.18, 1e-6));
  // ordering matters: softs cannot be a share of themselves
  check('a hard line never reads a percent-of-hard basis',
    resolveCostLine({ amount: 5, basis: 'pctHard' }, 30000, 24, 0) === 0);
}

console.log('\nmalformed line items cannot poison the budget:');
const junk = [
  ['not an array', { hardCostItems: 'nope' }],
  ['null entries', { hardCostItems: [null, undefined, { cat: 'Roofing', amount: 100000 }] }],
  ['missing amount', { hardCostItems: [{ cat: 'Roofing' }] }],
  ['string amount', { hardCostItems: [{ cat: 'Roofing', amount: '100000' }] }],
  ['NaN amount', { hardCostItems: [{ cat: 'Roofing', amount: NaN }] }],
  ['Infinity amount', { hardCostItems: [{ cat: 'Roofing', amount: Infinity }] }],
  ['nested object amount', { hardCostItems: [{ cat: 'Roofing', amount: { x: 1 } }] }],
  ['empty list', { hardCostItems: [] }],
  ['primitives in the list', { hardCostItems: [1, 'two', true] }],
  ['soft list of junk', { softCostItems: [null, 'x', { amount: NaN }] }],
  ['negative line', { hardCostItems: [{ cat: 'Roofing', amount: -500000 }] }],
  ['absurd line', { hardCostItems: [{ cat: 'Roofing', basis: 'perSF', amount: 1e9 }] }],
];
for (const [label, over] of junk) {
  const inp = { ...DEV, ...over };
  let threw = null, total = null, res = null;
  try { total = getDevCost(inp); res = buildPF(inp); } catch (e) { threw = e.message; }
  check(`${label}: no throw`, threw === null, threw);
  check(`${label}: total is finite`, Number.isFinite(total), String(total));
  check(`${label}: engine output stays finite`, !!res && Number.isFinite(res.rows[0].noi), String(res && res.rows[0].noi));
}
check('a string amount is read as a number', near(costListTotal([{ amount: '1000' }], 0, 0, 0), 1000, 1e-9));
check('costListTotal returns null when there is no list', costListTotal(undefined, 0, 0, 0) === null);
check('an empty list is zero, not null', costListTotal([], 0, 0, 0) === 0);

console.log('\nthe credit calculation reads the same budget the pro forma does:');
{
  const legacy = AFF, listed = asLines(AFF);
  const L1 = calcLIHTC(legacy, 5000000), L2 = calcLIHTC(listed, 5000000);
  check('same hard cost', near(L1.hard, L2.hard, 1e-6), `${L1.hard} vs ${L2.hard}`);
  check('same soft cost', near(L1.soft, L2.soft, 1e-6));
  check('same total uses', near(L1.totalUses, L2.totalUses, 1e-6));
  check('same eligible basis', near(L1.eligibleBasis, L2.eligibleBasis, 1e-6));
  check('same LIHTC equity', near(L1.lihtcEquity, L2.lihtcEquity, 1e-6));
  check('same funding gap', near(L1.fundingGap, L2.fundingGap, 1e-6));

  // an itemised budget must actually move the credit, not be ignored
  const richer = { ...listed, hardCostItems: [...listed.hardCostItems, { cat: 'Site Amenities', amount: 1000000 }] };
  const L3 = calcLIHTC(richer, 5000000);
  check('adding a hard line raises total uses by that amount plus its softs',
    near(L3.totalUses - L2.totalUses, 1000000 * 1.25, 1e-6),
    String(L3.totalUses - L2.totalUses));
  check('...and raises eligible basis by its share', L3.eligibleBasis > L2.eligibleBasis);
  check('...and therefore the equity the credit produces', L3.lihtcEquity > L2.lihtcEquity);
  check('an emptied budget does not leave a phantom basis',
    calcLIHTC({ ...AFF, hardCostItems: [], softCostItems: [] }, 5000000).eligibleBasis
    === (AFF.developerFee * ((AFF.eligibleBasisPct != null ? AFF.eligibleBasisPct : 95) / 100)));
}

console.log('\nthe rest of the app survives an itemised budget:');
{
  globalThis.window = { open: () => ({ document: { write() {}, close() {} } }) };
  for (const name of ['development', 'affordable']) {
    const inp = asLines(DEFS[name], {
      hardCostItems: [
        { cat: 'Sitework & Excavation', basis: 'perSF', amount: 12 },
        { cat: 'Structure & Shell', basis: 'perSF', amount: 120 },
        { cat: 'Mechanical, Electrical & Plumbing', basis: 'perUnit', amount: 18000 },
        { cat: 'Custom', label: 'Podium Deck', amount: 450000 },
        { cat: 'Hard Cost Contingency', basis: 'pctHard', amount: 0 },
      ],
      softCostItems: [
        { cat: 'Architecture & Engineering', basis: 'pctHard', amount: 6 },
        { cat: 'Permits & Plan Check', amount: 320000 },
        { cat: 'Construction Loan Interest', basis: 'pctHard', amount: 4 },
        { cat: 'Soft Cost Contingency', basis: 'pctHard', amount: 5 },
      ],
    });
    let threw = null, res = null;
    try {
      res = buildPF(inp);
      calcWaterfall(res, { ...inp, waterfallEnabled: true });
      calcAfterTax(res, { ...inp, afterTax: true });
      generateMemo(res, inp); openMemo(res, inp);
      dealHealth(res, inp);
      await buildWorkbook(res, inp);
    } catch (e) { threw = e.message; }
    check(`${name}: memo, health, waterfall and workbook all build`, threw === null, threw);
    check(`${name}: total cost is finite and positive`, Number.isFinite(getDevCost(inp)) && getDevCost(inp) > 0);
    check(`${name}: returns stay finite`, !!res && (Number.isFinite(res.ret.irr) || res.ret.irr === null));
  }
}

console.log('\nthe workbook must not disagree with the app:');
{
  const inp = asLines(DEV, { hardCostItems: [{ cat: 'Structure & Shell', amount: 6000000 }] });
  const res = buildPF(inp);
  const wb = await buildWorkbook(res, inp);
  const pd = wb.worksheets[0];
  const num = (v) => (v && typeof v === 'object' && 'result' in v ? v.result : v);
  let basisRow = null;
  pd.eachRow({ includeEmpty: false }, (row, i) => {
    if (String(row.getCell(2).value || '').includes('Total Development Cost')) basisRow = i;
  });
  check('the sheet carries a total development cost', basisRow !== null);
  if (basisRow !== null) {
    check('and it equals the itemised total the app computed',
      near(num(pd.getCell(basisRow, 3).value), getDevCost(inp), 0.01),
      `${num(pd.getCell(basisRow, 3).value)} vs ${getDevCost(inp)}`);
  }
}

console.log('\nsaved work and links carry the new shape:');
{
  const inp = asLines(DEV);
  const round = JSON.parse(JSON.stringify(inp));
  check('a budget survives a JSON round-trip intact',
    JSON.stringify(round.hardCostItems) === JSON.stringify(inp.hardCostItems));
  check('and recomputes to the same numbers',
    JSON.stringify(buildPF(round).rows) === JSON.stringify(buildPF(inp).rows));
  check('an itemised budget counts as work worth saving', hasContent(inp) === true);
  check('a blank development deal still counts as nothing',
    hasContent({ ...BLANKS.development }) === false);
  check('an empty budget is not mistaken for work',
    hasContent({ ...BLANKS.development, hardCostItems: [], softCostItems: [] }) === false);
  check('one entered line is work',
    hasContent({ ...BLANKS.development, hardCostItems: [{ cat: 'Roofing', amount: 90000 }] }) === true);
}

console.log('\nevery asset type tolerates the new fields, whether or not it uses them:');
for (const name of Object.keys(DEFS)) {
  const inp = { ...DEFS[name],
    hardCostItems: [{ cat: 'Structure & Shell', basis: 'perSF', amount: 150 }],
    softCostItems: [{ cat: 'Legal', basis: 'pctHard', amount: 3 }] };
  let threw = null, res = null;
  try {
    res = buildPF(inp);
    calcWaterfall(res, { ...inp, waterfallEnabled: true });
    dealHealth(res, inp);
  } catch (e) { threw = e.message; }
  check(`${name}: no throw`, threw === null, threw);
  check(`${name}: figures stay finite`, !!res && Number.isFinite(res.rows[0].noi));
}

if (failures) { console.log(`\n${failures} FAILURE(S) — the itemised development budget regressed.`); process.exit(1); }
console.log('\nItemised hard and soft costs behave correctly and change nothing that used to work.');
