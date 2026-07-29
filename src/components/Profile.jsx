import{useState,useEffect}from'react';
import{SavedDeals}from'./SavedDeals.jsx';
import{loadDeals,loadDealsLocal}from'../lib/deals.js';
import{CONTACT}from'./Legal.jsx';
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

function Profile({user,onSignIn,onSignOut,onLoadDeal,onStart,notify}){
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
        <Row label="Current plan" value="Free — early access"
          sub="Every feature is unlocked: unlimited analyses, Excel export, the investment memo, saved deals, and share links."/>
        <Row label="Cost" value="None"
          sub="SmartCapStack is free while it finds its footing. If that changes, it will not change retroactively for work you have already done."/>
      </Sec>

      {/* ── account ──────────────────────────────────────────────────── */}
      <Sec title="Account">
        {user?(
          <>
            <Row label="Email" value={user.email||'—'}/>
            {name&&<Row label="Name" value={name}/>}
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
