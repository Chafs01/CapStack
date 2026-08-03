// A one-time renovation budget, and the one-time capex basis beside it.
//
// Three things carry real risk. The first is double-counting the money: cash
// spent in year two is inside the cash flow line AND inside total equity, and
// a careless profit figure subtracts it twice. The second is the boundary with
// the annual CapEx reserve — a rehab must not recur, and the reserve must not
// stop recurring. The third is that every deal that has no renovation has to
// compute exactly as it did before this existed, down to the last cent.
import { DEFS, buildPF, calcAfterTax } from '../src/engine/index.js';
import { getRehab, rehabSchedule, resolveCapex } from '../src/engine/income.js';
const BLANKS_LIKE = { assetType: 'Multifamily', numUnits: 0, avgRent: 0, purchasePrice: 0, holdingPeriod: 7 };
import { buildWorkbook } from '../src/engine/excel.js';
import { memoHTML } from '../src/engine/memo.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const base = () => ({ ...DEFS.multifamily });
// $12,500 a door across 40 units, plus a $180K roof — a plausible value-add.
const SCOPE = [
  { cat: 'Unit Turns / Interiors', basis: 'perUnit', amount: 12500 },
  { cat: 'Roof', amount: 180000 },
];
const withRehab = (over = {}) => ({ ...base(), rehabItems: SCOPE.map((r) => ({ ...r })), ...over });

console.log('a deal with no renovation is untouched:');
{
  const plain = buildPF(base());
  for (const variant of [{}, { rehabItems: [] }, { rehabItems: [], rehabFinancedPct: 40, rehabMonths: 18 }]) {
    const r = buildPF({ ...base(), ...variant });
    check(`identical rows (${JSON.stringify(variant)})`, JSON.stringify(r.rows) === JSON.stringify(plain.rows));
    check(`identical IRR (${JSON.stringify(variant)})`, r.ret.irr === plain.ret.irr);
    check(`identical equity (${JSON.stringify(variant)})`, r.equity === plain.equity);
  }
  check('financing % and months alone move nothing', buildPF({ ...base(), rehabFinancedPct: 100, rehabMonths: 24 }).ret.irr === plain.ret.irr);
  check('equityAtClose equals equity with no rehab', plain.equityAtClose === plain.equity);
}

console.log('the budget resolves the way the lines are quoted:');
{
  const total = getRehab(withRehab());
  check('per-unit and lump sum add up', near(total, 12500 * 40 + 180000), String(total));
  check('development ignores it — it has its own budget',
    getRehab({ ...DEFS.development, rehabItems: SCOPE }) === 0);
  check('affordable ignores it too',
    getRehab({ ...DEFS.affordable, rehabItems: SCOPE }) === 0);
  check('absent list is zero, not NaN', getRehab(base()) === 0);
}

console.log('the spend schedule lands in the right years:');
{
  const s0 = rehabSchedule({ rehabMonths: 0 }, 600000);
  check('0 months spends at close', s0[0] === 600000 && s0[1] === 0);
  const s12 = rehabSchedule({ rehabMonths: 12 }, 600000);
  check('12 months is all year 1', s12[0] === 0 && near(s12[1], 600000));
  const s18 = rehabSchedule({ rehabMonths: 18 }, 600000);
  check('18 months splits 12/6', s18[0] === 0 && near(s18[1], 400000) && near(s18[2], 200000));
  check('18 months totals the whole budget', near(s18.reduce((a, b) => a + b, 0), 600000));
  check('a negative month count cannot conjure money',
    near(rehabSchedule({ rehabMonths: -5 }, 600000).reduce((a, b) => a + b, 0), 600000));
}

console.log('money is counted once and only once:');
{
  const r = buildPF(withRehab({ rehabMonths: 18 }));
  const total = 12500 * 40 + 180000;
  check('total cost carries the budget', near(r.totalCost - buildPF(base()).totalCost, total));
  check('equity carries it too (unfinanced)', near(r.equity - buildPF(base()).equity, total));
  check('deferred is the part spent after close', near(r.rehab.deferred, total));
  check('equityAtClose excludes the deferred part', near(r.equityAtClose, r.equity - total));
  // the identity that matters: money in equals money out, however it is timed
  const gross = r.rows.slice(0, 7).reduce((s, x) => s + x.cfbt + x.rehab, 0);
  check('profit reconciles to gross flows minus total equity',
    near(r.ret.profit, gross + r.exit.proceeds - r.equity, 1));
  check('the multiple uses total capital invested',
    near(r.ret.em, (gross + r.exit.proceeds) / r.equity, 1e-9));
}

console.log('renovation sits below NOI, like capex:');
{
  const plain = buildPF(base()), r = buildPF(withRehab({ rehabMonths: 12 }));
  check('NOI untouched', r.rows[0].noi === plain.rows[0].noi);
  check('DSCR untouched', r.rows[0].dscr === plain.rows[0].dscr);
  check('going-in cap rate untouched', r.rows[0].capR === plain.rows[0].capR);
  check('year 1 cash flow absorbs it', near(plain.rows[0].cfbt - r.rows[0].cfbt, 12500 * 40 + 180000));
  check('year 2 is clear of it', r.rows[1].rehab === 0);
}

console.log('financing moves it from equity to the loan:');
{
  const total = 12500 * 40 + 180000;
  const cash = buildPF(withRehab());
  const fin = buildPF(withRehab({ rehabFinancedPct: 100 }));
  // Equity falls by the whole budget less the fee the lender charges on the
  // bigger loan — that fee is new money out of pocket, so it lands back in
  // equity. Asserted as the exact identity rather than a loose tolerance,
  // because a wrong fee base is precisely the bug worth catching here.
  check('equity falls by the financed amount, net of the fee on it',
    near(cash.equity - fin.equity, total - (fin.LF - cash.LF)),
    `${cash.equity - fin.equity} vs ${total - (fin.LF - cash.LF)}`);
  check('the loan grew by exactly the budget',
    near((fin.totalCost - fin.equity) - (cash.totalCost - cash.equity), total));
  check('loan fees are taken on the larger loan', fin.LF > cash.LF);
  check('half financed sits between the two',
    buildPF(withRehab({ rehabFinancedPct: 50 })).equity < cash.equity);
  check('a nonsense percentage is clamped, not obeyed',
    buildPF(withRehab({ rehabFinancedPct: 999 })).rehab.pctFinanced === 100);
}

console.log('renovation capitalises into the depreciable basis:');
{
  const r = buildPF(withRehab());
  const a = calcAfterTax(r, r.inp), b = calcAfterTax(buildPF(base()), base());
  check('depreciable basis grew by the budget', near(a.deprBasis - b.deprBasis, 12500 * 40 + 180000));
}

console.log('one-time capex is spent once:');
{
  const once = buildPF({ ...base(), capexAnnual: 150000, capexBasis: 'once' });
  check('year 1 carries it', near(once.rows[0].capex, 150000));
  check('year 2 does not', once.rows[1].capex === 0);
  check('year 7 does not', once.rows[6].capex === 0);
  const annual = buildPF({ ...base(), capexAnnual: 150000, capexBasis: 'amount' });
  check('the annual basis still recurs and grows', annual.rows[1].capex > 150000);
  check('NOI is untouched by either', once.rows[0].noi === annual.rows[0].noi);
  check('resolveCapex defaults to year 1 for callers that omit it',
    resolveCapex({ capexAnnual: 150000, capexBasis: 'once' }, 0, 1) === 150000);
}

console.log('yield on cost answers whether the work was worth doing:');
{
  const plain = buildPF(base());
  // with no renovation it is simply the all-in cap rate, and it must sit below
  // the going-in cap rate because the denominator carries costs the price does not
  check('no renovation: measured from Year 1', plain.sum.stabYear === 1);
  check('no renovation: below the going-in cap rate', plain.sum.yoc < plain.sum.capR);
  check('no renovation: equals Year 1 NOI over all-in cost',
    near(plain.sum.yoc, plain.rows[0].noi / plain.totalCost, 1e-12));
  check('going-in and stabilised agree when nothing is spent',
    near(plain.sum.yoc, plain.sum.yocGoingIn, 1e-12));

  // an 18-month scope spans years 1 and 2, so year 3 is the first clean one
  const r = buildPF(withRehab({ rehabMonths: 18 }));
  check('renovation: stabilised year is the first with no spend', r.sum.stabYear === 3);
  check('renovation: uses that year\'s NOI', near(r.sum.yoc, r.rows[2].noi / r.totalCost, 1e-12));
  check('renovation: denominator includes the budget', r.totalCost > plain.totalCost);
  check('renovation: going-in still measures Year 1',
    near(r.sum.yocGoingIn, r.rows[0].noi / r.totalCost, 1e-12));
  // spending without raising rents must lower the yield — that is the warning
  check('spending money without raising rents lowers the yield', r.sum.yoc < plain.sum.yoc);
  // and raising rents to match must lift it back above
  const lifted = buildPF(withRehab({ rehabMonths: 18, avgRent: base().avgRent * 1.25,
    unitMix: base().unitMix.map((u) => ({ ...u, rent: Math.round(u.rent * 1.25) })) }));
  check('...and raising them lifts it', lifted.sum.yoc > plain.sum.yoc);

  check('spread is measured against the exit cap',
    near(r.sum.yocSpread, r.sum.yoc - (r.inp.exitCapRate / 100), 1e-12));
  check('a comp-priced exit has no yield to compare against',
    buildPF({ ...base(), exitMethod: 'ppu', exitPPU: 200000 }).sum.yocSpread === null);
  check('a zero-cost deal does not divide by zero',
    buildPF({ ...BLANKS_LIKE }).sum.yoc === 0);
}

console.log('the exports carry it without crashing:');
{
  const r = buildPF(withRehab({ rehabMonths: 18, rehabFinancedPct: 40 }));
  const memo = memoHTML(r, r.inp, {});
  check('memo names the renovation section', /Renovation/.test(memo));
  check('memo states the spend period', /18 months from closing/.test(memo));
  check('memo states the financed share', /40% = /.test(memo));
  check('memo itemises the scope', /Unit Turns/.test(memo) && /Roof/.test(memo));
  check('a turnkey memo has no renovation group',
    !/Renovation/.test(memoHTML(buildPF(base()), base(), {})));
  await buildWorkbook(r, r.inp).then(
    (wb) => {
      const pf = wb.getWorksheet('Annual Pro Forma');
      let found = null;
      pf.eachRow((row) => { if (String(row.getCell(2).value).includes('Less: Renovation')) found = row; });
      check('workbook has a renovation line', !!found);
      if (found) check('and its year-1 figure matches the engine',
        near(Math.abs(+found.getCell(4).value), r.rows[0].rehab, 1));
      const sum = wb.getWorksheet('Summary');
      let uses = false;
      sum.eachRow((row) => { row.eachCell((c) => { if (String(c.value) === 'Renovation') uses = true; }); });
      check('sources & uses lists it', uses);
    },
    (e) => check('workbook builds', false, String(e)),
  );
  // and the untouched case must still produce a workbook with no such line
  const plain = buildPF(base());
  await buildWorkbook(plain, plain.inp).then((wb) => {
    const pf = wb.getWorksheet('Annual Pro Forma');
    let found = false;
    pf.eachRow((row) => { if (String(row.getCell(2).value).includes('Renovation')) found = true; });
    check('a turnkey deal has no renovation line at all', !found);
  });
}

console.log(failures === 0
  ? 'A one-time renovation is counted once, lands in the year it is spent, and changes nothing for a turnkey deal.'
  : `${failures} FAILURE(S) — renovation budget is wrong.`);
process.exit(failures === 0 ? 0 : 1);
