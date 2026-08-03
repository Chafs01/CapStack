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

const FREE_DEAL_LIMIT=3;

// The plan lives on the Supabase user's metadata. Anything unrecognised — and
// anyone signed out — is free, so a failure to read the plan withholds
// features rather than giving them away.
function plan(user){
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

export{plan,isPaid,canExport,canSeeAnalysis,canRollUp,dealLimit,accessibleIds,
  canSaveDeal,FREE_DEAL_LIMIT};
