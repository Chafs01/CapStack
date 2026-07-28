// Autosave exists to stop someone losing forty fields of entry. That makes its
// failure modes asymmetric: refusing to restore a real draft is an annoyance,
// but overwriting a real draft with an empty form, or restoring something the
// user never typed, destroys or fabricates work.
//
// The emptiness test is therefore the load-bearing part and gets the most
// attention here.
import { saveDraft, loadDraft, clearDraft, hasContent, DRAFT_KEY } from '../src/lib/draft.js';
import { BLANKS, DEFS } from '../src/engine/defaults.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};

// minimal localStorage
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

console.log('an untouched form is not work worth saving:');
for (const [name, blank] of Object.entries(BLANKS)) {
  check(`blank ${name} has no content`, hasContent(blank) === false,
    JSON.stringify(Object.entries(blank).filter(([k, v]) => (typeof v === 'number' && v !== 0)).slice(0, 3)));
}
check('hasContent(null) is false', hasContent(null) === false);
check('hasContent(undefined) is false', hasContent(undefined) === false);
check('hasContent on a non-object is false', hasContent('nope') === false);
check('choosing an asset type alone is not content',
  hasContent({ assetType: 'Multifamily', propClass: 'residential', exitMethod: 'ppu' }) === false);

console.log('\nreal entry is content:');
check('a typed purchase price counts', hasContent({ ...BLANKS.multifamily, purchasePrice: 500000 }) === true);
check('a typed property name counts', hasContent({ ...BLANKS.multifamily, propertyName: 'Oak St' }) === true);
check('a filled unit-mix row counts',
  hasContent({ ...BLANKS.multifamily, unitMix: [{ type: '2BR', count: 4, rent: 1500 }] }) === true);
// the row the app actually starts with — a placeholder type and no figures
check('the untouched unit-mix row does not count',
  hasContent({ ...BLANKS.multifamily, unitMix: JSON.parse(JSON.stringify(BLANKS.multifamily.unitMix)) }) === false,
  JSON.stringify(BLANKS.multifamily.unitMix));
check('entering a count on that row does count',
  hasContent({ ...BLANKS.multifamily, unitMix: [{ ...BLANKS.multifamily.unitMix[0], count: 4 }] }) === true);
for (const name of Object.keys(DEFS)) {
  check(`the ${name} reference deal counts as content`, hasContent(DEFS[name]) === true);
}

console.log('\na blank form must never overwrite a real draft:');
{
  store.clear();
  const real = { ...BLANKS.multifamily, purchasePrice: 750000, propertyName: 'Keep me' };
  check('saving real entry succeeds', saveDraft(real, 2) === true);
  check('saving a blank form is refused', saveDraft(BLANKS.multifamily, 1) === false);
  const back = loadDraft();
  check('the real draft survived the blank save', back && back.inp.propertyName === 'Keep me',
    JSON.stringify(back && back.inp.propertyName));
  check('the step round-trips', back && back.step === 2, String(back && back.step));
}

console.log('\nround-trip fidelity:');
{
  store.clear();
  const inp = { ...DEFS.residential, propertyName: 'Round trip' };
  saveDraft(inp, 3);
  const back = loadDraft();
  check('every field survives', JSON.stringify(back.inp) === JSON.stringify(inp));
  check('a timestamp is recorded', typeof back.at === 'number' && back.at > 0);
}

console.log('\nclearing:');
{
  store.clear();
  saveDraft({ ...BLANKS.multifamily, purchasePrice: 1 }, 1);
  check('a draft exists before clearing', loadDraft() !== null);
  clearDraft();
  check('nothing remains after clearing', loadDraft() === null);
  check('clearing twice is safe', (() => { clearDraft(); return loadDraft() === null; })());
}

console.log('\ncorrupt, foreign, and stale payloads are ignored:');
const bad = {
  'not json': '{{{',
  'null': 'null',
  'an array': '[1,2,3]',
  'a bare string': '"hello"',
  'a number': '42',
  'wrong version': JSON.stringify({ v: 999, at: Date.now(), step: 1, inp: { purchasePrice: 5 } }),
  'missing inp': JSON.stringify({ v: 1, at: Date.now(), step: 1 }),
  'inp is an array': JSON.stringify({ v: 1, at: Date.now(), step: 1, inp: [1, 2] }),
  'no timestamp': JSON.stringify({ v: 1, step: 1, inp: { purchasePrice: 5 } }),
  'empty inp': JSON.stringify({ v: 1, at: Date.now(), step: 1, inp: {} }),
};
for (const [label, raw] of Object.entries(bad)) {
  store.clear(); store.set(DRAFT_KEY, raw);
  let threw = null, out;
  try { out = loadDraft(); } catch (e) { threw = e.message; }
  check(`ignores ${label}`, threw === null && out === null, threw || JSON.stringify(out));
}
{
  store.clear();
  const old = Date.now() - 1000 * 60 * 60 * 24 * 31; // older than the 30-day window
  store.set(DRAFT_KEY, JSON.stringify({ v: 1, at: old, step: 1, inp: { purchasePrice: 5 } }));
  check('a draft older than 30 days is dropped', loadDraft() === null);
  check('...and is purged rather than left to rot', store.get(DRAFT_KEY) === undefined);
  store.clear();
  const recent = Date.now() - 1000 * 60 * 60 * 24 * 29;
  store.set(DRAFT_KEY, JSON.stringify({ v: 1, at: recent, step: 1, inp: { purchasePrice: 5 } }));
  check('a 29-day-old draft is still offered', loadDraft() !== null);
}

console.log('\nstorage failure degrades quietly (private mode, quota):');
{
  const realLS = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('quota'); },
    removeItem: () => { throw new Error('denied'); },
  };
  let threw = null;
  try {
    check('saveDraft reports failure instead of throwing', saveDraft({ purchasePrice: 5 }, 1) === false);
    check('loadDraft returns null instead of throwing', loadDraft() === null);
    clearDraft();
  } catch (e) { threw = e.message; }
  check('nothing escaped as an exception', threw === null, threw);
  globalThis.localStorage = realLS;
}

if (failures) { console.log(`\n${failures} FAILURE(S) — draft autosave regressed.`); process.exit(1); }
console.log('\nDraft autosave preserves real work and never fabricates or destroys it.');
