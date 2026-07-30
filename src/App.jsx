import{useState,useCallback,useEffect,lazy,Suspense}from'react';
import{sb}from'./lib/supabase.js';
import{buildPF}from'./engine/buildPF.js';
import{DEFS,BLANKS}from'./engine/defaults.js';
import{exportXLSX}from'./engine/excel.js';
import{Landing}from'./components/Landing.jsx';
import{SavedDeals}from'./components/SavedDeals.jsx';
import{Profile}from'./components/Profile.jsx';
import{Step1}from'./components/Step1.jsx';
import{Step2}from'./components/Step2.jsx';
import{Step3}from'./components/Step3.jsx';
import{Step4}from'./components/Step4.jsx';
import{AuthView,ResetPasswordModal,SaveModal,Toast}from'./components/modals.jsx';
import{Legal,CONTACT}from'./components/Legal.jsx';
import{ErrorBoundary}from'./components/ErrorBoundary.jsx';
import{initTelemetry,track}from'./lib/telemetry.js';
import{encodeDeal,decodeDeal,shareURL,readDealFromHash,clearHash}from'./lib/share.js';
import{saveDraft,loadDraft,clearDraft,hasContent}from'./lib/draft.js';
// The dashboard carries the charting library and only renders after a pro
// forma is generated, so it loads as its own chunk.
const Dashboard=lazy(()=>import('./components/Dashboard.jsx').then(m=>({default:m.Dashboard})));
// ─── MAIN APP ─────────────────────────────────────────────────────────────
const STEPS=['Asset Type','Property Info','Income & Expenses','Financing'];

function draftAge(at){
  const mins=Math.max(0,Math.round((Date.now()-at)/60000));
  if(mins<2)return'a moment ago';
  if(mins<60)return`${mins} minutes ago`;
  const hrs=Math.round(mins/60);
  if(hrs<24)return hrs===1?'an hour ago':`${hrs} hours ago`;
  const days=Math.round(hrs/24);
  return days===1?'yesterday':`${days} days ago`;
}

function App(){
  const [view,setView]=useState('landing');
  const [step,setStep]=useState(0);
  const [assetType,setAssetType]=useState('multifamily');
  const [inp,setInp]=useState(BLANKS.multifamily);
  const [res,setRes]=useState(null);
  const [loading,setLoading]=useState(false);
  const [user,setUser]=useState(null);
  // Signing in is a view, not an overlay. Remembering where the user came from
  // means Back and a completed sign-in both return them to the deal they were
  // in the middle of, rather than dumping them on the landing page.
  const [authFrom,setAuthFrom]=useState(null);
  // Reading the session is asynchronous, so for the first moments after load a
  // signed-in user is indistinguishable from a signed-out one. Gating before
  // this resolves would bounce your own users to sign-in on every refresh.
  const [authReady,setAuthReady]=useState(!sb);
  const [showReset,setShowReset]=useState(false);
  const [showSave,setShowSave]=useState(false);
  const [currentDealId,setCurrentDealId]=useState(null);
  const [isDemo,setIsDemo]=useState(false);
  const [isShared,setIsShared]=useState(false);
  const [draft,setDraft]=useState(null);
  const [toast,setToast]=useState('');
  const [toastAct,setToastAct]=useState(null);
  const [legalTab,setLegalTab]=useState('privacy');
  const notify=useCallback((m,act)=>{
    setToast(m);setToastAct(act||null);
    // an offer to undo needs long enough to actually read and act on
    setTimeout(()=>{setToast('');setToastAct(null);},act?7000:2600);
  },[]);

  useEffect(()=>{initTelemetry();},[]);

  // Offer to restore rather than restoring silently — reappearing numbers the
  // user did not just type are more alarming than helpful. A shared link takes
  // priority, since that is an explicit request to look at someone else's deal.
  useEffect(()=>{if(!readDealFromHash())setDraft(loadDraft());},[]);

  // Mirror in-progress entry to localStorage. Debounced so typing does not
  // write on every keystroke, and never while a demo or a shared deal is on
  // screen — neither is the user's own work.
  useEffect(()=>{
    if(view!=='app'||step>=4||isDemo||isShared)return;
    const id=setTimeout(()=>saveDraft(inp,step),400);
    return()=>clearTimeout(id);
  },[inp,step,view,isDemo,isShared]);

  // A shared link carries the whole deal in its hash. Open it directly on the
  // results, and drop the hash so a later reload doesn't resurrect someone
  // else's deal over work the visitor has since started.
  useEffect(()=>{
    let cancelled=false;
    const open=()=>{
      const payload=readDealFromHash();
      if(!payload)return;
      decodeDeal(payload).then(shared=>{
        if(cancelled||!shared)return;
        try{
          const r=buildPF(shared);
          setInp(shared);
          setAssetType(shared.propClass||(shared.assetType||'multifamily').toLowerCase());
          setRes(r);setStep(4);setView('app');setIsShared(true);setIsDemo(false);
          clearHash();
          window.scrollTo({top:0});
        }catch(e){notify('That shared link could not be opened.');}
      });
    };
    open();
    // Following a shared link while already on the site only changes the hash —
    // no remount — so without this the link would appear to do nothing.
    window.addEventListener('hashchange',open);
    return()=>{cancelled=true;window.removeEventListener('hashchange',open);};
  },[notify]);

  useEffect(()=>{
    if(!sb)return; // no Supabase config — calculator still works standalone
    sb.auth.getUser()
      .then(({data:{user:u}})=>setUser(u||null))
      .catch(()=>{})
      .finally(()=>setAuthReady(true));
    const{data:{subscription}}=sb.auth.onAuthStateChange((event,session)=>{
      setUser(session?.user||null);
      if(event==='PASSWORD_RECOVERY'){setView(v=>v==='signin'?'landing':v);setShowReset(true);}
    });
    return()=>subscription.unsubscribe();
  },[]);

  const update=useCallback(upd=>setInp(prev=>({...prev,...upd})),[]);

  const openAuth=useCallback(()=>{
    if(view!=='signin')setAuthFrom(view);
    setView('signin');
    window.scrollTo({top:0});
  },[view]);
  // An account is required to use the tool. Three deliberate exceptions: the
  // landing page and the legal pages stay public so the product can be found
  // and signed up for; a share link still opens for its recipient, because that
  // link is how people arrive and asking a lender to make an account before
  // reading a memo someone sent them is how it stops working; and the sample
  // analysis stays open, because asking someone to sign up before they have
  // seen what the thing produces is asking on no evidence.
  //
  // All three are read-only. Entering your own deal is what needs an account.
  //
  // With no Supabase configured nobody can sign in at all, so enforcing the
  // gate would lock the calculator shut with no way through. It stays open.
  const needsAuth=!!sb&&authReady&&!user;
  const requireAuth=useCallback(fn=>(...args)=>{
    if(!!sb&&!user){openAuth();return;}
    return fn(...args);
  },[user,openAuth]);
  // Catches the ways in that are not a button: a restored draft, a signed-out
  // session expiring mid-deal, or a bookmark straight to the wizard.
  useEffect(()=>{
    if(!needsAuth||isShared||isDemo)return;
    if(view==='app'||view==='profile')openAuth();
  },[needsAuth,isShared,isDemo,view,openAuth]);
  // Signing out is a deliberate exit, so it ends on the landing page. Leaving
  // the user on the account page shows them a page about an account they no
  // longer have, and letting the gate catch them instead would answer "sign me
  // out" with a sign-in wall. One handler, because the header and the account
  // page both do this and they were drifting apart already.
  const handleSignOut=useCallback(async()=>{
    if(sb)await sb.auth.signOut();
    setUser(null);
    setAuthFrom(null);
    setView('landing');
    window.scrollTo({top:0});
    notify('Signed out');
  },[notify]);
  const closeAuth=useCallback(()=>{
    setView(authFrom||'landing');
    setAuthFrom(null);
    window.scrollTo({top:0});
  },[authFrom]);

  const handleAsset=useCallback(a=>{
    setAssetType(a);
    setCurrentDealId(null);
    // Clicking the type you already picked is a confirming gesture, not a
    // request to erase everything typed since. Switching type genuinely
    // invalidates the inputs, and demo/shared data is never the user's to keep.
    if(a!==assetType||isDemo||isShared)setInp(BLANKS[a]||BLANKS.multifamily);
    setIsDemo(false);
    setIsShared(false);
  },[assetType,isDemo,isShared]);

  const handleCalc=()=>{
    // the engine is synchronous and fast — no artificial delay, and errors
    // surface in the toast rather than a native alert()
    setLoading(true);
    try{
      const r=buildPF(inp);
      setRes(r);setStep(4);setIsDemo(false);setIsShared(false);
      track('proforma_generated',{assetType:inp.assetType,exit:inp.exitMethod||'cap'});
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
    track('demo_viewed');
    window.scrollTo({top:0});
  },[]);

  // Sharing writes the whole deal into the link, so it works signed-out and
  // the recipient needs no account to open it.
  const handleShare=useCallback(async()=>{
    try{
      const url=shareURL(await encodeDeal(inp));
      try{
        await navigator.clipboard.writeText(url);
        track('share_created');
        notify('Share link copied to clipboard');
      }catch(e){
        // clipboard blocked (insecure context, or permission denied)
        window.prompt('Copy this link to share the deal:',url);
      }
    }catch(e){notify('Could not build a share link.');}
  },[inp,notify]);

  const restoreDraft=useCallback(()=>{
    if(!draft)return;
    setInp(draft.inp);
    setAssetType(draft.inp.propClass||(draft.inp.assetType||'multifamily').toLowerCase());
    setStep(Math.min(Math.max(draft.step||0,0),3));
    setIsDemo(false);setIsShared(false);setRes(null);
    setView('app');setDraft(null);
    window.scrollTo({top:0});
  },[draft]);

  // "Start an analysis" means start one — not resume wherever the last click
  // left off. Without resetting the step, arriving from the sample deal (which
  // parks you on step 4) dropped you straight back onto that finished
  // dashboard. Borrowed inputs are cleared too; the user's own entry is left
  // alone, since it is still theirs and autosave is holding a copy.
  const startFresh=useCallback(()=>{
    setStep(0);
    setRes(null);
    setCurrentDealId(null);
    if(isDemo||isShared)setInp(BLANKS[assetType]||BLANKS.multifamily);
    setIsDemo(false);
    setIsShared(false);
    setView('app');
    track('analysis_started');
    window.scrollTo({top:0});
  },[isDemo,isShared,assetType]);

  // Deliberate counterpart to the accidental wipe removed above. Undo rather
  // than a confirm prompt: clearing is cheap to reverse, and a modal on every
  // clear is worse than a moment's grace afterwards.
  const clearFields=useCallback(()=>{
    const prev=inp;
    setInp(BLANKS[assetType]||BLANKS.multifamily);
    setRes(null);
    setCurrentDealId(null);
    notify('Fields cleared',{label:'Undo',run:()=>{setInp(prev);notify('Restored');}});
  },[inp,assetType,notify]);

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
          {view==='landing'&&<button className="btn-p" style={{padding:'7px 18px',fontSize:'var(--fs-4)'}} onClick={requireAuth(startFresh)}>Start an analysis</button>}
          <button onClick={()=>{setView('profile');window.scrollTo({top:0});}} style={{background:'none',border:'none',cursor:'pointer',fontSize:'var(--fs-3)',color:view==='profile'?'var(--on-dark-accent)':'var(--on-dark-muted)',fontWeight:view==='profile'?700:500,padding:0,fontFamily:"'Inter',sans-serif"}}>{user?'Account':'Saved deals'}</button>
          {user?(
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {user.user_metadata?.avatar_url
                ?<img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" style={{width:24,height:24,borderRadius:'50%',border:'1px solid rgba(255,255,255,.25)'}}/>
                :null}
              <button onClick={()=>{setView('profile');window.scrollTo({top:0});}} className="hide-m" style={{background:'none',border:'none',padding:0,cursor:'pointer',fontFamily:"'Inter',sans-serif",fontSize:'var(--fs-2)',color:'var(--on-dark-dim)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.user_metadata?.full_name||user.email}</button>
              <button onClick={handleSignOut} style={{background:'none',border:'none',borderBottom:'1px solid var(--border2)',borderRadius:0,cursor:'pointer',fontSize:'var(--fs-3)',color:'var(--on-dark-muted)',padding:'4px 10px',fontFamily:"'Inter',sans-serif"}}>Sign Out</button>
            </div>
          ):(
            <button onClick={openAuth} style={{background:'none',border:'none',borderBottom:'2px solid var(--accent)',borderRadius:0,cursor:'pointer',fontSize:'var(--fs-3)',color:'var(--accent)',padding:'4px 0',fontWeight:600,fontFamily:"'Inter',sans-serif"}}>Sign In</button>
          )}
          {res&&step<4&&<button className="btn-s" style={{fontSize:'var(--fs-3)',padding:'6px 14px',background:'none',color:'var(--accent)'}} onClick={()=>setStep(4)}>View results →</button>}
        </div>
      </div>

      {view==='landing'&&<Landing onStart={requireAuth(startFresh)} onDemo={handleDemo}
        onSample={requireAuth(()=>{const sd={...DEFS.multifamily,propertyName:'Sample Deal'};exportXLSX(buildPF(sd),sd);})}/>}
      {view==='profile'&&(
        <ErrorBoundary resetKey={user?user.id:'anon'} onBack={()=>{setView('app');setStep(0);}}>
          <Profile user={user} onSignIn={openAuth}
            onSignOut={handleSignOut}
            onLoadDeal={handleLoadDeal} onStart={startFresh} notify={notify}/>
        </ErrorBoundary>
      )}
      {view==='legal'&&<Legal tab={legalTab} onTab={setLegalTab} onBack={()=>setView('landing')}/>}
      {view==='signin'&&(
        <ErrorBoundary resetKey="signin" onBack={()=>setView('landing')}>
          <AuthView onClose={closeAuth} onUser={u=>setUser(u)}/>
        </ErrorBoundary>
      )}
      <div style={{maxWidth:step<4?720:1080,margin:'0 auto',padding:'40px 24px 72px',display:(view==='app')?'block':'none'}}>
        {/* Sample numbers must never be mistaken for the user's own deal. */}
        {draft&&!isDemo&&!isShared&&(
          <div className="demo-bar">
            <span><strong>You have an unfinished deal.</strong> Entry from {draftAge(draft.at)} is still here if you want it.</span>
            <span style={{display:'flex',gap:18,flexShrink:0}}>
              <button onClick={restoreDraft}>Pick up where I left off</button>
              <button onClick={()=>{clearDraft();setDraft(null);}}>Discard</button>
            </span>
          </div>
        )}
        {isShared&&(
          <div className="demo-bar">
            <span><strong>Shared analysis.</strong> Someone sent you their underwriting to read. The full analysis is below &mdash; running your own deal takes about four minutes.</span>
            <span style={{display:'flex',gap:18,flexShrink:0}}>
              <button onClick={requireAuth(startFresh)}>Run my own deal</button>
            </span>
          </div>
        )}
        {isDemo&&(
          <div className="demo-bar">
            <span><strong>Sample deal.</strong> Real figures from a 40-unit multifamily, so you can see the output before entering anything.</span>
            {/* The sample is a thing to read, not a deal to edit. Editing it
                put someone in a wizard prefilled with numbers that were never
                theirs, one keystroke away from thinking it was their deal. The
                only way on from here is to start their own. */}
            <span style={{display:'flex',gap:18,flexShrink:0}}>
              <button onClick={requireAuth(()=>{handleAsset('multifamily');setRes(null);setStep(0);window.scrollTo({top:0});})}>Start your own analysis</button>
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
              {/* only offered once there is something to clear */}
              {hasContent(inp)&&<button className="btn-s" onClick={clearFields} style={{color:'var(--muted2)'}}>Clear fields</button>}
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
              <ErrorBoundary resetKey={res} onBack={()=>setStep(3)}>
                {/* Look freely, take with an account. The sample and shared
                    analyses are readable by anyone, but the workbook leaves
                    with you, so downloading it is where the account is asked
                    for. */}
                <Dashboard res={res} inp={inp}
                  viewOnly={isShared||isDemo}
                  viewOnlyLabel={isDemo?'Sample · view only':undefined}
                  canDownload={!!user}
                  onRunOwn={requireAuth(startFresh)} onExport={requireAuth(async()=>{track('excel_exported');
                  // a link home, so the workbook is portable rather than a dead end
                  let back;try{back=shareURL(await encodeDeal(inp));}catch(e){}
                  exportXLSX(res,inp,back);})} onBack={()=>setStep(3)} onSave={handleSave} onShare={handleShare}/>
              </ErrorBoundary>
            </Suspense>
          )
        )}
      </div>

      {showReset&&<ResetPasswordModal onDone={()=>{setShowReset(false);notify('Password updated');}}/>}
      {showSave&&res&&<SaveModal inp={inp} res={res} user={user} existingId={currentDealId}
        onClose={()=>setShowSave(false)}
        onSaved={(id,mode,name)=>{
          setCurrentDealId(id);
          setShowSave(false);
          clearDraft();setDraft(null); // the work has a real home now
          track('deal_saved',{signedIn:!!user});
          setInp(prev=>({...prev,propertyName:name}));
          notify(mode==='updated'?'Deal updated':(user?'Saved to your account':'Saved in this browser'));
        }}
        onSignIn={()=>{setShowSave(false);openAuth();}}/>}
      <Toast msg={toast} action={toastAct}/>
      <div style={{textAlign:'center',padding:'18px 20px',borderTop:'1px solid var(--border)',color:'var(--muted2)',fontSize:'var(--fs-2)'}}>
        <span style={{color:'var(--muted)',fontWeight:600}}>SmartCapStack</span>
        <span style={{margin:'0 8px',color:'var(--border2)'}}>·</span>
        <button onClick={()=>{setLegalTab('privacy');setView('legal');window.scrollTo(0,0);}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:'var(--fs-2)',padding:0,fontFamily:"'Inter',sans-serif"}}>Privacy</button>
        <span style={{margin:'0 8px',color:'var(--border2)'}}>·</span>
        <button onClick={()=>{setLegalTab('terms');setView('legal');window.scrollTo(0,0);}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:'var(--fs-2)',padding:0,fontFamily:"'Inter',sans-serif"}}>Terms</button>
        <span style={{margin:'0 8px',color:'var(--border2)'}}>·</span>
        {/* a real address rather than a form: early on, being able to reply and
            ask a follow-up is worth more than a tidy inbox */}
        <a href={`mailto:${CONTACT}?subject=${encodeURIComponent('SmartCapStack')}`}
          style={{color:'var(--accent)',fontSize:'var(--fs-2)',textDecoration:'none',borderBottom:'1px solid var(--border2)'}}>Contact</a>
        <br/>
        <span style={{fontSize:'var(--fs-2)'}}>All projections are estimates for informational purposes only. Not financial advice.</span>
      </div>
    </div>
  );
}

export default App;
