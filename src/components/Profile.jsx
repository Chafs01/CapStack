import{useState,useEffect}from'react';
import{SavedDeals}from'./SavedDeals.jsx';
import{loadDeals,loadDealsLocal}from'../lib/deals.js';
import{CONTACT}from'./Legal.jsx';
import{plan,canBrand,isPaid}from'../lib/plan.js';
import{sb}from'../lib/supabase.js';
// ─── PROFILE / ACCOUNT ────────────────────────────────────────────────────
// One place that answers "what is mine here": who you are signed in as, what
// you get, what you have made, and where it is stored.
//
// Sign-in is optional today, so this has to read sensibly with no account at
// all — otherwise the page that is supposed to explain your account is the
// page that tells signed-out visitors they do not exist. Signed out, it shows
// the browser-held deals and says plainly that they live only on this device.

function Row({label,value,sub}){
  return(
    <div style={{display:'grid',gridTemplateColumns:'190px 1fr',gap:20,padding:'13px 0',borderTop:'1px solid var(--border)'}} className="g2">
      <div className="eyebrow" style={{paddingTop:2}}>{label}</div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:'var(--fs-4)',color:'var(--text)',lineHeight:1.5,wordBreak:'break-word'}}>{value}</div>
        {sub&&<div style={{fontSize:'var(--fs-3)',color:'var(--muted)',marginTop:3,lineHeight:1.5}}>{sub}</div>}
      </div>
    </div>
  );
}

// Google hands over a name; an email sign-up hands over nothing, so the account
// page greeted those users with their own raw email address and gave them no
// way to change it. The name lives in user_metadata, which the client is
// allowed to write to itself -- no table, no policy, and updateUser fires an
// auth state change, so the header picks it up without a reload.
function NameRow({current,notify}){
  const [val,setVal]=useState(current||'');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{setVal(current||'');},[current]);
  const dirty=val.trim()!==(current||'');
  const save=async()=>{
    if(!dirty||busy)return;
    if(!sb){notify&&notify('Cloud features are unavailable right now.');return;}
    setBusy(true);
    try{
      const{error}=await sb.auth.updateUser({data:{full_name:val.trim()}});
      if(error)throw error;
      notify&&notify(val.trim()?'Name updated':'Name removed');
    }catch(e){notify&&notify(e.message||'Could not save your name.');}
    setBusy(false);
  };
  return(
    <div style={{display:'grid',gridTemplateColumns:'190px 1fr',gap:20,padding:'13px 0',borderTop:'1px solid var(--border)'}} className="g2">
      <div className="eyebrow" style={{paddingTop:10}}>Name</div>
      <div style={{minWidth:0,display:'flex',gap:18,alignItems:'center',flexWrap:'wrap'}}>
        <input className="input-f" value={val} placeholder="Add your name"
          onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter')save();}}
          style={{flex:'1 1 220px',maxWidth:300}}/>
        {dirty&&<button className="btn-p" onClick={save} disabled={busy}>{busy?'Saving…':'Save'}</button>}
      </div>
    </div>
  );
}

function Sec({title,sub,right,children}){
  return(
    <section style={{marginBottom:38}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:16,flexWrap:'wrap',
        borderBottom:'2px solid var(--text)',paddingBottom:8,marginBottom:4}}>
        <div>
          <h3 style={{fontSize:'var(--fs-6)',fontWeight:600,letterSpacing:'-.015em'}}>{title}</h3>
          {sub&&<p style={{fontSize:'var(--fs-3)',color:'var(--muted)',marginTop:3,lineHeight:1.5}}>{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const fmtDate=iso=>{try{return new Date(iso).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}catch(e){return '—';}};


// The top tier's feature, and the only one that changes what leaves the app
// rather than whether it may. Stored on user_metadata like the display name —
// no table, no policy, and updateUser fires an auth state change so the next
// export picks it up without a reload.
function BrandRows({user,notify}){
  const m=(user&&user.user_metadata)||{};
  const [name,setName]=useState(m.brand_name||'');
  const [line,setLine]=useState(m.brand_line||'');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{const mm=(user&&user.user_metadata)||{};setName(mm.brand_name||'');setLine(mm.brand_line||'');},[user]);
  const dirty=name.trim()!==(m.brand_name||'')||line.trim()!==(m.brand_line||'');
  const save=async()=>{
    if(!dirty||busy)return;
    if(!sb){notify&&notify('Cloud features are unavailable right now.');return;}
    setBusy(true);
    try{
      const{error}=await sb.auth.updateUser({data:{brand_name:name.trim(),brand_line:line.trim()}});
      if(error)throw error;
      notify&&notify(name.trim()?'Branding updated':'Branding removed');
    }catch(e){notify&&notify(e.message||'Could not save your branding.');}
    setBusy(false);
  };
  return(
    <>
      <div style={{display:'grid',gridTemplateColumns:'190px 1fr',gap:20,padding:'13px 0',borderTop:'1px solid var(--border)'}} className="g2">
        <div className="eyebrow" style={{paddingTop:10}}>Firm name</div>
        <div style={{minWidth:0}}>
          <input className="input-f" value={name} placeholder="e.g. Redline Realty Partners"
            onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')save();}}
            style={{maxWidth:340}}/>
          <div style={{fontSize:'var(--fs-3)',color:'var(--muted)',marginTop:5,lineHeight:1.5}}>
            Replaces SmartCapStack on the memo and the workbook. Leave it empty and exports carry ours.
          </div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'190px 1fr',gap:20,padding:'13px 0',borderTop:'1px solid var(--border)'}} className="g2">
        <div className="eyebrow" style={{paddingTop:10}}>Contact line</div>
        <div style={{minWidth:0,display:'flex',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
          <input className="input-f" value={line} placeholder="jordan@firm.com · (555) 010-0100"
            onChange={e=>setLine(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')save();}}
            style={{flex:'1 1 260px',maxWidth:340}}/>
          {dirty&&<button className="btn-p" onClick={save} disabled={busy}>{busy?'Saving…':'Save'}</button>}
        </div>
      </div>
    </>
  );
}

const PLAN_LABEL={free:'Free',pro:'Pro — $10 / month',plus:'Broker — $50 / month'};
const PLAN_SUB={
  free:'Every number the model produces, on screen. Exports, the analysis layer, and more than one saved deal need a paid plan.',
  pro:'Unlimited saved deals, the full analysis, Excel and memo exports, share links, and portfolio roll-up.',
  plus:'Everything in Pro, and your own name on every export instead of ours.',
};
function Profile({user,onSignIn,onSignOut,onLoadDeal,onStart,notify,onUpgrade,onManageBilling}){
  const [count,setCount]=useState(null);
  const [latest,setLatest]=useState(null);

  useEffect(()=>{
    let live=true;
    loadDeals(user).then(d=>{
      if(!live)return;
      setCount(d.length);
      setLatest(d.reduce((a,x)=>(!a||new Date(x.savedAt)>new Date(a.savedAt)?x:a),null));
    }).catch(()=>{if(live)setCount(0);});
    return()=>{live=false;};
  },[user]);

  const meta=user&&user.user_metadata?user.user_metadata:{};
  const provider=(user&&user.app_metadata&&user.app_metadata.provider)||'';
  const name=meta.full_name||meta.name||'';
  const initials=(name||user?.email||'?').trim().slice(0,1).toUpperCase();

  return(
    <div className="fu" style={{maxWidth:1080,margin:'0 auto',padding:'32px 24px 60px'}}>
      <div className="eyebrow" style={{marginBottom:12}}>Account</div>

      {/* ── identity ─────────────────────────────────────────────────── */}
      <div style={{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap',marginBottom:34}}>
        {user&&meta.avatar_url
          ?<img src={meta.avatar_url} alt="" referrerPolicy="no-referrer"
             style={{width:56,height:56,borderRadius:'50%',border:'1px solid var(--border2)'}}/>
          :<div style={{width:56,height:56,border:'1px solid var(--border2)',background:'var(--surface2)',
             display:'flex',alignItems:'center',justifyContent:'center',fontSize:'var(--fs-7)',
             fontWeight:600,color:'var(--muted)'}}>{user?initials:'—'}</div>}
        <div style={{minWidth:0,flex:'1 1 260px'}}>
          <h2 style={{fontSize:'var(--fs-9)',fontWeight:600,letterSpacing:'-.02em',lineHeight:1.15,wordBreak:'break-word'}}>
            {user?(name||user.email):'You are not signed in'}
          </h2>
          <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',marginTop:5,lineHeight:1.5}}>
            {user
              ?(name&&user.email?user.email:'Signed in')
              :'Everything works without an account. Sign in to keep your deals across devices.'}
          </p>
        </div>
        {!user&&<button className="btn-p" onClick={onSignIn}>Sign in</button>}
      </div>

      {/* ── plan ─────────────────────────────────────────────────────── */}
      <Sec title="Plan" sub="What you have access to right now.">
        <Row label="Current plan" value={PLAN_LABEL[plan(user)]}
          sub={PLAN_SUB[plan(user)]}/>
        {isPaid(user)&&<Row label="Billing" value={<button className="btn-s" onClick={onManageBilling}>Manage billing</button>}
          sub="Change your card, switch plan, or cancel. Opens Stripe's billing portal."/>}
        {!isPaid(user)&&<Row label="Upgrade" value={<button className="btn-p" onClick={onUpgrade}>See plans</button>}
          sub="Unlock the analysis layer, the exports, and unlimited saved deals."/>}
      </Sec>

      {/* ── branding: the top tier's reason to exist ─────────────────── */}
      {canBrand(user)&&(
        <Sec title="Branding" sub="What your exports say instead of SmartCapStack.">
          <BrandRows user={user} notify={notify}/>
        </Sec>
      )}

      {/* ── account ──────────────────────────────────────────────────── */}
      <Sec title="Account">
        {user?(
          <>
            <Row label="Email" value={user.email||'—'}/>
            <NameRow current={name} notify={notify}/>
            <Row label="Sign-in method" value={provider==='google'?'Google':(provider||'Email')}
              sub={provider==='google'?'Your password is managed by Google — there is nothing to reset here.':undefined}/>
            <Row label="Member since" value={fmtDate(user.created_at)}/>
            <Row label="Deals stored" value={count===null?'—':`${count} saved to your account`}
              sub={latest?`Most recent: ${latest.name} on ${fmtDate(latest.savedAt)}`:'Nothing saved yet.'}/>
          </>
        ):(
          <>
            <Row label="Status" value="No account"
              sub="You can underwrite, export, and share without signing in."/>
            <Row label="Where your deals live" value="This browser only"
              sub="Saved deals are kept in this browser's storage. Clearing site data or switching device loses them — signing in syncs them instead."/>
            <Row label="Deals in this browser" value={count===null?'—':`${count} saved locally`}
              sub={latest?`Most recent: ${latest.name} on ${fmtDate(latest.savedAt)}`:'Nothing saved yet.'}/>
          </>
        )}
      </Sec>

      {/* ── the deals themselves ─────────────────────────────────────── */}
      <Sec title="Saved deals" sub="Open one to pick up where you left off, or select two to compare.">
        <div style={{marginTop:-8}}>
          <SavedDeals embedded onLoad={onLoadDeal} onClose={onStart} user={user} onSignIn={onSignIn} notify={notify}/>
        </div>
      </Sec>

      {/* ── a way to reach a human ───────────────────────────────────── */}
      <Sec title="Help &amp; feedback" sub="A person reads these. Bugs, confusion, and things you wish it did all welcome.">
        <Row label="Email" value={
          <a href={`mailto:${CONTACT}?subject=${encodeURIComponent('Feedback on SmartCapStack')}`}
            style={{color:'var(--text)',borderBottom:'1px solid var(--border2)',textDecoration:'none'}}>{CONTACT}</a>
        } sub="If something in a deal looks wrong, saying which figure and what you expected makes it far quicker to fix."/>
      </Sec>

      {/* ── session ──────────────────────────────────────────────────── */}
      {user&&(
        <Sec title="Session">
          <Row label="Signed in as" value={user.email||name||'—'}/>
          <div style={{paddingTop:14,borderTop:'1px solid var(--border)'}}>
            <button className="btn-s" onClick={onSignOut}>Sign out</button>
          </div>
        </Sec>
      )}
    </div>
  );
}

export{Profile};
