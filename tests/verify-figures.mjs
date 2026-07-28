// Derived figures on a partly-filled form must distinguish "not entered yet"
// from "entered, and the answer is bad". Collapsing the two put a red 0.00%
// cap rate on an untouched form, which reads as an error the user caused.
//
// This walks the full truth table rather than the two cases that prompted the
// fix, because the failure mode is a *missing* state, and missing states are
// exactly what spot-checks miss.
import { summaryFigures, operatingStarted, toneFor } from '../src/lib/figures.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};
const eq = (label, actual, expected) =>
  check(`${label} → ${JSON.stringify(expected)}`, actual === expected, `got ${JSON.stringify(actual)}`);

console.log('the case that prompted this (untouched form):');
{
  const S = summaryFigures({});
  eq('blank form: nothing started', S.started, false);
  eq('blank form: cap rate is not stateable', S.capR.ready, false);
  eq('blank form: cap rate is NOT red', S.capR.tone, 'idle');
  eq('blank form: NOI is not stateable', S.noi.ready, false);
  eq('blank form: NOI is NOT red', S.noi.tone, 'idle');
}

console.log('\na purchase price alone must not manufacture a 0.00% cap rate:');
{
  const S = summaryFigures({ capBasis: 7750000 });
  eq('price entered, no income yet: cap rate still idle', S.capR.tone, 'idle');
  eq('price entered, no income yet: cap rate not shown', S.capR.ready, false);
}

console.log('\nincome without a price — cap rate has no denominator:');
{
  const S = summaryFigures({ gpi: 792000, egi: 764400, opex: 299152, noi: 465248, capBasis: 0, capR: 0 });
  eq('NOI is real and positive', S.noi.tone, 'ok');
  eq('NOI is shown', S.noi.ready, true);
  eq('cap rate stays idle without a basis', S.capR.tone, 'idle');
  eq('cap rate is not shown without a basis', S.capR.ready, false);
}

console.log('\na genuinely bad deal must still go red:');
{
  const S = summaryFigures({ gpi: 100000, egi: 95000, opex: 140000, noi: -45000, capBasis: 2000000, capR: -0.0225 });
  eq('negative NOI flags red', S.noi.tone, 'neg');
  eq('negative NOI is shown', S.noi.ready, true);
  eq('negative cap rate flags red', S.capR.tone, 'neg');
  eq('negative cap rate is shown', S.capR.ready, true);
}

console.log('\nexpenses entered before income — a real half-filled state:');
{
  const S = summaryFigures({ gpi: 0, egi: 0, opex: 42000, noi: -42000, capBasis: 500000, capR: -0.084 });
  eq('entering expenses counts as started', S.started, true);
  eq('resulting negative NOI is a real finding', S.noi.tone, 'neg');
  eq('resulting negative cap rate is a real finding', S.capR.tone, 'neg');
}

console.log('\nexactly-zero NOI from real inputs is still a finding, not idle:');
{
  const S = summaryFigures({ gpi: 100000, egi: 100000, opex: 100000, noi: 0, capBasis: 1000000, capR: 0 });
  eq('break-even NOI is flagged, not hidden', S.noi.tone, 'neg');
  eq('break-even NOI is shown', S.noi.ready, true);
  eq('zero cap rate from real inputs is flagged', S.capR.tone, 'neg');
}

console.log('\na healthy deal:');
{
  const S = summaryFigures({ gpi: 792000, egi: 764400, opex: 299152, noi: 465248, capBasis: 7750000, capR: 0.06 });
  eq('NOI reads normal', S.noi.tone, 'ok');
  eq('cap rate reads normal', S.capR.tone, 'ok');
  eq('both are shown', S.noi.ready && S.capR.ready, true);
}

console.log('\nprimitives:');
eq('operatingStarted({}) is false', operatingStarted({}), false);
eq('operatingStarted(undefined) is false', operatingStarted(), false);
eq('gpi alone starts it', operatingStarted({ gpi: 1 }), true);
eq('egi alone starts it', operatingStarted({ egi: 1 }), true);
eq('opex alone starts it', operatingStarted({ opex: 1 }), true);
eq('negative-only values do not start it', operatingStarted({ gpi: -5, egi: -5, opex: -5 }), false);
eq('toneFor when not ready is always idle', toneFor(999, false), 'idle');
eq('toneFor(0, ready) is neg', toneFor(0, true), 'neg');
eq('toneFor(-1, ready) is neg', toneFor(-1, true), 'neg');
eq('toneFor(0.001, ready) is ok', toneFor(0.001, true), 'ok');

console.log('\nmalformed input must not throw (values arrive mid-typing):');
for (const bad of [undefined, {}, { gpi: NaN, noi: NaN, capBasis: NaN, capR: NaN }, { gpi: null, opex: null }]) {
  let threw = null;
  try { summaryFigures(bad); } catch (e) { threw = e.message; }
  check(`survives ${JSON.stringify(bad)}`, threw === null, threw);
}
{
  // NaN propagates through the arithmetic while a field is being retyped; it
  // must read as idle rather than as a red exception.
  const S = summaryFigures({ gpi: NaN, egi: NaN, opex: NaN, noi: NaN, capBasis: NaN, capR: NaN });
  eq('NaN throughout reads idle, not red', S.noi.tone, 'idle');
  eq('NaN cap rate reads idle, not red', S.capR.tone, 'idle');
}

if (failures) { console.log(`\n${failures} FAILURE(S) — derived-figure states regressed.`); process.exit(1); }
console.log('\nDerived figures distinguish "not entered" from "negative" in every case.');
