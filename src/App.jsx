import{useState,useCallback,useEffect,lazy,Suspense}from'react';
import{sb}from'./lib/supabase.js';
import{buildPF}from'./engine/buildPF.js';
import{DEFS,BLANKS}from'./engine/defaults.js';
import{exportXLSX}from'./engine/excel.js';
import{Landing}from'./components/Landing.jsx';
import{SavedDeals}from'./components/SavedDeals.jsx';
import{Step1}from'./components/Step1.jsx';
import{Step2}from'./components/Step2.jsx';
import{Step3}from'./components/Step3.jsx';
import{Step4}from'./components/Step4.jsx';
import{AuthModal,ResetPasswordModal,SaveModal,Toast}from'./components/modals.jsx';
import{Legal}from'./components/Legal.jsx';
import{initTelemetry}from'./lib/telemetry.js';
import{encodeDeal,decodeDeal,shareURL,readDealFromHash,clearHash}from'./lib/share.js';
// The dashboard carries the charting library and only renders after a pro
// forma is generated, so it loads as its own chunk.
const Dashboard=lazy(()=>import('./components/Dashboard.jsx').then(m=>({default:m.Dashboard})));
// ─── MAIN APP ─────────────────────────────────────────────────────────────
const STEPS=['Asset Type','Property Info','Income & Expenses','Financing'];

function App(){
  const [view,setView]=useState('landing');
  const [step,setStep]=useState(0);
  const [assetType,setAssetType]=useState('multifamily');
  const [inp,setInp]=useState(BLANKS.multifamily);
  const [res,setRes]=useState(null);
  const [loading,setLoading]=useState(false);
  const [user,setUser]=useState(null);
  const [showAuth,setShowAuth]=useState(false);
  const [showReset,setShowReset]=useState(false);
  const [showSave,setShowSave]=useState(false);
  const [currentDealId,setCurrentDealId]=useState(null);
  const [isDemo,setIsDemo]=useState(false);
  const [isShared,setIsShared]=useState(false);
  const [toast,setToast]=useState('');
  const [legalTab,setLegalTab]=useState('privacy');
  const notify=useCallback(m=>{setToast(m);setTimeout(()=>setToast(''),2600);},[]);

  useEffect(()=>{initTelemetry();},[]);

  // A shared link carries the whole deal in its hash. Open it directly on the
  // results, and drop the hash so a later reload doesn't resurrect someone
  // else's deal over work the visitor has since started.
  useEffect(()=>{
    const payload=readDealFromHash();
    if(!payload)return;
    let cancelled=false;
    decodeDeal(payload).then(shared=>{
      if(cancelled||!shared)return;
      try{
        const r=buildPF(shared);
        setInp(shared);
        setAssetType(shared.propClass||(shared.assetType||'multifamily').toLowerCase());
        setRes(r);setStep(4);setView('app');setIsShared(true);setIsDemo(false);
        clearHash();
      }catch(e){notify('That shared link could not be opened.');}
    });
    return()=>{cancelled=true;};
  },[notify]);

  useEffect(()=>{
    if(!sb)return; // no Supabase config — calculator still works standalone
    sb.auth.getUser().then(({data:{user:u}})=>setUser(u||null)).catch(()=>{});
    const{data:{subscription}}=sb.auth.onAuthStateChange((event,session)=>{
      setUser(session?.user||null);
      if(event==='PASSWORD_RECOVERY'){setShowAuth(false);setShowReset(true);}
    });
    return()=>subscription.unsubscribe();
  },[]);

  const update=useCallback(upd=>setInp(prev=>({...prev,...upd})),[]);

  const handleAsset=useCallback(a=>{
    setAssetType(a);
    setInp(BLANKS[a]||BLANKS.multifamily);
    setCurrentDealId(null);
    setIsDemo(false);
    setIsShared(false);
  },[]);

  const handleCalc=()=>{
    // the engine is synchronous and fast — no artificial delay, and errors
    // surface in the toast rather than a native alert()
    setLoading(true);
    try{
      const r=buildPF(inp);
      setRes(r);setStep(4);setIsDemo(false);setIsShared(false);
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(e){notify('Could not build the pro forma: '+e.message);}
    setLoading(false);
  };

  // A visitor should be able to see what the tool produces before typing
  // anything. This drops them straight on a finished dashboard with a real
  // deal loaded, which they can then edit into their own.
  const handleDemo=useCallback(()=>{
    const sd={...DEFS.multifamily,propertyName:'Sample — 40-Unit Multifamily'};
    setAssetType('multifamily');
    setInp(sd);
    setCurrentDealId(null);
    setIsDemo(true);
    setIsShared(false);
    setRes(buildPF(sd));
    setStep(4);
    setView('app');
    window.scrollTo({top:0});
  },[]);

  // Sharing writes the whole deal into the link, so it works signed-out and
  // the recipient needs no account to open it.
  const handleShare=useCallback(async()=>{
    try{
      const url=shareURL(await encodeDeal(inp));
      try{
        await navigator.clipboard.writeText(url);
        notify('Share link copied to clipboard');
      }catch(e){
        // clipboard blocked (insecure context, or permission denied)
        window.prompt('Copy this link to share the deal:',url);
      }
    }catch(e){notify('Could not build a share link.');}
  },[inp,notify]);

  const handleSave=()=>setShowSave(true);
  const handleLoadDeal=(d)=>{
    setAssetType(d.inp&&d.inp.propClass?d.inp.propClass:(d.assetType?d.assetType.toLowerCase():'multifamily'));
    setInp(d.inp);
    setCurrentDealId(d.id);
    setIsDemo(false);
    setIsShared(false);
    try{const r=buildPF(d.inp);setRes(r);setStep(4);setView('app');}
    catch(e){setStep(1);setView('app');}
  };


  return(
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <div style={{background:'var(--bg)',borderBottom:'1px solid var(--text)',padding:'13px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100}}>
        <div style={{cursor:'pointer'}} onClick={()=>setView('landing')}>
            <div style={{fontWeight:600,fontSize:'var(--fs-5)',letterSpacing:'-.01em',color:'var(--text)'}}>SmartCapStack</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {view!=='landing'&&step<4&&step>0&&<span className="mono hide-m" style={{fontSize:'var(--fs-2)',color:'var(--on-dark-dim)'}}>STEP {step}/{STEPS.length}</span>}
          {view==='landing'&&<button className="btn-p" style={{padding:'7px 18px',fontSize:'var(--fs-4)'}} onClick={()=>{setIsDemo(false);setView('app');}}>Start an analysis</button>}
          <button onClick={()=>setView('saved')} style={{background:'none',border:'none',cursor:'pointer',fontSize:'var(--fs-3)',color:view==='saved'?'var(--on-dark-accent)':'var(--on-dark-muted)',fontWeight:view==='saved'?700:500,padding:0,fontFamily:"'Inter',sans-serif"}}>Saved deals</button>
          {user?(
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {user.user_metadata?.avatar_url
                ?<img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" style={{width:24,height:24,borderRadius:'50%',border:'1px solid rgba(255,255,255,.25)'}}/>
                :null}
              <span className="hide-m" style={{fontSize:'var(--fs-2)',color:'var(--on-dark-dim)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.user_metadata?.full_name||user.email}</span>
              <button onClick={async()=>{if(sb)await sb.auth.signOut();setUser(null);}} style={{background:'none',border:'none',borderBottom:'1px solid var(--border2)',borderRadius:0,cursor:'pointer',fontSize:'var(--fs-3)',color:'var(--on-dark-muted)',padding:'4px 10px',fontFamily:"'Inter',sans-serif"}}>Sign Out</button>
            </div>
          ):(
            <button onClick={()=>setShowAuth(true)} style={{background:'none',border:'none',borderBottom:'2px solid var(--accent)',borderRadius:0,cursor:'pointer',fontSize:'var(--fs-3)',color:'var(--accent)',padding:'4px 0',fontWeight:600,fontFamily:"'Inter',sans-serif"}}>Sign In</button>
          )}
          {res&&step<4&&<button className="btn-s" style={{fontSize:'var(--fs-3)',padding:'6px 14px',background:'none',color:'var(--accent)'}} onClick={()=>setStep(4)}>View results →</button>}
        </div>
      </div>

      {view==='landing'&&<Landing onStart={()=>{setIsDemo(false);setView('app');}} onDemo={handleDemo}
        onSample={()=>{const sd={...DEFS.multifamily,propertyName:'Sample Deal'};exportXLSX(buildPF(sd),sd);}}/>}
      {view==='saved'&&<SavedDeals onLoad={handleLoadDeal} onClose={()=>{setView('app');setStep(0);}} user={user} onSignIn={()=>setShowAuth(true)} notify={notify}/>}
      {view==='legal'&&<Legal tab={legalTab} onTab={setLegalTab} onBack={()=>setView('landing')}/>}
      <div style={{maxWidth:step<4?720:1080,margin:'0 auto',padding:'40px 24px 72px',display:(view==='app')?'block':'none'}}>
        {/* Sample numbers must never be mistaken for the user's own deal. */}
        {isShared&&(
          <div className="demo-bar">
            <span><strong>Shared deal.</strong> Someone sent you this underwriting. Nothing is saved to your account &mdash; edit it freely and it becomes yours.</span>
            <span style={{display:'flex',gap:18,flexShrink:0}}>
              <button onClick={()=>{setStep(0);window.scrollTo({top:0});}}>Edit these assumptions</button>
              <button onClick={()=>{handleAsset('multifamily');setRes(null);setStep(0);window.scrollTo({top:0});}}>Start my own</button>
            </span>
          </div>
        )}
        {isDemo&&(
          <div className="demo-bar">
            <span><strong>Sample deal.</strong> Real figures from a 40-unit multifamily, so you can see the output before entering anything.</span>
            <span style={{display:'flex',gap:18,flexShrink:0}}>
              <button onClick={()=>{setStep(0);window.scrollTo({top:0});}}>Edit these assumptions</button>
              <button onClick={()=>{handleAsset('multifamily');setRes(null);setStep(0);window.scrollTo({top:0});}}>Start my own</button>
            </span>
          </div>
        )}
        {step<4?(
          <>
            <div className="eyebrow" style={{marginBottom:14}}>Step {step+1} of {STEPS.length}</div>

            {step===0&&<Step1 val={assetType} onChange={handleAsset}/>}
            {step===1&&<Step2 inp={inp} onChange={update} assetType={inp.assetType}/>}
            {step===2&&<Step3 inp={inp} onChange={update}/>}
            {step===3&&<Step4 inp={inp} onChange={update}/>}

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
              <button className="btn-s" onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0}>← Back</button>
              {step<STEPS.length-1?(
                <button className="btn-p" onClick={()=>setStep(s=>s+1)}>Continue →</button>
              ):(
                <button className="btn-p" onClick={handleCalc} disabled={loading}
                  style={{minWidth:190,display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                  {loading?'Calculating…':'Generate Pro Forma'}
                </button>
              )}
            </div>
          </>
        ):(
          res&&(
            <Suspense fallback={<div style={{padding:'80px 24px',textAlign:'center',color:'var(--muted2)',fontSize:'var(--fs-5)'}}>Preparing results…</div>}>
              <Dashboard res={res} inp={inp} onExport={()=>exportXLSX(res,inp)} onBack={()=>setStep(3)} onSave={handleSave} onShare={handleShare}/>
            </Suspense>
          )
        )}
      </div>

      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onUser={u=>setUser(u)}/>}
      {showReset&&<ResetPasswordModal onDone={()=>{setShowReset(false);notify('Password updated');}}/>}
      {showSave&&res&&<SaveModal inp={inp} res={res} user={user} existingId={currentDealId}
        onClose={()=>setShowSave(false)}
        onSaved={(id,mode,name)=>{
          setCurrentDealId(id);
          setShowSave(false);
          setInp(prev=>({...prev,propertyName:name}));
          notify(mode==='updated'?'Deal updated':(user?'Saved to your account':'Saved in this browser'));
        }}
        onSignIn={()=>{setShowSave(false);setShowAuth(true);}}/>}
      <Toast msg={toast}/>
      <div style={{textAlign:'center',padding:'18px 20px',borderTop:'1px solid var(--border)',color:'var(--muted2)',fontSize:'var(--fs-2)'}}>
        <span style={{color:'var(--muted)',fontWeight:600}}>SmartCapStack</span>
        <span style={{margin:'0 8px',color:'var(--border2)'}}>·</span>
        <button onClick={()=>{setLegalTab('privacy');setView('legal');window.scrollTo(0,0);}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:'var(--fs-2)',padding:0,fontFamily:"'Inter',sans-serif"}}>Privacy</button>
        <span style={{margin:'0 8px',color:'var(--border2)'}}>·</span>
        <button onClick={()=>{setLegalTab('terms');setView('legal');window.scrollTo(0,0);}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:'var(--fs-2)',padding:0,fontFamily:"'Inter',sans-serif"}}>Terms</button>
        <br/>
        <span style={{fontSize:'var(--fs-2)'}}>All projections are estimates for informational purposes only. Not financial advice.</span>
      </div>
    </div>
  );
}

export default App;
