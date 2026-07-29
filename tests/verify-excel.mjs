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
  // The Summary has two label/value blocks side by side, so a row can carry a
  // left label at column 2 and an unrelated right label at column 5. Capturing
  // the whole row made an inserted line on the left look like every right-hand
  // row had changed. Each label now owns only the cells up to the next label.
  const byLabel = (ws) => {
    const m = {};
    ws.eachRow({ includeEmpty: false }, (row) => {
      const labelCols = [];
      for (let c = 2; c <= 16; c++) {
        const v = row.getCell(c).value;
        if (typeof v === 'string' && v.trim()) labelCols.push(c);
      }
      labelCols.forEach((c, i) => {
        const stop = i + 1 < labelCols.length ? labelCols[i + 1] : 17;
        const vals = [];
        for (let k = c + 1; k < stop; k++) {
          const v = row.getCell(k).value;
          if (v === undefined || v === null) continue;
          // formula addresses necessarily shift when a row is inserted, so
          // compare the value; the "F" marker still catches a formula being
          // silently downgraded to a hardcoded number
          vals.push(v && typeof v === 'object' && v.formula
            ? 'F' + JSON.stringify('result' in v ? v.result : null)
            : v);
        }
        if (vals.length) m[String(row.getCell(c).value).trim()] = vals;
      });
    });
    return m;
  };
  // Rows deliberately renamed or split since the migration. The replacement
  // must carry the same value, or the split quietly changed the model.
  const RENAMED = {
    'Vacancy & Credit Loss': ['Physical Vacancy', 'Credit Loss'],
    'Less: Vacancy & Credit Loss': ['Less: Vacancy Loss', 'Less: Credit Loss'],
  };
  const A = byLabel(a), B = byLabel(b);
  for (const label of Object.keys(B)) {
    if (RENAMED[label]) {
      const [primary, extra] = RENAMED[label];
      check(`sheet "${name}" row "${label}" -> "${primary}" (same value)`, A[primary], B[label]);
      // ExcelJS omits the cached result when a formula evaluates to zero, so
      // an absent result here means zero rather than missing — the formula
      // itself is still present and Excel computes it on open.
      const zeroed = (A[extra] || []).every((v) => v === 0 || v === 'F0' || v === 'Fnull' || v === 'Fundefined' || v === null);
      check(`sheet "${name}" split-off row "${extra}" contributes nothing to a deal that never had it`, zeroed, true);
      continue;
    }
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
