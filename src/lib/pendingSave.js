// ─── SAVE AFTER AUTH ─────────────────────────────────────────────────────
// A visitor can finish an analysis without an account. If they choose to save,
// keep that exact request through sign-in, email confirmation, or an OAuth
// redirect, then write it to the cloud as soon as authentication completes.
//
// This is deliberately separate from the wizard draft. A draft means "do not
// lose what I was typing"; this record means "I explicitly asked you to save
// this finished deal". Keeping the two intents separate prevents an ordinary
// future sign-in from silently saving any half-entered form in the browser.

const KEY='scs_pending_save';
const VERSION=1;
const MAX_AGE_MS=1000*60*60*24*7;

function valid(p){
  return !!p&&p.v===VERSION&&typeof p.id==='string'&&p.id.length>2
    &&p.inp&&typeof p.inp==='object'&&!Array.isArray(p.inp)
    &&Number.isFinite(p.at)&&Date.now()-p.at<=MAX_AGE_MS;
}

function storePendingSave(inp,name){
  const at=Date.now();
  const pending={v:VERSION,at,id:`d${at}_${Math.random().toString(36).slice(2,10)}`,
    name:String(name||inp&&inp.propertyName||'').trim(),
    inp:JSON.parse(JSON.stringify(inp))};
  try{localStorage.setItem(KEY,JSON.stringify(pending));}catch(e){/* state still carries it */}
  return pending;
}

function loadPendingSave(){
  try{
    const pending=JSON.parse(localStorage.getItem(KEY)||'null');
    if(valid(pending))return pending;
    clearPendingSave();
  }catch(e){
    // If storage is readable but the payload is malformed, do not leave it to
    // fail on every future visit. removeItem is separately guarded for private
    // modes where storage itself is unavailable.
    clearPendingSave();
  }
  return null;
}

function clearPendingSave(){
  try{localStorage.removeItem(KEY);}catch(e){/* nothing to clear */}
}

export{storePendingSave,loadPendingSave,clearPendingSave,KEY as PENDING_SAVE_KEY};
