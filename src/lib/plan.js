// ─── PLANS & CAPABILITIES ─────────────────────────────────────────────────
// One place that answers "what is this user allowed to do", so a tier change
// is one edit rather than a hunt through every component that gates something.
//
// The shape of the paywall: free users type numbers and get every figure on
// screen. What they do not get is help reading those figures, or anything that
// leaves the app. The analysis is not crippled — the interpretation and the
// artifacts are what is sold.
//
// Deliberately NOT gated: the section info tooltips. They explain what a
// preferred return is and what to type in the box, which is what makes an
// institutional tool usable by someone who is not an institution. Gating them
// would hit the user least able to judge the product and most likely to leave.
//
// A note on enforcement. The engine ships to the browser as a client-side
// bundle, so every check here is one a determined person could bypass by
// reading the code. That is an accepted trade, not an oversight: the audience
// is people buying buildings, not people de-minifying JavaScript. Anything
// that genuinely must not leak has to move server-side (a Supabase Edge
// Function generating the workbook), which is a much larger change and is not
// worth making until someone actually abuses this.

// Free keeps one saved deal. Paying removes the cap entirely — there is no
// second limit further up.
//
// Storage was never the reason: a saved deal is about 1.2 KB, and the entire
// free tier would fit in a rounding error. The cap exists to make saving worth
// paying for, which is a job it only does at the free boundary. Metering
// someone who already pays earns very little and costs goodwill every time
// they hit it, and it would have pushed them toward a tier that sells
// branding — something an investor hitting a storage limit does not want.
const FREE_DEAL_LIMIT=1;

// Accounts that always hold the top tier, whatever their billing says — the
// owner's own, so running the product never means paying yourself.
//
// Supabase user IDs, not email addresses. This file ships to every visitor's
// browser, and an email address in a public bundle is an address that gets
// scraped. A UUID leaks nothing and cannot be used to sign in as anyone.
//
// To add yours: Supabase dashboard → Authentication → Users → click your row →
// copy the UID, and paste it below. There is no need to redeploy to change a
// normal user's plan — that lives in metadata — but this list survives any
// change to billing, metadata, or the account's subscription state.
const OWNER_IDS=[
  '961be5ac-1322-4d2c-8668-b34ff2d03af0',   // Jordan
];

// The plan lives on the Supabase user's metadata. Anything unrecognised — and
// anyone signed out — is free, so a failure to read the plan withholds
// features rather than giving them away.
function plan(user){
  if(user&&user.id&&OWNER_IDS.includes(user.id))return'plus';
  const p=user&&user.user_metadata&&user.user_metadata.plan;
  return (p==='pro'||p==='plus')?p:'free';
}
const isPaid=user=>plan(user)!=='free';

// Artifacts: the things that leave the app.
const canExport=user=>isPaid(user);
// Interpretation: analyst notes and the detail of the deal-health findings.
// The counts and the verdict are shown to everyone — see the note on teasing
// below — so this gates the substance, not the existence.
const canSeeAnalysis=user=>isPaid(user);
const canRollUp=user=>isPaid(user);
// The top tier's reason to exist: exports carry your name instead of ours.
// Near-zero cost to serve and worth the most to a broker, whose memo is a
// marketing document for a listing rather than a working file.
const canBrand=user=>plan(user)==='plus';

// What a branded export should say. Read here rather than in each exporter so
// the memo and the workbook cannot drift, and so an unbranded plan can never
// leak a half-set name into a document.
function branding(user){
  if(!canBrand(user))return null;
  const m=(user&&user.user_metadata)||{};
  const name=String(m.brand_name||'').trim();
  if(!name)return null;                      // nothing set — fall back to ours
  const line=String(m.brand_line||'').trim();
  return{name,line};
}

const dealLimit=user=>isPaid(user)?Infinity:FREE_DEAL_LIMIT;

// Which saved deals a user can still open. Over the limit the rest are kept
// and listed by name — never deleted, because destroying someone's
// underwriting to enforce billing is not a thing worth doing for $10 a month.
//
// The ones kept are the most RECENT, not the earliest. Someone who downgrades
// is still working on the deal they saved yesterday; leaving them that one and
// locking a deal from eight months ago is the only version that does not read
// as a bug. `deals` is assumed newest-first, which is the order loadDeals
// returns, but it is sorted here anyway so a caller cannot get this wrong.
function accessibleIds(deals,user){
  const list=Array.isArray(deals)?deals:[];
  const lim=dealLimit(user);
  if(!isFinite(lim))return new Set(list.map(d=>d&&d.id));
  const byNewest=list.slice().sort((a,b)=>{
    const ta=Date.parse((a&&a.savedAt)||'')||0, tb=Date.parse((b&&b.savedAt)||'')||0;
    return tb-ta;
  });
  return new Set(byNewest.slice(0,lim).map(d=>d&&d.id));
}
// Whether one more deal can be saved. An update to a deal that already exists
// is always allowed — it is not a new slot, and refusing it would strand
// someone over the limit with work they cannot record.
function canSaveDeal(deals,user,existingId){
  if(existingId)return true;
  const n=Array.isArray(deals)?deals.length:0;
  return n<dealLimit(user);
}

export{plan,isPaid,canExport,canSeeAnalysis,canRollUp,canBrand,branding,dealLimit,
  accessibleIds,canSaveDeal,FREE_DEAL_LIMIT,OWNER_IDS};
