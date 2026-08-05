import {buildPF,DEFS} from '../src/engine/index.js';
import {buildWorkbook} from '../src/engine/excel.js';

let failures=0;
const check=(name,ok)=>{console.log(`  ${ok?'PASS':'FAIL'} ${name}`);if(!ok)failures++;};

const mf={...DEFS.multifamily,marketRentPremiumPct:12,rentStabilizationYear:3};
const mr=buildPF(mf);
check('multifamily Year 1 stays at in-place rent',Math.abs(mr.rows[0].gpi-buildPF(DEFS.multifamily).rows[0].gpi)<1e-8);
check('multifamily premium phases in',mr.rows[1].gpi>buildPF(DEFS.multifamily).rows[1].gpi&&mr.rows[2].gpi>mr.rows[1].gpi);
const mw=await buildWorkbook(mr,mf);
const mfs=mw.getWorksheet('Annual Pro Forma');
const mfGpi=[...mfs._rows].find(r=>r?.getCell(2).value==='Gross Potential Income');
check('multifamily rent bridge is a live Excel formula',String(mfGpi?.getCell(5).value?.formula||'').includes('MIN(1'));

const mx={...DEFS['mixed-use'],residentialVacancyRate:4,commercialVacancyRate:18,residentialGrowthRate:3.5,commercialGrowthRate:1.5};
const xr=buildPF(mx);
check('mixed-use split vacancy is weighted',xr.rows[0].vacL>0&&Math.abs(xr.rows[0].vacL-xr.rows[0].gpi*mx.vacancyRate/100)>1);
const xw=await buildWorkbook(xr,mx);
const xpf=xw.getWorksheet('Annual Pro Forma');
const xGpi=[...xpf._rows].find(r=>r?.getCell(2).value==='Gross Potential Income');
const xVac=[...xpf._rows].find(r=>r?.getCell(2).value==='Less: Vacancy Loss');
check('mixed-use growth split is a live Excel formula',String(xGpi?.getCell(5).value?.formula||'').includes('Residential GPI')||String(xGpi?.getCell(5).value?.formula||'').includes('$'));
check('mixed-use vacancy split is a live Excel formula',!!xVac?.getCell(4).value?.formula);

const dr=buildPF(DEFS.development);
const dw=await buildWorkbook(dr,DEFS.development);
const dt=dw.getWorksheet('Development Timeline');
check('development workbook includes monthly timeline',!!dt);
check('project IRR is a live Excel formula',String(dt?.getCell(dt.rowCount-1,8).value?.formula||'').includes('IRR'));
check('project equity multiple is a live Excel formula',!!dt?.getCell(dt.rowCount,8).value?.formula);
const firstPostConstruction=7+dr.inp.constructionPeriodMonths+1;
check('capitalized interest stops after construction',String(dt?.getCell(firstPostConstruction,5).value?.formula||'').startsWith('IF('));

if(failures){console.error(`\n${failures} asset-depth failure(s).`);process.exit(1);}
console.log('\nAsset-specific calculations and workbook formulas verified.');
