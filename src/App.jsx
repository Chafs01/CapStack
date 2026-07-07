import React,{useState,useCallback,useEffect}from'react';
import{sb}from'./lib/supabase.js';
import{buildPF}from'./engine/buildPF.js';
import{DEFS}from'./engine/defaults.js';
import{exportXLSX}from'./engine/excel.js';
import{Landing}from'./components/Landing.jsx';
import{SavedDeals}from'./components/SavedDeals.jsx';
import{Step1}from'./components/Step1.jsx';
import{Step2}from'./components/Step2.jsx';
import{Step3}from'./components/Step3.jsx';
import{Step4}from'./components/Step4.jsx';
import{Dashboard}from'./components/Dashboard.jsx';
import{AuthModal,ResetPasswordModal,SaveModal,Toast}from'./components/modals.jsx';
import{Legal}from'./components/Legal.jsx';
import{initTelemetry}from'./lib/telemetry.js';
// ─── MAIN APP ─────────────────────────────────────────────────────────────
const STEPS=['Asset Type','Property Info','Income & Expenses','Financing'];

function App(){
  const [view,setView]=useState('landing');
  const [step,setStep]=useState(0);
  const [assetType,setAssetType]=useState('multifamily');
  const [inp,setInp]=useState(DEFS.multifamily);
  const [res,setRes]=useState(null);
  const [loading,setLoading]=useState(false);
  const [user,setUser]=useState(null);
  const [showAuth,setShowAuth]=useState(false);
  const [showReset,setShowReset]=useState(false);
  const [showSave,setShowSave]=useState(false);
  const [currentDealId,setCurrentDealId]=useState(null);
  const [toast,setToast]=useState('');
  const [legalTab,setLegalTab]=useState('privacy');
  const notify=useCallback(m=>{setToast(m);setTimeout(()=>setToast(''),2600);},[]);

  useEffect(()=>{initTelemetry();},[]);

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
    setInp(DEFS[a]||DEFS.multifamily);
    setCurrentDealId(null);
  },[]);

  const handleCalc=()=>{
    setLoading(true);
    setTimeout(()=>{
      try{const r=buildPF(inp);setRes(r);setStep(4);}
      catch(e){alert('Calculation error: '+e.message);}
      setLoading(false);
    },500);
  };

  const handleSave=()=>setShowSave(true);
  const handleLoadDeal=(d)=>{
    setAssetType(d.assetType?d.assetType.toLowerCase():'multifamily');
    setInp(d.inp);
    setCurrentDealId(d.id);
    try{const r=buildPF(d.inp);setRes(r);setStep(4);setView('app');}
    catch(e){setStep(1);setView('app');}
  };

  const progress=(step/STEPS.length)*100;

  return(
    <div style={{minHeight:'100vh',background:'#eef1f7'}}>
      <div style={{background:'rgba(12,19,34,.92)',backdropFilter:'blur(10px)',borderBottom:'1px solid rgba(255,255,255,.08)',padding:'13px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:11,cursor:'pointer'}} onClick={()=>setView('landing')}>
          <svg width="34" height="34" viewBox="0 0 100 100" style={{flexShrink:0}} xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="hdrAccent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7d93ff"/><stop offset="1" stopColor="#5a76f6"/></linearGradient></defs>
            <rect x="20" y="64" width="60" height="14" rx="3.5" fill="#4a5a85"/>
            <rect x="20" y="46" width="60" height="14" rx="3.5" fill="#6b7593"/>
            <rect x="20" y="28" width="60" height="14" rx="3.5" fill="#8a93a6"/>
            <rect x="20" y="10" width="60" height="14" rx="3.5" fill="url(#hdrAccent)"/>
          </svg>
          <div>
            <div style={{fontWeight:700,fontSize:17,lineHeight:1.1,color:'#fff',fontFamily:"'Space Grotesk',sans-serif"}}>Smart<span style={{color:'#7d93ff'}}>Cap</span>Stack</div>
            <div className="mono hide-m" style={{fontSize:9,color:'#6b7593',letterSpacing:'2px',fontWeight:600}}>REAL ESTATE PRO FORMA CREATOR</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {view!=='landing'&&step<4&&step>0&&<span className="mono hide-m" style={{fontSize:11,color:'#6b7593'}}>STEP {step}/{STEPS.length}</span>}
          {view==='landing'&&<button className="btn-p" style={{padding:'7px 18px',fontSize:13}} onClick={()=>setView('app')}>Start an analysis</button>}
          <button onClick={()=>setView('saved')} style={{background:'none',border:'none',cursor:'pointer',fontSize:12.5,color:view==='saved'?'#7d93ff':'#aab3c9',fontWeight:view==='saved'?700:500,padding:0,fontFamily:"'Sora',sans-serif"}}>Saved deals</button>
          {user?(
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {user.user_metadata?.avatar_url
                ?<img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" style={{width:24,height:24,borderRadius:'50%',border:'1px solid rgba(255,255,255,.25)'}}/>
                :null}
              <span className="hide-m" style={{fontSize:11.5,color:'#8a93a6',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.user_metadata?.full_name||user.email}</span>
              <button onClick={async()=>{if(sb)await sb.auth.signOut();setUser(null);}} style={{background:'none',border:'1px solid rgba(255,255,255,.18)',borderRadius:6,cursor:'pointer',fontSize:12,color:'#aab3c9',padding:'4px 10px',fontFamily:"'Sora',sans-serif"}}>Sign Out</button>
            </div>
          ):(
            <button onClick={()=>setShowAuth(true)} style={{background:'var(--accent)',border:'none',borderRadius:6,cursor:'pointer',fontSize:12.5,color:'#fff',padding:'5px 13px',fontWeight:600,fontFamily:"'Sora',sans-serif"}}>Sign In</button>
          )}
          {res&&step<4&&<button className="btn-s" style={{fontSize:12,padding:'6px 14px',background:'rgba(255,255,255,.06)',color:'#fff',borderColor:'rgba(255,255,255,.2)'}} onClick={()=>setStep(4)}>View results →</button>}
        </div>
      </div>

      {view==='landing'&&<Landing onStart={()=>setView('app')} onSample={()=>{const sd={...DEFS.multifamily,propertyName:'Sample Deal'};exportXLSX(buildPF(sd),sd);}}/>}
      {view==='saved'&&<SavedDeals onLoad={handleLoadDeal} onClose={()=>{setView('app');setStep(0);}} user={user} onSignIn={()=>setShowAuth(true)} notify={notify}/>}
      {view==='legal'&&<Legal tab={legalTab} onTab={setLegalTab} onBack={()=>setView('landing')}/>}
      <div style={{maxWidth:1080,margin:'0 auto',padding:'32px 24px 60px',display:(view==='app')?'block':'none'}}>
        {step<4?(
          <>
            <div style={{display:'flex',alignItems:'center',marginBottom:38}}>
              {STEPS.map((s,i)=>(
                <React.Fragment key={i}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:i<step?'pointer':'default'}} onClick={()=>{if(i<step)setStep(i);}}>
                    <div className={`step-dot ${i<step?'done':i===step?'act':'idle'}`}>{i<step?'✓':i+1}</div>
                    <span style={{fontSize:10.5,color:i===step?'#3a5bf0':'#8c8c8c',fontWeight:i===step?700:400,whiteSpace:'nowrap'}}>{s}</span>
                  </div>
                  {i<STEPS.length-1&&<div className={`step-line ${i<step?'done':''}`}/>}
                </React.Fragment>
              ))}
            </div>

            <div className="glass" style={{padding:36,marginBottom:28}}>
              {step===0&&<Step1 val={assetType} onChange={handleAsset}/>}
              {step===1&&<Step2 inp={inp} onChange={update} assetType={assetType}/>}
              {step===2&&<Step3 inp={inp} onChange={update}/>}
              {step===3&&<Step4 inp={inp} onChange={update}/>}
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button className="btn-s" onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0}>← Back</button>
              <div style={{display:'flex',gap:10}}>
                {step<STEPS.length-1?(
                  <button className="btn-p" onClick={()=>setStep(s=>s+1)}>Continue →</button>
                ):(
                  <button className="btn-p" onClick={handleCalc} disabled={loading}
                    style={{minWidth:190,display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                    {loading?'Calculating...':'Generate Pro Forma'}
                  </button>
                )}
              </div>
            </div>
            <div className="prog"><div className="prog-f" style={{width:`${progress}%`}}/></div>
          </>
        ):(
          res&&<Dashboard res={res} inp={inp} onExport={()=>exportXLSX(res,inp)} onBack={()=>setStep(3)} onSave={handleSave}/>
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
      <div style={{textAlign:'center',padding:'18px 20px',borderTop:'1px solid #ececec',color:'#8c8c8c',fontSize:11.5}}>
        <span style={{color:'#737373',fontWeight:600}}>SmartCapStack</span>
        <span style={{margin:'0 8px',color:'#c7cbd4'}}>·</span>
        <button onClick={()=>{setLegalTab('privacy');setView('legal');window.scrollTo(0,0);}} style={{background:'none',border:'none',cursor:'pointer',color:'#3a5bf0',fontSize:11.5,padding:0,fontFamily:"'Sora',sans-serif"}}>Privacy</button>
        <span style={{margin:'0 8px',color:'#c7cbd4'}}>·</span>
        <button onClick={()=>{setLegalTab('terms');setView('legal');window.scrollTo(0,0);}} style={{background:'none',border:'none',cursor:'pointer',color:'#3a5bf0',fontSize:11.5,padding:0,fontFamily:"'Sora',sans-serif"}}>Terms</button>
        <br/>
        <span style={{fontSize:10.5}}>All projections are estimates for informational purposes only. Not financial advice.</span>
      </div>
    </div>
  );
}

export default App;
