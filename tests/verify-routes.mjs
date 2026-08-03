// Addresses for screens.
//
// The risk here is not that a path renders the wrong page — that is visible
// immediately. It is that the two directions drift apart: a screen writes an
// address that does not read back to the same screen, so Back lands somewhere
// nobody chose. Every state a user can reach has to survive the round trip.
import { routeFor, pathFor, sameRoute, normalise, STEP_SLUGS, RESULTS_STEP } from '../src/lib/routes.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};

// Every screen the app can be in.
const STATES = [
  { view: 'landing' },
  { view: 'signin' },
  { view: 'profile' },
  { view: 'legal', legalTab: 'privacy' },
  { view: 'legal', legalTab: 'terms' },
  { view: 'app', step: 0 },
  { view: 'app', step: 1 },
  { view: 'app', step: 2 },
  { view: 'app', step: 3 },
  { view: 'app', step: RESULTS_STEP },
];

console.log('every screen round-trips through its address:');
for (const s of STATES) {
  const p = pathFor(s);
  const back = routeFor(p);
  const label = `${s.view}${s.step !== undefined ? '/' + s.step : ''}${s.legalTab ? '/' + s.legalTab : ''}`;
  check(`${label} → ${p} → back`, !!back && sameRoute(back, s), `got ${JSON.stringify(back)}`);
}

console.log('\nno two screens share an address:');
{
  const seen = new Map();
  let clash = null;
  for (const s of STATES) {
    const p = pathFor(s);
    if (seen.has(p)) clash = `${p} used by both ${JSON.stringify(seen.get(p))} and ${JSON.stringify(s)}`;
    seen.set(p, s);
  }
  check('each state has its own path', !clash, clash || '');
  check('and there are as many paths as screens', seen.size === STATES.length);
}

console.log('\naddresses a person might actually type:');
{
  check('a trailing slash is the same page', routeFor('/account/').view === 'profile');
  check('casing does not matter', routeFor('/ACCOUNT').view === 'profile');
  check('the root is the landing page', routeFor('/').view === 'landing');
  check('an empty path is the landing page', routeFor('').view === 'landing');
  check('/new is the first wizard step', routeFor('/new').step === 0);
  check('/new/income is the income step', routeFor('/new/income').step === 2);
  check('/analysis is the results screen', routeFor('/analysis').step === RESULTS_STEP);
  // an unknown address must be reported as unknown, so the caller can send the
  // visitor somewhere real instead of rendering nothing
  check('an unknown path is null, not a guess', routeFor('/nope') === null);
  check('a wizard step that does not exist is null', routeFor('/new/nonsense') === null);
  check('/new/ does not resolve by way of the empty slug', routeFor('/new/') === null || routeFor('/new/').step === 0);
}

console.log('\nnormalise is total — it never returns something unusable:');
for (const bad of [null, undefined, '', '/', '///', 42, {}, '/A/B/']) {
  const n = normalise(bad);
  check(`normalise(${JSON.stringify(bad)}) → ${JSON.stringify(n)}`,
    typeof n === 'string' && n.startsWith('/') && (n === '/' || !n.endsWith('/')));
}

console.log('\npathFor is total too — a broken state still yields a real address:');
for (const bad of [null, undefined, {}, { view: 'nonsense' }, { view: 'app' }, { view: 'app', step: 99 },
  { view: 'app', step: -3 }, { view: 'app', step: 'x' }, { view: 'legal' }]) {
  const p = pathFor(bad);
  check(`pathFor(${JSON.stringify(bad)}) → ${p}`, typeof p === 'string' && p.startsWith('/') && routeFor(p) !== null);
}

console.log('\nstep slugs stay lined up with the wizard:');
{
  check('there is a slug per wizard step', STEP_SLUGS.length === RESULTS_STEP);
  check('only the first is empty', STEP_SLUGS[0] === '' && STEP_SLUGS.slice(1).every(s => !!s));
  check('slugs are unique', new Set(STEP_SLUGS).size === STEP_SLUGS.length);
  check('an out-of-range step clamps to the results screen', pathFor({ view: 'app', step: 99 }) === '/analysis');
}

console.log(failures === 0
  ? '\nEvery screen has an address, and every address leads back to the screen that wrote it.'
  : `\n${failures} FAILURE(S) — routing is wrong.`);
process.exit(failures === 0 ? 0 : 1);
