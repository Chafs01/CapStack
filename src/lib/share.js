// ─── SHAREABLE DEAL LINKS ─────────────────────────────────────────────────
// A shared deal travels inside the URL rather than a database row. That keeps
// sharing available to signed-out visitors, needs no table or RLS policy, and
// means a link can never rot against a server.
//
// The full input object is encoded, not a diff against the defaults. A diff
// would be ~40% shorter, but if a default ever changed, every old link would
// silently recompute to different numbers — unacceptable when the output is
// someone's underwriting. Self-contained links are worth the extra characters.

const MARK_RAW='r', MARK_DEFLATE='c';

const toB64=bytes=>{
  let s='';
  for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const fromB64=str=>{
  const b=atob(str.replace(/-/g,'+').replace(/_/g,'/'));
  const out=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)out[i]=b.charCodeAt(i);
  return out;
};

// The writer side settles independently of the readable side, so a corrupt
// payload rejects twice: once here and once at the read below. Swallowing the
// writer's rejection lets the single failure surface from the await, instead
// of also raising an unhandled rejection.
function pump(stream,bytes){
  const w=stream.writable.getWriter();
  w.write(bytes).catch(()=>{});
  w.close().catch(()=>{});
  return new Response(stream.readable).arrayBuffer();
}
async function squeeze(bytes,format){
  return new Uint8Array(await pump(new CompressionStream(format),bytes));
}
async function expand(bytes,format){
  return new Uint8Array(await pump(new DecompressionStream(format),bytes));
}

// Encoded payload is a one-character codec marker followed by base64url, so a
// browser without CompressionStream still produces a link everyone can open.
async function encodeDeal(inp){
  const json=JSON.stringify(inp);
  const raw=new TextEncoder().encode(json);
  if(typeof CompressionStream==='function'){
    try{return MARK_DEFLATE+toB64(await squeeze(raw,'deflate-raw'));}
    catch(e){/* fall through to uncompressed */}
  }
  return MARK_RAW+toB64(raw);
}

async function decodeDeal(payload){
  if(!payload||payload.length<2)return null;
  const mark=payload[0], body=payload.slice(1);
  try{
    const bytes=fromB64(body);
    const json=mark===MARK_DEFLATE
      ? new TextDecoder().decode(await expand(bytes,'deflate-raw'))
      : new TextDecoder().decode(bytes);
    const inp=JSON.parse(json);
    // A link is untrusted input: only accept a plain object that the engine
    // can actually consume, never an array or a primitive.
    if(!inp||typeof inp!=='object'||Array.isArray(inp))return null;
    return inp;
  }catch(e){return null;}
}

function shareURL(payload){
  const{origin,pathname}=window.location;
  return `${origin}${pathname}#d=${payload}`;
}

function readDealFromHash(){
  const m=/[#&]d=([A-Za-z0-9\-_]+)/.exec(window.location.hash||'');
  return m?m[1]:null;
}

function clearHash(){
  try{window.history.replaceState(null,'',window.location.pathname+window.location.search);}
  catch(e){/* history blocked — the hash is cosmetic at this point */}
}

export{encodeDeal,decodeDeal,shareURL,readDealFromHash,clearHash};
