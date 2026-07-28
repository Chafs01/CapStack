// ─── WIZARD DRAFT AUTOSAVE ────────────────────────────────────────────────
// Losing forty fields of entry to an accidental refresh is the kind of thing a
// user never comes back from. The in-progress deal is mirrored to localStorage
// so returning to the site restores it.
//
// Deliberately separate from saved deals: a draft is unnamed, singular, and
// disposable. Saving a deal is an explicit act with a name attached; this is
// just not losing your work.

import { BLANKS } from '../engine/defaults.js';

const KEY = 'scs_wizard_draft';
const VERSION = 1;
// Old drafts are dropped rather than migrated. A stale half-entered form is
// worth little, and restoring one against a changed input shape risks showing
// numbers that were never really entered.
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// Fields that come from picking an asset type rather than from entering
// anything. On their own they are not work worth restoring.
const CHOSEN = new Set(['assetType', 'propClass', 'exitMethod']);

// A blank form is NOT all zeros: BLANKS deliberately keeps sensible defaults
// (amortYears 30, revenueGrowth 3, creditRate 9). Testing for "any non-zero
// value" therefore reports an untouched form as full of content, and the next
// app load would overwrite a real draft with an empty one. Content means
// "differs from the blank this deal started as".
function baselineFor(inp) {
  const key = inp && inp.propClass === 'residential'
    ? 'residential'
    : String((inp && inp.assetType) || '').toLowerCase();
  return BLANKS[key] || BLANKS.multifamily;
}

const isEmptyValue = (v) =>
  v === 0 || v === '' || v === false || v == null ||
  (Array.isArray(v) && v.length === 0);

function hasContent(inp) {
  if (!inp || typeof inp !== 'object' || Array.isArray(inp)) return false;
  const base = baselineFor(inp);
  for (const k of Object.keys(inp)) {
    if (CHOSEN.has(k)) continue;
    const v = inp[k];
    // a key the blank does not carry only counts if it holds something
    if (!(k in base)) { if (!isEmptyValue(v)) return true; continue; }
    if (JSON.stringify(v) !== JSON.stringify(base[k])) return true;
  }
  return false;
}

function saveDraft(inp, step) {
  try {
    if (!hasContent(inp)) return false;
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, at: Date.now(), step, inp }));
    return true;
  } catch (e) { return false; } // private mode or quota — autosave is a convenience, never a blocker
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== VERSION || !d.inp || typeof d.inp !== 'object' || Array.isArray(d.inp)) return null;
    if (!d.at || Date.now() - d.at > MAX_AGE_MS) { clearDraft(); return null; }
    if (!hasContent(d.inp)) return null;
    return { inp: d.inp, step: typeof d.step === 'number' ? d.step : 0, at: d.at };
  } catch (e) { return null; }
}

function clearDraft() {
  try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
}

export { saveDraft, loadDraft, clearDraft, hasContent, KEY as DRAFT_KEY };
