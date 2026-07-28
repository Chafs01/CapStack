// Captures golden outputs from the CURRENT engine (src/engine).
//
// The original fixtures were captured from the pre-Vite engine to prove the
// migration changed nothing. That guarantee held, and the engine has since
// gained the sales-comp exit — an addition verified against the old fixtures
// as purely additive (1,655 pre-existing values identical) before this file
// took over as the baseline. Re-run only when a change has been deliberately
// reviewed; the point is that an accidental change fails loudly.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as E from '../src/engine/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const replacer = (k, v) => (typeof v === 'number' && Number.isNaN(v) ? '__NaN__' : v);

// One case per asset type, plus the comp-priced variant of the residential
// type so the price-per-unit exit is regression-locked like everything else.
export const CASES = {
  multifamily: () => ({ ...E.DEFS.multifamily, propertyName: 'Golden multifamily' }),
  residential: () => ({ ...E.DEFS.residential, propertyName: 'Golden residential (cap exit)', exitMethod: 'cap' }),
  'residential-ppu': () => ({
    ...E.DEFS.residential, propertyName: 'Golden residential comp exit',
  }),
  'single-family-ppu': () => ({
    ...E.DEFS.residential, propertyName: 'Golden single family',
    numUnits: 1, unitMix: [{ type: 'Other', label: 'Single-family', count: 1, rent: 2600 }],
    purchasePrice: 385000, loanAmount: 288750,
    exitMethod: 'ppu', exitPPU: 385000, apprRate: 3.5,
  }),
  commercial: () => ({ ...E.DEFS.commercial, propertyName: 'Golden commercial' }),
  'mixed-use': () => ({ ...E.DEFS['mixed-use'], propertyName: 'Golden mixed-use' }),
  development: () => ({ ...E.DEFS.development, propertyName: 'Golden development' }),
  affordable: () => ({ ...E.DEFS.affordable, propertyName: 'Golden affordable' }),
};

export function snapshot(inp) {
  const res = E.buildPF(inp);
  return {
    inp,
    core: {
      equity: res.equity, totalCost: res.totalCost, acqC: res.acqC, LF: res.LF,
      rows: res.rows, exit: res.exit, ret: res.ret, sum: res.sum,
      lihtc: res.lihtc, debtSizing: res.debtSizing,
    },
    waterfall: E.calcWaterfall(res, inp),
    afterTax: E.calcAfterTax(res, inp),
    timeline: E.calcProjectTimeline(res, inp),
    refinance: E.calcRefinance(res, { ...inp, refiEnabled: true, refiYear: 3 }),
    scenarios: E.calcScenarios(res, inp),
    devCredits: E.calcDevCredits(res, { ...inp, devCredits: [{ type: 'Historic', basis: 1000000, rate: 20, price: 0.9 }] }),
  };
}

export const HELPERS = () => ({
  monthlyPmt: E.monthlyPmt(1000000, 0.065, 30),
  monthlyPmtZeroRate: E.monthlyPmt(1000000, 0, 30),
  loanBal: E.loanBal(1000000, 0.065, 30, 60),
  irr: E.calcIRR([-100, 20, 20, 20, 20, 120]),
  npv: E.calcNPV([-100, 50, 50, 50], 0.1),
  gpiMF: E.getGPI(E.DEFS.multifamily),
  opexMF: E.getOpEx(E.DEFS.multifamily),
  devCost: E.getDevCost(E.DEFS.development),
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = {};
  for (const [name, mk] of Object.entries(CASES)) out[name] = snapshot(mk());
  out.__helpers = HELPERS();
  const file = path.join(__dirname, 'fixtures.json');
  fs.writeFileSync(file, JSON.stringify(out, replacer, 1));
  console.log('Wrote', file, (fs.statSync(file).size / 1024).toFixed(1) + 'KB');
  for (const [name, v] of Object.entries(out)) {
    if (name === '__helpers') continue;
    const c = v.core;
    console.log('  ' + name.padEnd(20), 'exit:' + c.exit.method.padEnd(4),
      'IRR', (c.ret.irr * 100).toFixed(1) + '%', ' EM', c.ret.em.toFixed(2) + 'x',
      ' gross sale $' + Math.round(c.exit.grossSale).toLocaleString());
  }
}
