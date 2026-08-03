// Sales comparables.
//
// The comp set is evidence, not a calculation the engine depends on — the UI
// reduces it to exitPPU, which every other module already reads. So the risks
// here are arithmetic and honesty: the average must be a simple average of
// per-unit prices (one vote per comp, not one vote per unit), a half-entered
// comp must not drag it, and the reported range must describe the same set the
// average came from.
import { compPPU, compsSummary } from '../src/engine/comps.js';
import { DEFS, buildPF } from '../src/engine/index.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

console.log('one comparable prices per unit:');
{
  check('price over units', compPPU({ price: 1200000, units: 8 }) === 150000);
  check('a single unit is its own price', compPPU({ price: 400000, units: 1 }) === 400000);
  for (const bad of [null, undefined, {}, 'x', { price: 0, units: 4 }, { price: 500000, units: 0 },
    { price: 500000 }, { units: 4 }, { price: -500000, units: 4 }, { price: 500000, units: -2 },
    { price: 'abc', units: 4 }, { price: 500000, units: 'abc' }]) {
    check(`unpriceable → null: ${JSON.stringify(bad)}`, compPPU(bad) === null);
  }
}

console.log('\na comp set averages per-unit prices, one vote each:');
{
  // 100k/unit, 200k/unit — a weighted average would be dragged to ~155k by the
  // bigger building, which is exactly the bug this pins
  const rows = [{ price: 1000000, units: 10 }, { price: 2000000, units: 10 }];
  check('two comps average cleanly', compsSummary(rows).ppu === 150000);

  const lopsided = [{ price: 100000, units: 1 }, { price: 19000000, units: 100 }];
  const S = compsSummary(lopsided);
  check('a big comp does not outvote a small one', S.ppu === (100000 + 190000) / 2, String(S.ppu));
  const weighted = (100000 + 19000000) / 101;
  check('...and it is not the size-weighted figure', !near(S.ppu, weighted, 1), String(weighted));
}

console.log('\nhalf-entered comps are ignored, not counted as zero:');
{
  const rows = [{ price: 1200000, units: 8 }, { label: 'typing...', price: 0, units: 0 },
    { price: 900000, units: 6 }];
  const S = compsSummary(rows);
  check('only the priceable ones average', S.ppu === 150000, String(S.ppu));
  check('used counts the priceable', S.used === 2);
  check('total counts the rows on screen', S.total === 3);
  // the failure this pins: counting the blank row as $0 would halve the average
  check('a blank row does not drag the average toward zero', S.ppu > 100000);
}

console.log('\nthe range describes the set the average came from:');
{
  const S = compsSummary([{ price: 950000, units: 10 }, { price: 1300000, units: 10 }, { price: 1800000, units: 10 }]);
  check('low is the cheapest per unit', S.low === 95000);
  check('high is the dearest', S.high === 180000);
  check('average sits between them', S.ppu > S.low && S.ppu < S.high);
  check('spread is the range over the average', near(S.spread, (180000 - 95000) / S.ppu));
  check('a wide set is flagged as wide', S.spread > 0.35);
  const tight = compsSummary([{ price: 1280000, units: 10 }, { price: 1300000, units: 10 }, { price: 1320000, units: 10 }]);
  check('a tight set is not', tight.spread < 0.35, String(tight.spread));
  check('one comp has no spread', compsSummary([{ price: 1000000, units: 10 }]).spread === 0);
}

console.log('\nempty and malformed sets are safe:');
{
  for (const bad of [[], null, undefined, 'nope', [null], [{}], [{ price: 0, units: 0 }]]) {
    const S = compsSummary(bad);
    check(`safe: ${JSON.stringify(bad)}`,
      S.ppu === 0 && S.used === 0 && S.low === 0 && S.high === 0 && S.spread === 0);
  }
}

console.log('\nthe engine is untouched — comps reduce to exitPPU, nothing more:');
{
  // whatever the UI stores alongside it, the model reads exitPPU exactly as before
  const base = { ...DEFS.residential };
  const withComps = { ...base, exitComps: [{ price: 1330000, units: 10 }, { price: 1330000, units: 10 }] };
  const a = buildPF(base), b = buildPF(withComps);
  check('carrying a comp list changes no output',
    JSON.stringify(a.rows) === JSON.stringify(b.rows) && a.ret.irr === b.ret.irr);
  check('the exit is still priced off exitPPU', a.exit.ppu === base.exitPPU);
  // and the derived figure is what the UI would write
  check('two identical comps derive their own per-unit price',
    compsSummary(withComps.exitComps).ppu === 133000);
}

console.log(failures === 0
  ? '\nComps average one vote each, ignore half-entered rows, report their own range, and change no calculation.'
  : `\n${failures} FAILURE(S) — comparables are wrong.`);
process.exit(failures === 0 ? 0 : 1);
