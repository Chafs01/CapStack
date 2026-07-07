import{sb}from'./supabase.js';

// Lightweight self-owned telemetry: pageviews + client errors land in a
// Supabase `events` table you control (no third-party account). Everything is
// best-effort and fully swallowed — telemetry must NEVER break the app or
// slow it down. The table is insert-only from the client (see setup SQL); you
// read it from the Supabase dashboard.

let lastError=0;
function record(type,data){
  if(!sb)return;
  try{
    sb.from('events').insert({
      type,
      path:(location.pathname+location.hash).slice(0,300),
      referrer:(document.referrer||'').slice(0,300),
      message:data&&data.message?String(data.message).slice(0,500):null,
      meta:data&&data.meta?data.meta:null,
      ua:navigator.userAgent.slice(0,300),
    }).then(()=>{},()=>{}); // swallow network/permission errors silently
  }catch(e){/* never throw from telemetry */}
}

export function trackPageview(){record('pageview');}

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
