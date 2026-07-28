// The waterfall sheet was the one place the workbook stopped being a model:
// hardcoded outputs, so changing the promote or a hurdle in Excel did nothing.
// It is now a year-by-year tier allocation built from the structure inputs.
//
// Two things have to hold, and the second is the one that actually protects
// the user:
//   1. the sheet's cached numbers match the engine, and
//   2. the formulas are wired to the input cells — a formula pointing at the
//      wrong cell still shows the right cached number until someone edits an
//      assumption, at which point the workbook quietly lies.
import { DEFS, buildPF, calcWaterfall, calcAfterTax } from '../src/engine/index.js';
import { buildWorkbook } from '../src/engine/excel.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};
const num = (v) => (v && typeof v === 'object' && 'result' in v ? v.result : v);
const formulaOf = (c) => (c && typeof c === 'object' && c.formula ? c.formula : null);
const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

const COL = { yr: 2, cash: 3, b1: 4, b2: 5, b3: 6, t1: 7, t2: 8, t3: 9, resid: 10, lp: 11, gp: 12, e1: 13, e2: 14, e3: 15 };

for (const key of ['multifamily', 'commercial', 'residential', 'mixed-use']) {
  console.log(`${key}:`);
  const inp = { ...DEFS[key], waterfallEnabled: true };
  const res = buildPF(inp);
  const W = calcWaterfall(res, inp);
  const hp = Math.min(Math.max(inp.holdingPeriod || 7, 1), 10);
  const wb = await buildWorkbook(res, inp);
  const ws = wb.getWorksheet('Equity Waterfall');
  check('the sheet exists', !!ws);
  if (!ws) continue;

  // locate the table by its header rather than a hardcoded row
  let hdrRow = null;
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (String(row.getCell(COL.lp).value).includes('LP Distribution')) hdrRow = i;
  });
  check('the distribution table is present', hdrRow !== null);
  if (hdrRow === null) continue;
  const r0 = hdrRow + 1; // year 0

  // ── 1. the numbers agree with the engine ──────────────────────────────
  let maxLP = 0, maxGP = 0, maxCash = 0;
  for (let y = 1; y <= hp; y++) {
    const row = r0 + y;
    maxLP = Math.max(maxLP, Math.abs(num(ws.getCell(row, COL.lp).value) - W.lpDist[y - 1]));
    maxGP = Math.max(maxGP, Math.abs(num(ws.getCell(row, COL.gp).value) - W.gpDist[y - 1]));
    const engineCash = Math.max(0, res.rows[y - 1].cfbt + (y === hp ? res.exit.proceeds : 0));
    maxCash = Math.max(maxCash, Math.abs(num(ws.getCell(row, COL.cash).value) - engineCash));
  }
  check(`per-year LP distributions match the engine (max diff $${maxLP.toFixed(4)})`, maxLP < 0.01);
  check(`per-year GP distributions match the engine (max diff $${maxGP.toFixed(4)})`, maxGP < 0.01);
  check(`partnership cash matches levered cash flow (max diff $${maxCash.toFixed(4)})`, maxCash < 0.01);

  // year 0 is the capital call, and is what makes IRR() work over the column
  check('year 0 shows LP capital going out', near(num(ws.getCell(r0, COL.lp).value), -W.lpEq));
  check('year 0 shows GP capital going out', near(num(ws.getCell(r0, COL.gp).value), -W.gpEq));
  check('year 0 hurdle balances start at LP contributed capital',
    near(num(ws.getCell(r0, COL.e1).value), W.lpEq) && near(num(ws.getCell(r0, COL.e3).value), W.lpEq));

  // internal consistency: LP + GP must exhaust the partnership cash each year
  let split = 0;
  for (let y = 1; y <= hp; y++) {
    const row = r0 + y;
    split = Math.max(split, Math.abs(
      num(ws.getCell(row, COL.lp).value) + num(ws.getCell(row, COL.gp).value) - num(ws.getCell(row, COL.cash).value)));
  }
  check(`LP + GP equals partnership cash every year (max diff $${split.toFixed(4)})`, split < 0.01);

  // ── 2. the formulas are actually wired, not decorative ────────────────
  const y1 = r0 + 1;
  const cashF = formulaOf(ws.getCell(y1, COL.cash).value);
  check('partnership cash reads the Annual Pro Forma cash flow row',
    !!cashF && /Annual Pro Forma/.test(cashF) && /MAX\(0,/.test(cashF), cashF);

  const b1F = formulaOf(ws.getCell(y1, COL.b1).value);
  check('the pref hurdle balance accrues off the prior year and the pref input',
    !!b1F && /\*\(1\+\$C\$\d+\)/.test(b1F) && new RegExp(`M${r0}\\b`).test(b1F.replace(/\$/g, '')), b1F);

  const lpF = formulaOf(ws.getCell(y1, COL.lp).value);
  check('the LP distribution is built from the tier splits, not a constant',
    !!lpF && (lpF.match(/\$C\$\d+/g) || []).length >= 4, lpF);

  const gpF = formulaOf(ws.getCell(y1, COL.gp).value);
  check('the GP distribution is the residual of partnership cash',
    !!gpF && /^[A-Z]+\d+-[A-Z]+\d+$/.test(gpF.replace(/\$/g, '')), gpF);

  const endF = formulaOf(ws.getCell(y1, COL.e1).value);
  check('the ending hurdle balance nets off the LP distribution',
    !!endF && /-/.test(endF), endF);

  // every intermediate column in every year must be a formula
  let hard = 0;
  for (let y = 1; y <= hp; y++) {
    for (const c of [COL.cash, COL.b1, COL.b2, COL.b3, COL.t1, COL.t2, COL.t3, COL.resid, COL.lp, COL.gp, COL.e1, COL.e2, COL.e3]) {
      if (!formulaOf(ws.getCell(r0 + y, c).value)) hard++;
    }
  }
  check('no hardcoded values in the distribution table', hard === 0, `${hard} static cells`);

  // ── 3. the partner result block is derived, not pasted ────────────────
  const texts = {};
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    const l = row.getCell(2).value;
    if (typeof l === 'string' && texts[l.trim()] === undefined) texts[l.trim()] = { row: i, cell: row.getCell(3).value };
  });
  check('total distributions is a SUM over the table',
    /^SUM\(/.test(formulaOf(texts['Total distributions'] && texts['Total distributions'].cell) || ''),
    formulaOf(texts['Total distributions'] && texts['Total distributions'].cell));
  check('IRR is Excel\'s IRR over the distribution column',
    /IRR\(/.test(formulaOf(texts['IRR'] && texts['IRR'].cell) || ''),
    formulaOf(texts['IRR'] && texts['IRR'].cell));
  check('equity multiple divides distributions by contributions',
    /\//.test(formulaOf(texts['Equity multiple'] && texts['Equity multiple'].cell) || ''));
  check('LP total matches the engine',
    near(num(texts['Total distributions'].cell), W.lpTot, 0.02), String(num(texts['Total distributions'].cell)));
  check('GP promote is a formula, not a pasted figure',
    /MAX\(0,/.test(formulaOf(texts['GP take above pro-rata'] && texts['GP take above pro-rata'].cell) || ''));

  // structure inputs must be plain editable numbers, or nothing is adjustable
  check('LP equity share is an editable input',
    typeof texts['LP equity share'].cell === 'number' && near(texts['LP equity share'].cell, W.lpShare, 1e-9));
  check('preferred return is an editable input',
    typeof texts['Preferred return'].cell === 'number' && near(texts['Preferred return'].cell, W.pref, 1e-9));
  check('LP equity contributed is derived from total equity and the share',
    /\*/.test(formulaOf(texts['LP equity contributed'].cell) || ''));
  console.log('');
}

console.log('waterfall is omitted when the module is off:');
{
  const inp = { ...DEFS.multifamily, waterfallEnabled: false };
  const wb = await buildWorkbook(buildPF(inp), inp);
  check('no Equity Waterfall sheet', !wb.worksheets.map((w) => w.name).includes('Equity Waterfall'));
}

// The After-Tax sheet had the identical defect and was rebuilt the same way.
console.log('\nafter-tax sheet is a live schedule:');
const ATC = { yr: 2, noi: 3, int: 4, dep: 5, acc: 6, ti: 7, tx: 8, pre: 9, at: 10 };
for (const key of ['multifamily', 'commercial', 'residential']) {
  const inp = { ...DEFS[key], afterTax: true };
  const res = buildPF(inp);
  const A = calcAfterTax(res, inp);
  const hp = Math.min(Math.max(inp.holdingPeriod || 7, 1), 10);
  const wb = await buildWorkbook(res, inp);
  const ws = wb.getWorksheet('After-Tax');
  check(`${key}: sheet exists`, !!ws);
  if (!ws) continue;
  let hdr = null;
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (String(row.getCell(ATC.at).value).includes('After-Tax Cash Flow')) hdr = i;
  });
  check(`${key}: annual schedule is present`, hdr !== null);
  if (hdr === null) continue;
  const t0 = hdr + 1;

  let mInt = 0, mDep = 0, mTax = 0, mAT = 0, hard = 0;
  for (let y = 1; y <= hp; y++) {
    const row = t0 + y, e = A.yrRows[y - 1];
    mInt = Math.max(mInt, Math.abs(num(ws.getCell(row, ATC.int).value) - e.interest));
    mDep = Math.max(mDep, Math.abs(num(ws.getCell(row, ATC.dep).value) - e.dep));
    mTax = Math.max(mTax, Math.abs(num(ws.getCell(row, ATC.tx).value) - e.tax));
    mAT = Math.max(mAT, Math.abs(num(ws.getCell(row, ATC.at).value) - e.atcf));
    for (const c of [ATC.noi, ATC.int, ATC.dep, ATC.acc, ATC.ti, ATC.tx, ATC.pre, ATC.at]) {
      if (!formulaOf(ws.getCell(row, c).value)) hard++;
    }
  }
  check(`${key}: interest matches the engine (max $${mInt.toFixed(4)})`, mInt < 0.01);
  check(`${key}: depreciation matches, including the basis cap (max $${mDep.toFixed(4)})`, mDep < 0.01);
  check(`${key}: income tax matches (max $${mTax.toFixed(4)})`, mTax < 0.01);
  check(`${key}: after-tax cash flow matches (max $${mAT.toFixed(4)})`, mAT < 0.01);
  check(`${key}: no hardcoded values in the schedule`, hard === 0, `${hard} static cells`);

  const byLabel = {};
  ws.eachRow({ includeEmpty: false }, (row) => {
    const l = row.getCell(2).value;
    if (typeof l === 'string' && byLabel[l.trim()] === undefined) byLabel[l.trim()] = row.getCell(3).value;
  });
  check(`${key}: sale tax matches the engine`, near(num(byLabel['Total tax on sale']), A.saleTax, 0.02));
  check(`${key}: after-tax proceeds match the engine`, near(num(byLabel['After-tax sale proceeds']), A.atProceeds, 0.02));
  check(`${key}: tax rates are editable inputs`,
    typeof byLabel['Ordinary income tax rate'] === 'number'
    && typeof byLabel['Capital gains rate'] === 'number'
    && typeof byLabel['Depreciation period (years)'] === 'number');
  check(`${key}: depreciable basis is derived, not pasted`,
    /MAX\(0,/.test(formulaOf(byLabel['Depreciable basis']) || ''));
  check(`${key}: recapture is capped at accumulated depreciation`,
    /MIN\(/.test(formulaOf(byLabel['Depreciation recapture tax']) || ''));
  check(`${key}: NOI reads the pro forma rather than repeating a number`,
    /Annual Pro Forma/.test(formulaOf(ws.getCell(t0 + 1, ATC.noi).value) || ''));
}
{
  const inp = { ...DEFS.multifamily, afterTax: false };
  const wb = await buildWorkbook(buildPF(inp), inp);
  check('no After-Tax sheet when the module is off', !wb.worksheets.map((w) => w.name).includes('After-Tax'));
}

if (failures) { console.log(`\n${failures} FAILURE(S) — the waterfall sheet regressed.`); process.exit(1); }
console.log('\nThe waterfall sheet is a live model and agrees with the engine.');
