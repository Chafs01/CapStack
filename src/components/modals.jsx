import{useState}from'react';
import{sb}from'../lib/supabase.js';
import{persistDeal}from'../lib/deals.js';
import{Fld}from'./ui.jsx';
// ─── AUTH MODAL ───────────────────────────────────────────────────────────
function AuthModal({onClose,onUser}){
  const [mode,setMode]=useState('login');
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const submit=async()=>{
    setErr('');setBusy(true);
    try{
      if(!sb)throw new Error('Cloud features are unavailable right now.');
      let r;
      if(mode==='login')r=await sb.auth.signInWithPassword({email,password:pw});
      else r=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
      if(r.error)throw r.error;
      if(mode==='signup'&&!r.data.session){setMsg('Check your email to confirm your account.');setBusy(false);return;}
      if(r.data.user){onUser(r.data.user);onClose();}
    }catch(e){setErr(e.message||'Authentication failed.');}
    setBusy(false);
  };
  const switchMode=m=>{setMode(m);setErr('');setMsg('');};
  const google=async()=>{
    setErr('');setBusy(true);
    try{
      if(!sb)throw new Error('Cloud features are unavailable right now.');
      const{error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});
      if(error)throw error;
      // success navigates away; leave busy on so the button stays disabled
    }catch(e){setErr(e.message||'Google sign-in failed.');setBusy(false);}
  };
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="glass" style={{width:'100%',maxWidth:420,padding:'32px 28px',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:14,background:'none',border:'none',fontSize:22,cursor:'pointer',color:'var(--muted)',lineHeight:1}}>&times;</button>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{mode==='login'?'Sign In':'Create Account'}</h2>
        <p style={{color:'var(--muted)',fontSize:13.5,marginBottom:22}}>Save your deals to the cloud and access them from any device.</p>
        <button onClick={google} disabled={busy} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'11px 16px',background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:8,fontSize:14,fontWeight:600,color:'var(--text)',cursor:'pointer',fontFamily:"'Sora',sans-serif",marginBottom:18}}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{flex:1,height:1,background:'var(--border)'}}/>
          <span style={{fontSize:12,color:'var(--muted2)'}}>or use email</span>
          <div style={{flex:1,height:1,background:'var(--border)'}}/>
        </div>
        <Fld label="Email" type="email" value={email} onChange={v=>setEmail(v)}/>
        <Fld label="Password" type="password" value={pw} onChange={v=>setPw(v)}/>
        {err&&<div style={{color:'var(--neg)',fontSize:13,marginBottom:10,marginTop:-4}}>{err}</div>}
        {msg&&<div style={{color:'var(--pos)',fontSize:13,marginBottom:10,marginTop:-4}}>{msg}</div>}
        <button className="btn-p" onClick={submit} disabled={busy||!email||!pw} style={{width:'100%',marginBottom:16,marginTop:6}}>
          {busy?'Please wait…':(mode==='login'?'Sign In':'Create Account')}
        </button>
        <div style={{textAlign:'center',fontSize:13,color:'var(--muted)'}}>
          {mode==='login'
            ?<>No account? <button onClick={()=>switchMode('signup')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:"'Sora',sans-serif"}}>Sign Up</button></>
            :<>Have an account? <button onClick={()=>switchMode('login')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:"'Sora',sans-serif"}}>Sign In</button></>}
        </div>
      </div>
    </div>
  );
}

// ─── SAVE MODAL & TOAST ───────────────────────────────────────────────────
function Toast({msg}){
  if(!msg)return null;
  return <div className="fu" style={{position:'fixed',bottom:26,left:'50%',transform:'translateX(-50%)',background:'var(--ink)',color:'#fff',padding:'11px 22px',borderRadius:10,fontSize:13.5,fontWeight:600,zIndex:600,boxShadow:'var(--shadow-lg)',whiteSpace:'nowrap'}}>{msg}</div>;
}
function SaveModal({inp,res,user,existingId,onClose,onSaved,onSignIn}){
  const [name,setName]=useState(inp.propertyName||'');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const doSave=async asNew=>{
    setBusy(true);setErr('');
    try{
      const useId=asNew?null:existingId;
      const finalName=name||inp.propertyName||'Untitled Deal';
      const id=await persistDeal({...inp,propertyName:finalName},res,user,{id:useId,name:finalName});
      onSaved(id,useId?'updated':'saved',finalName);
    }catch(e){setErr(e.message||'Could not save.');}
    setBusy(false);
  };
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="glass" style={{width:'100%',maxWidth:420,padding:'30px 28px',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:14,background:'none',border:'none',fontSize:22,cursor:'pointer',color:'var(--muted)',lineHeight:1}}>&times;</button>
        <h2 style={{fontSize:21,fontWeight:700,marginBottom:4}}>{existingId?'Update deal':'Save deal'}</h2>
        <p style={{color:'var(--muted)',fontSize:13,marginBottom:18}}>
          {user?'Saved to your account and synced across devices.':"You're not signed in — this deal will only be saved in this browser."}
        </p>
        <Fld label="Deal name" value={name} onChange={v=>setName(v)}/>
        {err&&<div style={{color:'var(--neg)',fontSize:13,marginBottom:10,marginTop:-4}}>{err}</div>}
        <button className="btn-p" onClick={()=>doSave(false)} disabled={busy} style={{width:'100%',marginTop:4}}>
          {busy?'Saving…':(existingId?'Update deal':'Save deal')}
        </button>
        {existingId&&<button className="btn-s" onClick={()=>doSave(true)} disabled={busy} style={{width:'100%',marginTop:8}}>Save as new copy</button>}
        {!user&&<button onClick={onSignIn} style={{display:'block',margin:'14px auto 0',background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:"'Sora',sans-serif"}}>Sign in to save to the cloud</button>}
      </div>
    </div>
  );
}

export{AuthModal,SaveModal,Toast};
