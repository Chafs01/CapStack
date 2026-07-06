// Captures golden outputs from the CURRENT engine (tests/engine-current.cjs,
// extracted verbatim from index.html). These fixtures are the pass/fail
// contract for the Vite migration: the migrated modules must reproduce every
// number exactly.
const fs = require('fs');
const path = require('path');
const E = require('./engine-current.cjs');

// NaN survives a JSON round-trip as a sentinel so verify can distinguish
// NaN (expected) from null/0 (a real regression).
const replacer = (k, v) => (typeof v === 'number' && Number.isNaN(v) ? '__NaN__' : v);

const out = {};
for (const type of ['multifamily', 'commercial', 'mixed-use', 'development', 'affordable']) {
  const inp = { ...E.DEFS[type], propertyName: 'Golden ' + type };
  const res = E.buildPF(inp);
  out[type] = {
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

// spot checks on the pure helpers too
out.__helpers = {
  monthlyPmt: E.monthlyPmt(1000000, 0.065, 30),
  monthlyPmtZeroRate: E.monthlyPmt(1000000, 0, 30),
  loanBal: E.loanBal(1000000, 0.065, 30, 60),
  irr: E.calcIRR([-100, 20, 20, 20, 20, 120]),
  npv: E.calcNPV([-100, 50, 50, 50], 0.1),
  gpiMF: E.getGPI(E.DEFS.multifamily),
  opexMF: E.getOpEx(E.DEFS.multifamily),
  devCost: E.getDevCost(E.DEFS.development),
};

const file = path.join(__dirname, 'fixtures.json');
fs.writeFileSync(file, JSON.stringify(out, replacer, 1));
const stats = fs.statSync(file);
console.log('Wrote', file, (stats.size / 1024).toFixed(1) + 'KB');
for (const t of Object.keys(out)) {
  if (t === '__helpers') continue;
  const c = out[t].core;
  console.log(t.padEnd(12), 'IRR:', c.ret.irr, 'EM:', c.ret.em, 'equity:', c.equity);
}
