// ─── LOCAL DEAL STORAGE ───────────────────────────────────────────────────
// Split out from deals.js so the validation can be tested directly: deals.js
// pulls in the Supabase client, which needs Vite's import.meta.env and so
// cannot be loaded by a plain Node test.
//
// localStorage is not a trusted store. A partial write, a different version of
// the app, or an extension can leave behind something that is not a list of
// deals — and a malformed row used to crash the deal list, which took the
// whole page down to a blank screen. Anything unusable is dropped here.

const DEALS_KEY = 'proforma_saved_deals';

function isDealLike(d) {
  return !!d && typeof d === 'object' && !Array.isArray(d)
    && typeof d.id !== 'undefined'
    && !!d.inp && typeof d.inp === 'object' && !Array.isArray(d.inp);
}

function loadDealsLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(DEALS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(isDealLike);
  } catch (e) { return []; }
}

function saveDealsLocal(d) {
  try { localStorage.setItem(DEALS_KEY, JSON.stringify(d)); } catch (e) { /* quota or private mode */ }
}

export { DEALS_KEY, isDealLike, loadDealsLocal, saveDealsLocal };
