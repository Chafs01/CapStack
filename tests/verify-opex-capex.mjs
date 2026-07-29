// Itemised operating expenses and a capital expenditure line.
//
// Two things carry real risk here. The first is silent double-counting: a deal
// holding both the legacy fields and a list must count exactly one of them, or
// every figure downstream is wrong in a way nothing announces. The second is
// where capex lands — above NOI it would corrupt the cap rate and the DSCR a
// lender sizes on, which is precisely the number people rely on.
import { DEFS, buildPF, calcWaterfall, calcAfterTax } from '../src/engine/index.js';
import { BLANKS } from '../src/engine/defaults.js';
import { getOpEx, opexItemsTotal, getOtherIncome, resolveCapex, resolveLine, lossRate } from '../src/engine/income.js';
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

// the multifamily reference deal, expressed as a list instead of six fields
const LEGACY_AS_ITEMS = [
  ['Property Taxes', 95000], ['Insurance', 28000], ['Repairs & Maintenance', 60000],
  ['Utilities', 25000], ['Capital Reserves', 20000], ['Administrative', 10000],
].map(([cat, amount]) => ({ cat, amount }));
const asList = (over = {}) => ({
  ...DEFS.multifamily, opexItems: LEGACY_AS_ITEMS.map((r) => ({ ...r })),
  propertyTax: 0, insurance: 0, maintenance: 0, utilities: 0, reserves: 0, administrative: 0,
  ...over,
});

console.log('the two shapes must agree exactly:');
{
  const legacy = DEFS.multifamily, listed = asList();
  check('same operating expense total', near(getOpEx(legacy), getOpEx(listed), 1e-9),
    `${getOpEx(legacy)} vs ${getOpEx(listed)}`);
  const a = buildPF(legacy), b = buildPF(listed);
  check('same NOI', a.rows[0].noi === b.rows[0].noi);
  check('same IRR', a.ret.irr === b.ret.irr);
  check('same equity multiple', a.ret.em === b.ret.em);
  check('same DSCR', a.sum.dscr === b.sum.dscr);
  check('every year identical', JSON.stringify(a.rows) === JSON.stringify(b.rows));
}

console.log('\nexactly one of the two shapes is ever counted:');
{
  // a hand-built payload could carry both; the list must win, never sum
  const both = { ...DEFS.multifamily, opexItems: LEGACY_AS_ITEMS.map((r) => ({ ...r })) };
  const listOnly = asList();
  check('list wins when both are present — no double count',
    near(getOpEx(both), getOpEx(listOnly), 1e-9), `${getOpEx(both)} vs ${getOpEx(listOnly)}`);
  check('the doubled figure is NOT what comes out',
    !near(getOpEx(both), getOpEx(DEFS.multifamily) + 238000, 1));
}

console.log('\nadding and removing lines does what it says:');
{
  const base = asList();
  const plus = asList({ opexItems: [...LEGACY_AS_ITEMS, { cat: 'Custom', label: 'Elevator Service', amount: 9000 }] });
  check('a custom line adds exactly its amount', near(getOpEx(plus) - getOpEx(base), 9000, 1e-9));
  const fewer = asList({ opexItems: LEGACY_AS_ITEMS.slice(0, 3) });
  check('removing lines removes exactly their amounts',
    near(getOpEx(base) - getOpEx(fewer), 25000 + 20000 + 10000, 1e-9));
  // an emptied list means zero entered, not "fall back to the old fields"
  const emptied = { ...DEFS.multifamily, opexItems: [{ cat: 'Property Taxes', amount: 0 }] };
  const mgmtOnly = buildPF(emptied).rows[0].mgmt;
  check('a list of zeros yields management fee only', near(getOpEx(emptied), mgmtOnly, 1e-6),
    `${getOpEx(emptied)} vs ${mgmtOnly}`);
}

console.log('\nmalformed line items cannot poison the total:');
const junk = [
  ['not an array', { opexItems: 'nope' }],
  ['null entries', { opexItems: [null, undefined, { cat: 'Insurance', amount: 1000 }] }],
  ['missing amount', { opexItems: [{ cat: 'Insurance' }] }],
  ['string amount', { opexItems: [{ cat: 'Insurance', amount: '1000' }] }],
  ['NaN amount', { opexItems: [{ cat: 'Insurance', amount: NaN }] }],
  ['Infinity amount', { opexItems: [{ cat: 'Insurance', amount: Infinity }] }],
  ['nested object amount', { opexItems: [{ cat: 'Insurance', amount: { x: 1 } }] }],
  ['empty list', { opexItems: [] }],
  ['primitives in the list', { opexItems: [1, 'two', true] }],
];
for (const [label, over] of junk) {
  const inp = { ...DEFS.multifamily, ...over };
  let threw = null, total = null, res = null;
  try { total = getOpEx(inp); res = buildPF(inp); } catch (e) { threw = e.message; }
  check(`${label}: no throw`, threw === null, threw);
  check(`${label}: total is finite`, Number.isFinite(total), String(total));
  check(`${label}: engine output stays finite`, !!res && Number.isFinite(res.rows[0].noi), String(res && res.rows[0].noi));
}
check('a string amount is read as a number', near(opexItemsTotal({ opexItems: [{ amount: '1000' }] }), 1000, 1e-9));
check('opexItemsTotal returns null when there is no list', opexItemsTotal({}) === null);

console.log('\ncapex sits below NOI, where it belongs:');
{
  const zero = buildPF(DEFS.multifamily);
  const cx = buildPF({ ...DEFS.multifamily, capexAnnual: 24000 });
  check('NOI is untouched', cx.rows[0].noi === zero.rows[0].noi);
  check('cap rate is untouched', cx.sum.capR === zero.sum.capR);
  check('DSCR is untouched — lenders size on NOI', cx.sum.dscr === zero.sum.dscr);
  check('expense ratio is untouched', cx.rows[0].expR === zero.rows[0].expR);
  check('cash flow drops by exactly the capex', near(zero.rows[0].cfbt - cx.rows[0].cfbt, 24000, 1e-6));
  check('cash-on-cash falls', cx.sum.coc < zero.sum.coc);
  check('IRR falls', cx.ret.irr < zero.ret.irr);
  check('break-even occupancy rises', cx.sum.beOcc > zero.sum.beOcc);
  check('capex grows with the expense rate',
    near(cx.rows[6].capex, 24000 * Math.pow(1 + DEFS.multifamily.expenseGrowth / 100, 6), 1));
  check('zero capex changes nothing at all',
    JSON.stringify(buildPF({ ...DEFS.multifamily, capexAnnual: 0 }).rows) === JSON.stringify(zero.rows));
}

console.log('\ncapex across every asset type and a hostile range:');
for (const name of Object.keys(DEFS)) {
  for (const v of [0, 1, 1000, 250000, -5000, 1e9]) {
    const inp = { ...DEFS[name], capexAnnual: v };
    let threw = null, res = null;
    try {
      res = buildPF(inp);
      calcWaterfall(res, { ...inp, waterfallEnabled: true });
      calcAfterTax(res, { ...inp, afterTax: true });
      dealHealth(res, inp);
    } catch (e) { threw = e.message; }
    check(`${name} capex ${v}: no throw`, threw === null, threw);
    if (res) check(`${name} capex ${v}: cash flow finite`, Number.isFinite(res.rows[0].cfbt), String(res.rows[0].cfbt));
  }
}

console.log('\nthe workbook must not disagree with the app:');
{
  const inp = asList({ capexAnnual: 24000 });
  const res = buildPF(inp);
  const wb = await buildWorkbook(res, inp);
  const pf = wb.getWorksheet('Annual Pro Forma');
  const num = (v) => (v && typeof v === 'object' && 'result' in v ? v.result : v);
  let capexRow = null, cfRow = null, noiRow = null;
  pf.eachRow({ includeEmpty: false }, (row, i) => {
    const l = String(row.getCell(2).value || '');
    if (l.includes('Capital Expenditure')) capexRow = i;
    if (l.includes('Cash Flow Before Tax')) cfRow = i;
    if (l.includes('Net Operating Income')) noiRow = i;
  });
  check('the sheet has a capex row', capexRow !== null);
  check('it is a live formula, not a pasted number',
    !!(pf.getCell(capexRow, 4).value || {}).formula);
  let mx = 0, mc = 0, mn = 0;
  for (let y = 1; y <= 7; y++) {
    mx = Math.max(mx, Math.abs(num(pf.getCell(capexRow, 3 + y).value) + res.rows[y - 1].capex));
    mc = Math.max(mc, Math.abs(num(pf.getCell(cfRow, 3 + y).value) - res.rows[y - 1].cfbt));
    mn = Math.max(mn, Math.abs(num(pf.getCell(noiRow, 3 + y).value) - res.rows[y - 1].noi));
  }
  check(`sheet capex matches the engine (max $${mx.toFixed(4)})`, mx < 0.01);
  check(`sheet cash flow matches the engine (max $${mc.toFixed(4)})`, mc < 0.01);
  check(`sheet NOI matches the engine (max $${mn.toFixed(4)})`, mn < 0.01);
  check('itemised expenses still reach the workbook total',
    near(num(pf.getCell(noiRow, 4).value), res.rows[0].noi, 0.01));
}

console.log('\nthe rest of the app survives both:');
{
  globalThis.window = { open: () => ({ document: { write() {}, close() {} } }) };
  for (const name of Object.keys(DEFS)) {
    const inp = { ...DEFS[name], capexAnnual: 18000, opexItems: [{ cat: 'Property Taxes', amount: 50000 }, { cat: 'Custom', label: 'Odd One', amount: 7000 }] };
    let threw = null;
    try {
      const res = buildPF(inp);
      generateMemo(res, inp); openMemo(res, inp);
      dealHealth(res, inp);
      await buildWorkbook(res, inp);
    } catch (e) { threw = e.message; }
    check(`${name}: memo, health and workbook all build`, threw === null, threw);
  }
}

console.log('\nsaved work and links carry the new shape:');
{
  const inp = asList({ capexAnnual: 24000 });
  const round = JSON.parse(JSON.stringify(inp));
  check('a list survives JSON round-trip intact', JSON.stringify(round.opexItems) === JSON.stringify(inp.opexItems));
  check('and recomputes to the same numbers',
    JSON.stringify(buildPF(round).rows) === JSON.stringify(buildPF(inp).rows));
  // draft autosave must see entered line items as real work
  check('an itemised deal counts as content worth saving', hasContent(inp) === true);
  check('a blank deal still counts as nothing',
    hasContent({ ...BLANKS.multifamily }) === false);
  check('an empty list is not mistaken for work',
    hasContent({ ...BLANKS.multifamily, opexItems: [] }) === false);
  check('capex alone counts as work',
    hasContent({ ...BLANKS.multifamily, capexAnnual: 5000 }) === true);
}

console.log('\nother income itemises the same way, with the same rules:');
{
  const base = DEFS.multifamily;                       // legacy: 12,000 in one box
  const listed = { ...base, otherIncome: 0, otherIncomeItems: [
    { cat: 'Laundry', amount: 7000 }, { cat: 'Parking', amount: 3000 }, { cat: 'Pet Rent & Fees', amount: 2000 }] };
  check('the two shapes total the same', getOtherIncome(base) === getOtherIncome(listed),
    `${getOtherIncome(base)} vs ${getOtherIncome(listed)}`);
  check('and produce identical years', JSON.stringify(buildPF(base).rows) === JSON.stringify(buildPF(listed).rows));
  check('list wins when both are present — no double count',
    getOtherIncome({ ...base, otherIncomeItems: [{ cat: 'Laundry', amount: 7000 }] }) === 7000);
  check('a custom line adds exactly its amount',
    getOtherIncome({ ...listed, otherIncomeItems: [...listed.otherIncomeItems, { cat: 'Custom', label: 'Billboard', amount: 4000 }] }) === 16000);
  check('an emptied list means zero, not a fallback to the old field',
    getOtherIncome({ ...base, otherIncomeItems: [{ cat: 'Laundry', amount: 0 }] }) === 0);
  check('no list at all still reads the legacy field', getOtherIncome({ otherIncome: 5000 }) === 5000);
  check('nothing anywhere is zero, not NaN', getOtherIncome({}) === 0);

  // it feeds EGI, so it must move NOI and the management fee with it
  const more = { ...base, otherIncome: 0, otherIncomeItems: [{ cat: 'Laundry', amount: 62000 }] };
  const d = buildPF(more).rows[0].egi - buildPF(base).rows[0].egi;
  check('extra other income raises EGI by exactly that amount', near(d, 50000, 1e-6), String(d));
  check('and therefore raises NOI', buildPF(more).rows[0].noi > buildPF(base).rows[0].noi);

  // malformed rows must not poison income any more than they poison expenses
  for (const [label, rows] of [
    ['not an array', 'nope'], ['null entries', [null, { cat: 'Laundry', amount: 100 }]],
    ['missing amount', [{ cat: 'Laundry' }]], ['NaN amount', [{ cat: 'Laundry', amount: NaN }]],
    ['Infinity amount', [{ cat: 'Laundry', amount: Infinity }]], ['primitives', [1, 'two', true]],
    ['empty list', []],
  ]) {
    const inp = { ...base, otherIncomeItems: rows };
    let threw = null, total = null, res = null;
    try { total = getOtherIncome(inp); res = buildPF(inp); } catch (e) { threw = e.message; }
    check(`other income ${label}: no throw`, threw === null, threw);
    check(`other income ${label}: total is finite`, Number.isFinite(total), String(total));
    check(`other income ${label}: engine stays finite`, !!res && Number.isFinite(res.rows[0].noi));
  }

  // and both lists at once, which is how a real itemised deal looks
  const fully = { ...asList({ capexAnnual: 12000 }), otherIncome: 0,
    otherIncomeItems: [{ cat: 'Laundry', amount: 7000 }, { cat: 'Storage', amount: 5000 }] };
  let threw = null, res = null;
  try { res = buildPF(fully); } catch (e) { threw = e.message; }
  check('a fully itemised deal builds', threw === null && !!res, threw);
  check('...with finite returns', Number.isFinite(res.ret.irr) || res.ret.irr === null);
  check('...and survives a JSON round-trip unchanged',
    JSON.stringify(buildPF(JSON.parse(JSON.stringify(fully))).rows) === JSON.stringify(res.rows));
  check('...and counts as draft-worthy work', hasContent(fully) === true);
}

console.log('\ncapex can be quoted three ways, and they must reconcile:');
{
  const base = { ...DEFS.multifamily, numUnits: 40 };
  const mk = (capexBasis, capexAnnual) => buildPF({ ...base, capexBasis, capexAnnual });
  const lump = mk('amount', 24000), per = mk('perUnit', 600), pct = mk('pctEGI', 3);

  check('$600/unit x 40 units equals the $24,000 lump in year 1',
    near(per.rows[0].capex, lump.rows[0].capex, 1e-6),
    `${per.rows[0].capex} vs ${lump.rows[0].capex}`);
  check('...and stays equal as both grow with expenses',
    near(per.rows[6].capex, lump.rows[6].capex, 1e-6));
  check('a percent basis reads off that year\'s EGI',
    near(pct.rows[0].capex, pct.rows[0].egi * 0.03, 1e-6),
    `${pct.rows[0].capex} vs ${pct.rows[0].egi * 0.03}`);
  check('...and therefore rides income rather than the expense rate',
    near(pct.rows[6].capex, pct.rows[6].egi * 0.03, 1e-6));
  check('all three still land below NOI', lump.rows[0].noi === pct.rows[0].noi
    && lump.sum.capR === pct.sum.capR && lump.sum.dscr === pct.sum.dscr);

  // an existing deal has no basis stored; it must behave exactly as before
  check('a deal with no basis behaves as a total budget',
    JSON.stringify(buildPF({ ...base, capexAnnual: 24000 }).rows)
    === JSON.stringify(mk('amount', 24000).rows));
  check('an unknown basis falls back to a total budget',
    JSON.stringify(buildPF({ ...base, capexAnnual: 24000, capexBasis: 'nonsense' }).rows)
    === JSON.stringify(mk('amount', 24000).rows));
  for (const b of ['amount', 'perUnit', 'pctEGI']) {
    check(`zero capex on the ${b} basis is still a no-op`,
      JSON.stringify(mk(b, 0).rows) === JSON.stringify(buildPF(base).rows));
  }
  // per-unit with no units must not silently invent a charge
  check('per-unit with zero units yields nothing',
    resolveCapex({ capexAnnual: 600, capexBasis: 'perUnit', numUnits: 0 }, 100000, 1) === 0);
  // malformed values
  for (const [label, over] of [
    ['NaN amount', { capexAnnual: NaN }], ['string amount', { capexAnnual: '600' }],
    ['negative', { capexAnnual: -500 }], ['null basis', { capexBasis: null }],
    ['huge percent', { capexAnnual: 500, capexBasis: 'pctEGI' }],
  ]) {
    const inp = { ...base, capexBasis: 'perUnit', capexAnnual: 600, ...over };
    let threw = null, res = null;
    try { res = buildPF(inp); } catch (e) { threw = e.message; }
    check(`capex ${label}: no throw`, threw === null, threw);
    check(`capex ${label}: cash flow finite`, !!res && Number.isFinite(res.rows[0].cfbt));
  }
}

console.log('\nline items can be quoted per unit or as a share of income:');
{
  const base = { ...DEFS.multifamily, numUnits: 40 };
  check('$300/unit/yr resolves to the annual figure', resolveLine({ amount: 300, basis: 'perUnitYr' }, 40, 0) === 12000);
  check('$25/unit/month resolves to the annual figure', resolveLine({ amount: 25, basis: 'perUnitMo' }, 40, 0) === 12000);
  check('4% of EGI resolves off the EGI given', resolveLine({ amount: 4, basis: 'pctEGI' }, 40, 700000) === 28000);
  check('no basis still means a plain annual amount', resolveLine({ amount: 9000 }, 40, 0) === 9000);
  check('an unknown basis falls back to a plain amount', resolveLine({ amount: 9000, basis: 'nonsense' }, 40, 0) === 9000);
  check('per-unit with no units yields nothing', resolveLine({ amount: 300, basis: 'perUnitYr' }, 0, 0) === 0);
  check('a malformed amount yields nothing', resolveLine({ amount: 'x', basis: 'perUnitYr' }, 40, 0) === 0);

  // the same expense expressed two ways must produce the same deal
  const flat = { ...base, opexItems: [{ cat: 'Repairs & Maintenance', amount: 12000 }],
    propertyTax: 0, insurance: 0, maintenance: 0, utilities: 0, reserves: 0, administrative: 0 };
  const perUnit = { ...flat, opexItems: [{ cat: 'Repairs & Maintenance', basis: 'perUnitYr', amount: 300 }] };
  check('an expense quoted per unit matches the same figure quoted flat',
    JSON.stringify(buildPF(perUnit).rows) === JSON.stringify(buildPF(flat).rows));

  const incFlat = { ...base, otherIncome: 0, otherIncomeItems: [{ cat: 'Laundry', amount: 12000 }] };
  const incPer = { ...incFlat, otherIncomeItems: [{ cat: 'Laundry', basis: 'perUnitMo', amount: 25 }] };
  check('income quoted per unit per month matches the same figure quoted flat',
    JSON.stringify(buildPF(incPer).rows) === JSON.stringify(buildPF(incFlat).rows));

  // a percent-of-EGI expense has to read the EGI the deal actually produces
  const pctExp = { ...flat, opexItems: [{ cat: 'Repairs & Maintenance', basis: 'pctEGI', amount: 4 }] };
  const r = buildPF(pctExp);
  check('a percent-of-EGI expense is computed off EGI', near(getOpEx(pctExp) - r.rows[0].mgmt, r.rows[0].egi * 0.04, 1));
}

console.log('\nvacancy and credit loss are separate deductions:');
{
  const base = DEFS.multifamily;                       // 5% vacancy, no credit loss
  const split = { ...base, vacancyRate: 4, creditLossRate: 1 };
  const a = buildPF(base), b = buildPF(split);
  check('4% + 1% gives the same EGI as a flat 5%', near(a.rows[0].egi, b.rows[0].egi, 1e-6));
  check('...and the same NOI', near(a.rows[0].noi, b.rows[0].noi, 1e-6));
  check('the two losses are reported separately', near(b.rows[0].vacL, b.rows[0].gpi * 0.04, 1e-6)
    && near(b.rows[0].credL, b.rows[0].gpi * 0.01, 1e-6));
  check('a deal saved before the split still has zero credit loss', a.rows[0].credL === 0);
  check('lossRate adds the two', near(lossRate({ vacancyRate: 4, creditLossRate: 1.5 }), 0.055, 1e-9));
  check('lossRate of a legacy deal is just vacancy', near(lossRate({ vacancyRate: 5 }), 0.05, 1e-9));
  check('lossRate copes with nothing at all', lossRate({}) === 0);
  check('lossRate ignores malformed values', lossRate({ vacancyRate: 'x', creditLossRate: NaN }) === 0);
  // credit loss must actually bite
  const heavy = buildPF({ ...base, creditLossRate: 3 });
  check('adding credit loss reduces EGI', heavy.rows[0].egi < a.rows[0].egi);
  check('...and NOI with it', heavy.rows[0].noi < a.rows[0].noi);
  for (const v of [0, 100, -5, 1e6]) {
    let threw = null, res = null;
    try { res = buildPF({ ...base, creditLossRate: v }); } catch (e) { threw = e.message; }
    check(`credit loss ${v}: no throw`, threw === null, threw);
    check(`credit loss ${v}: finite`, !!res && Number.isFinite(res.rows[0].egi));
  }
}

if (failures) { console.log(`\n${failures} FAILURE(S) — itemised expenses or capex regressed.`); process.exit(1); }
console.log('\nItemised expenses and capex behave correctly and change nothing that used to work.');
