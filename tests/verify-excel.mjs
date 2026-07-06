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

check('sheet names', wbNew.worksheets.map(w => w.name), wbOld.worksheets.map(w => w.name));
for (const name of wbOld.worksheets.map(w => w.name)) {
  const a = wbNew.getWorksheet(name), b = wbOld.getWorksheet(name);
  const cells = (ws) => {
    const out = [];
    ws.eachRow({ includeEmpty: false }, (row, rn) => row.eachCell({ includeEmpty: false }, (cell, cn) => out.push([rn, cn, cell.value])));
    return out;
  };
  check(`sheet "${name}" cell values+formulas`, cells(a), cells(b));
}

fs.unlinkSync(tmp);
if (failures) { console.log('\n' + failures + ' FAILURE(S)'); process.exit(1); }
console.log('\nExcel export matches legacy exactly.');
