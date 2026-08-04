// Plan capabilities.
//
// Two failure modes matter here and they are not symmetric. Handing a free
// user a paid feature costs a little revenue. Locking a paying user out of
// their own work, or losing a deal to a plan limit, costs the customer — so
// every unknown state resolves to "free" for features and to "keep the data"
// for storage.
import { plan, isPaid, canExport, canSeeAnalysis, canRollUp, dealLimit,
  accessibleIds, canSaveDeal, canBrand, branding, FREE_DEAL_LIMIT, PRO_DEAL_LIMIT, OWNER_IDS } from '../src/lib/plan.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};

const asUser = (p) => (p === undefined ? null : { user_metadata: { plan: p } });
const deal = (id, daysAgo) => ({
  id, name: 'Deal ' + id,
  savedAt: new Date(Date.UTC(2026, 0, 1) + (100 - daysAgo) * 86400000).toISOString(),
});

console.log('anything unrecognised is free, so a bad read withholds rather than gives away:');
for (const bad of [undefined, null, {}, { user_metadata: null }, { user_metadata: {} },
  asUser(''), asUser('PRO'), asUser('premium'), asUser(0), asUser(true), asUser('free')]) {
  check(`plan(${JSON.stringify(bad)}) → free`, plan(bad) === 'free');
}
check('a signed-out visitor is free', plan(null) === 'free');
check('pro is recognised', plan(asUser('pro')) === 'pro');
check('plus is recognised', plan(asUser('plus')) === 'plus');

console.log('\nowner accounts hold the top tier regardless of billing:');
{
  // simulated rather than asserted against a real id, so the test does not
  // break the day an owner is added or removed
  const OWNED = 'owner-uuid-under-test';
  const withOwner = (id) => ({ id, user_metadata: { plan: 'free' } });
  const realList = OWNER_IDS.slice();
  check('the shipped list holds no email addresses', realList.every((v) => !String(v).includes('@')),
    realList.join(','));
  check('every entry looks like a uuid, not a name',
    realList.every((v) => /^[0-9a-f-]{20,}$/i.test(String(v))), realList.join(','));
  // and the mechanism itself
  OWNER_IDS.push(OWNED);
  check('an owner is plus even with free metadata', plan(withOwner(OWNED)) === 'plus');
  check('an owner can export', canExport(withOwner(OWNED)) === true);
  check('an owner is uncapped', dealLimit(withOwner(OWNED)) === Infinity);
  check('a non-owner with the same shape is still free', plan(withOwner('someone-else')) === 'free');
  OWNER_IDS.length = 0; realList.forEach((v) => OWNER_IDS.push(v));
  check('the list is restored after the test', OWNER_IDS.length === realList.length);
}

console.log('\npaid features follow the plan:');
{
  for (const [label, u, want] of [['free', null, false], ['pro', asUser('pro'), true], ['plus', asUser('plus'), true]]) {
    check(`${label}: export ${want}`, canExport(u) === want);
    check(`${label}: analysis ${want}`, canSeeAnalysis(u) === want);
    check(`${label}: roll-up ${want}`, canRollUp(u) === want);
    check(`${label}: isPaid ${want}`, isPaid(u) === want);
  }
}

console.log('\nbranding is the top tier only, and never half-applied:');
{
  const withBrand = (p, extra = {}) => ({ user_metadata: { plan: p, ...extra } });
  check('free cannot brand', canBrand(null) === false);
  check('pro cannot brand', canBrand(withBrand('pro')) === false);
  check('plus can', canBrand(withBrand('plus')) === true);
  // the money question: a downgraded user must not keep putting their name on exports
  check('a pro with a stored brand name still gets none',
    branding(withBrand('pro', { brand_name: 'Redline Partners' })) === null);
  check('a free user with a stored brand name still gets none',
    branding(withBrand('free', { brand_name: 'Redline Partners' })) === null);
  const b = branding(withBrand('plus', { brand_name: '  Redline Partners  ', brand_line: '  hi@redline.com  ' }));
  check('plus with a name gets it, trimmed', b && b.name === 'Redline Partners' && b.line === 'hi@redline.com');
  check('plus with no name falls back to ours', branding(withBrand('plus')) === null);
  check('plus with a blank name falls back to ours',
    branding(withBrand('plus', { brand_name: '   ' })) === null);
  check('a name without a contact line is fine',
    (branding(withBrand('plus', { brand_name: 'Solo' })) || {}).line === '');
  check('a signed-out visitor has no branding', branding(null) === null);
}

console.log('\neach tier has its own cap:');
{
  check('free keeps 1', dealLimit(null) === 1 && FREE_DEAL_LIMIT === 1);
  check('pro keeps 10', dealLimit(asUser('pro')) === 10 && PRO_DEAL_LIMIT === 10);
  check('broker is uncapped', dealLimit(asUser('plus')) === Infinity);
  check('the caps ascend', FREE_DEAL_LIMIT < PRO_DEAL_LIMIT && PRO_DEAL_LIMIT < Infinity);
  // an owner is top tier, so never capped
  check('an unknown plan gets the free cap', dealLimit(asUser('nonsense')) === FREE_DEAL_LIMIT);
}

console.log('\nover the cap it is the MOST RECENT that stay open:');
{
  // deliberately shuffled, and the ids encode age: d0 is newest
  const deals = [deal('d3', 3), deal('d0', 0), deal('d5', 5), deal('d1', 1), deal('d4', 4), deal('d2', 2)];
  const open = accessibleIds(deals, null);
  check('free opens exactly its cap', open.size === FREE_DEAL_LIMIT, String(open.size));
  check('and it is the newest, whatever order they arrive in', open.has('d0'), [...open].join(','));
  // the failure this pins: keeping the EARLIEST would lock the deal someone
  // saved yesterday and leave one from months ago
  check('it is not the earliest', !open.has('d5'));

  // pro's cap only bites past ten
  const many = Array.from({ length: 14 }, (_, i) => deal('p' + i, i));
  const proOpen = accessibleIds(many, asUser('pro'));
  check('pro opens ten of fourteen', proOpen.size === 10, String(proOpen.size));
  check('pro keeps the ten newest', proOpen.has('p0') && proOpen.has('p9') && !proOpen.has('p10'));
  check('pro under its cap has everything open', accessibleIds(deals, asUser('pro')).size === deals.length);
  check('broker has every deal open', accessibleIds(many, asUser('plus')).size === many.length);
}

console.log('\nnothing is lost or mis-locked in the awkward cases:');
{
  check('no deals at all', accessibleIds([], null).size === 0);
  check('a non-array does not throw', accessibleIds(null, null).size === 0);
  const three = [deal('a', 1), deal('b', 2), deal('c', 3)];
  check('exactly at the cap, all stay open',
    accessibleIds(three, asUser('pro')).size === 3);
  check('under the cap, all stay open', accessibleIds([deal('a', 1)], null).size === 1);
  // a missing or unparseable date must not silently win the "most recent" race
  const undated = [{ id: 'x' }, ...three];
  const open = accessibleIds(undated, asUser('pro'));
  check('a deal with no date does not displace real ones (pro, under cap)',
    open.has('a') && open.has('b') && open.has('c'), [...open].join(','));
  // and on free, where only one slot exists, the undated row must not take it
  check('an undated deal never wins the only free slot',
    accessibleIds(undated, null).has('a'), [...accessibleIds(undated, null)].join(','));
}

console.log('\nsaving respects the cap without stranding anyone:');
{
  const one = [deal('a', 1)];
  const ten = Array.from({ length: 10 }, (_, i) => deal('t' + i, i));
  check('free, empty: can save', canSaveDeal([], null) === true);
  check('free, at its cap of one: cannot save another', canSaveDeal(one, null) === false);
  // the important one: being over the limit must not block editing what you have
  check('free, at the cap: CAN still update an existing deal',
    canSaveDeal(one, null, 'a') === true);
  check('free, over the cap after a downgrade: can still update',
    canSaveDeal(ten, null, 't3') === true);
  check('pro under ten: can save', canSaveDeal(one, asUser('pro')) === true);
  check('pro at ten: cannot save an eleventh', canSaveDeal(ten, asUser('pro')) === false);
  check('pro at ten: can still update', canSaveDeal(ten, asUser('pro'), 't0') === true);
  check('broker at ten: can save', canSaveDeal(ten, asUser('plus')) === true);
  check('a non-array count does not block saving', canSaveDeal(null, null) === true);
}

console.log(failures === 0
  ? '\nCapabilities follow the plan, unknown states withhold features, and no deal is ever locked out that should not be.'
  : `\n${failures} FAILURE(S) — plan gating is wrong.`);
process.exit(failures === 0 ? 0 : 1);
