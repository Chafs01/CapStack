import{sb}from'./supabase.js';

// Lightweight self-owned telemetry: usage events + client errors land in a
// Supabase `events` table you control (no third-party account). Everything is
// best-effort and fully swallowed — telemetry must NEVER break the app or
// slow it down. The table is insert-only from the client (see setup SQL); you
// read it from the Supabase dashboard.
//
// Counting people, not hits. Pageviews alone cannot answer "how many users do
// I have": one person reloading twenty times looks like twenty. A random
// first-party id per browser makes unique visitors countable, and a per-tab id
// makes sessions countable. Neither carries personal information, neither is
// shared, and both ride in `meta` so this needs no change to the table.

const VID_KEY='scs_vid';
function newId(){
  try{if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();}catch(e){/* fall through */}
  return 'x'+Math.random().toString(36).slice(2)+Date.now().toString(36);
}
// Stable across visits. If storage is blocked (private mode) the visitor just
// counts as new each time rather than anything breaking.
function visitorId(){
  try{
    let v=localStorage.getItem(VID_KEY);
    if(!v){v=newId();localStorage.setItem(VID_KEY,v);}
    return v;
  }catch(e){return null;}
}
// One per tab, so a "session" means a visit rather than a lifetime.
let sid=null;
function sessionId(){
  if(sid)return sid;
  try{
    sid=sessionStorage.getItem('scs_sid');
    if(!sid){sid=newId();sessionStorage.setItem('scs_sid',sid);}
  }catch(e){sid=newId();}
  return sid;
}

let lastError=0;
function record(type,data){
  if(!sb)return;
  try{
    sb.from('events').insert({
      type,
      path:(location.pathname+location.hash).slice(0,300),
      referrer:(document.referrer||'').slice(0,300),
      message:data&&data.message?String(data.message).slice(0,500):null,
      meta:{...(data&&data.meta?data.meta:{}),vid:visitorId(),sid:sessionId()},
      ua:navigator.userAgent.slice(0,300),
    }).then(()=>{},()=>{}); // swallow network/permission errors silently
  }catch(e){/* never throw from telemetry */}
}

export function trackPageview(){record('pageview');}

// Named milestones. Traffic says how many people arrived; these say how many
// actually used the thing — which is the number that tells you whether there
// is yet something worth charging for.
export function track(name,meta){
  if(!name)return;
  record(String(name).slice(0,60),meta?{meta}:undefined);
}

export function initTelemetry(){
  if(typeof window==='undefined')return;
  trackPageview();
  window.addEventListener('error',e=>{
    const now=Date.now();
    if(now-lastError<1000)return; // basic throttle against error storms
    lastError=now;
    record('error',{message:e.message,meta:{
      source:e.filename||null,line:e.lineno||null,col:e.colno||null,
      stack:e.error&&e.error.stack?String(e.error.stack).slice(0,1000):null,
    }});
  });
  window.addEventListener('unhandledrejection',e=>{
    const now=Date.now();
    if(now-lastError<1000)return;
    lastError=now;
    const r=e.reason;
    record('error',{message:r&&r.message?r.message:String(r),meta:{
      kind:'unhandledrejection',
      stack:r&&r.stack?String(r.stack).slice(0,1000):null,
    }});
  });
}
