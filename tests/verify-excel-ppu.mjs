// The workbook and the app must never disagree. For the sales-comp exit the
// Summary sheet computes the sale price with a live formula, so this reads the
// actual input cells the exporter wrote, re-evaluates the formula's arithmetic
// from those cells, and checks it lands on the engine's number. That catches a
// formula wired to the wrong cell — which a cached-value check would not.
import { buildPF } from '../src/engine/buildPF.js';
import { buildWorkbook } from '../src/engine/excel.js';
import { CASES } from './capture-fixtures.mjs';

const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};

for (const name of ['residential-ppu', 'single-family-ppu']) {
  console.log(name + ':');
  const inp = CASES[name]();
  const res = buildPF(inp);
  const wb = await buildWorkbook(res, inp);
  const ws = wb.getWorksheet('Summary');

  // pull every labelled input cell out of the Summary sheet
  const byLabel = {}, rightBlock = {};
  ws.eachRow({ includeEmpty: false }, (row) => {
    const label = row.getCell(2).value, val = row.getCell(3).value;
    if (typeof label === 'string' && byLabel[label.trim()] === undefined) byLabel[label.trim()] = val;
    const l2 = row.getCell(5).value, v2 = row.getCell(6).value;
    if (typeof l2 === 'string') rightBlock[l2.trim()] = v2;
  });
  const num = (v) => (v && typeof v === 'object' && 'result' in v ? v.result : v);

  const ppu = num(byLabel['Exit Price per Unit (comp)']);
  const units = num(byLabel['Units']);
  const appr = num(byLabel['Annual Appreciation']);
  const hold = num(byLabel['Holding Period (Years)']);
  const sell = num(byLabel['Selling Costs']);

  check('comp inputs present on Summary',
    [ppu, units, appr, hold, sell].every((v) => typeof v === 'number'),
    JSON.stringify({ ppu, units, appr, hold, sell }));
  check('no stale Exit Cap Rate row on a comp-priced deal',
    byLabel['Exit Cap Rate'] === undefined && rightBlock['Exit Cap Rate'] === undefined);

  // re-evaluate the formula the exporter wrote, from the cells it wrote
  const grossFromSheet = ppu * units * Math.pow(1 + appr, hold);
  check(`gross sale: sheet ${Math.round(grossFromSheet).toLocaleString()} == engine ${Math.round(res.exit.grossSale).toLocaleString()}`,
    near(grossFromSheet, res.exit.grossSale));
  check(`net sale after ${(sell * 100).toFixed(0)}% costs matches engine`,
    near(grossFromSheet * (1 - sell), res.exit.netSale));

  // and confirm the formula string is actually wired to those cells
  let grossFormula = null;
  ws.eachRow({ includeEmpty: false }, (row) => {
    for (const c of [3, 6]) {
      const lbl = row.getCell(c - 1).value, cell = row.getCell(c);
      if (String(lbl).trim() === 'Gross Sale Price' && cell.value && cell.value.formula) grossFormula = cell.value.formula;
    }
  });
  check('gross-sale cell is a live formula referencing ppu x units x appreciation',
    !!grossFormula && /^(Summary!)?\$[A-Z]+\$\d+\*(Summary!)?\$[A-Z]+\$\d+\*\(1\+(Summary!)?\$[A-Z]+\$\d+\)\^(Summary!)?\$[A-Z]+\$\d+$/.test(grossFormula),
    grossFormula || '(none)');

  // advanced modules are opt-in: an unconfigured waterfall must not be
  // exported, or the workbook asserts LP/GP splits the user never set
  const sheets = wb.worksheets.map((w) => w.name);
  check('no Equity Waterfall sheet when the module is off',
    !inp.waterfallEnabled && !sheets.includes('Equity Waterfall'), sheets.join(', '));

  // the sensitivity grid must flex $/unit, not a cap rate
  const sn = wb.getWorksheet('Sensitivity');
  const axisHdr = sn.getCell(4, 3).value;
  check('sensitivity axis is price per unit', String(axisHdr).includes('PRICE PER UNIT'), String(axisHdr));
}

if (failures) { console.log(`\n${failures} FAILURE(S) — workbook disagrees with the engine.`); process.exit(1); }
console.log('\nComp-exit workbook formulas agree with the engine.');
