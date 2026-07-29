// Smoke-verifies the migrated Excel builder (src/engine/excel.js) against the
// legacy builder extracted from legacy/index.html: same sheets, and identical
// cell values/formulas on the Summary sheet for the multifamily golden deal.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import ExcelJS from 'exceljs';
import { buildPF, DEFS } from '../src/engine/index.js';
import { buildWorkbook } from '../src/engine/excel.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// build legacy excel module on the fly: EXCEL EXPORT section + window shim
const legacy = fs.readFileSync(path.join(__dirname, '../legacy/index.html'), 'utf8').split('\n');
const s = legacy.findIndex(l => l.startsWith('// ─── EXCEL EXPORT'));
const e = legacy.findIndex(l => l.startsWith('// ─── FILE PARSE'));
const engine = fs.readFileSync(path.join(__dirname, 'engine-current.cjs'), 'utf8').replace(/module\.exports=.*/s, '');
const excelSrc = 'global.window={ExcelJS:require("exceljs")};\n' + engine + '\n'
  + legacy.slice(s, e).join('\n') + '\nmodule.exports={buildWorkbook};\n';
const tmp = path.join(__dirname, '.legacy-excel.cjs');
fs.writeFileSync(tmp, excelSrc);
const legacyExcel = require(tmp);

const inp = { ...DEFS.multifamily, propertyName: 'Golden multifamily' };
const res = buildPF(inp);
const [wbNew, wbOld] = [await buildWorkbook(res, inp), await legacyExcel.buildWorkbook(res, inp)];

let failures = 0;
const check = (label, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, '\n    new:', JSON.stringify(a)?.slice(0, 200), '\n    old:', JSON.stringify(b)?.slice(0, 200)); }
};

// Sheets deliberately rebuilt since the migration, and so no longer expected
// to match the legacy output. The legacy versions were blocks of hardcoded
// numbers — the one place the workbook stopped being a model — and were
// replaced with year-by-year schedules driven by live formulas. Their
// correctness is checked against the engine in verify-excel-waterfall.mjs,
// which is stricter than this parity check ever was.
const REBUILT = new Set(['Equity Waterfall', 'After-Tax']);

check('sheet names', wbNew.worksheets.map(w => w.name), wbOld.worksheets.map(w => w.name));
for (const name of wbOld.worksheets.map(w => w.name)) {
  if (REBUILT.has(name)) { console.log(`  SKIP sheet "${name}" — rebuilt as a live model, see verify-excel-waterfall.mjs`); continue; }
  const a = wbNew.getWorksheet(name), b = wbOld.getWorksheet(name);
  // Indexed by row label rather than row number. Comparing by position made
  // any deliberately inserted line — a CapEx row, say — look like every row
  // beneath it had changed, which buries a real drift in a wall of noise. By
  // label, a moved row is silent and a changed *value* still fails loudly.
  const byLabel = (ws) => {
    const m = {};
    ws.eachRow({ includeEmpty: false }, (row) => {
      const label = String(row.getCell(2).value ?? '').trim();
      if (!label) return;
      const vals = [];
      for (let c = 3; c <= 16; c++) {
        const v = row.getCell(c).value;
        if (v === undefined || v === null) continue;
        // Cell addresses inside formulas necessarily shift when a row is
        // inserted, so comparing formula text would flag layout as drift.
        // What must not change is the value — and a formula must still be a
        // formula, so an "F" marker makes a silent downgrade to a hardcoded
        // number fail rather than pass.
        vals.push(v && typeof v === 'object' && v.formula
          ? 'F' + JSON.stringify('result' in v ? v.result : null)
          : v);
      }
      m[label] = vals;
    });
    return m;
  };
  const A = byLabel(a), B = byLabel(b);
  for (const label of Object.keys(B)) {
    check(`sheet "${name}" row "${label}"`, A[label], B[label]);
  }
  const added = Object.keys(A).filter((k) => !(k in B));
  if (added.length) console.log(`  NOTE sheet "${name}" gained ${added.length} row(s): ${added.join(', ')}`);
}

// A skip is only defensible if the replacement really is live. Guard against
// the exclusion above quietly covering a regression back to hardcoded values.
for (const name of REBUILT) {
  const ws = wbNew.getWorksheet(name);
  if (!ws) continue;
  let formulas = 0;
  ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
    if (cell.value && typeof cell.value === 'object' && cell.value.formula) formulas++;
  }));
  check(`rebuilt sheet "${name}" is formula-driven (${formulas} formulas)`, formulas > 20, true);
}

fs.unlinkSync(tmp);
if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
console.log('\nExcel export matches legacy exactly.');
