import{useState}from'react';
import{sb}from'../lib/supabase.js';
import{persistDeal}from'../lib/deals.js';
import{Fld}from'./ui.jsx';

// Email/password sign-up + reset is built but hidden until branded email
// delivery is set up. Flip to true to re-enable the email form. Google OAuth
// is always available.
const EMAIL_AUTH=false;

// ─── PASSWORD STRENGTH ─────────────────────────────────────────────────────
// Requirement checklist + 0-4 score. The first three (length, mixed case,
// number) are the floor to enable sign-up; a symbol pushes it to "Strong".
function pwCheck(pw){
  const checks=[
    {label:'At least 8 characters',ok:pw.length>=8},
    {label:'Upper & lowercase letters',ok:/[a-z]/.test(pw)&&/[A-Z]/.test(pw)},
    {label:'A number',ok:/[0-9]/.test(pw)},
    {label:'A symbol (!?@#…)',ok:/[^A-Za-z0-9]/.test(pw)},
  ];
  const score=checks.filter(c=>c.ok).length;
  const strongEnough=checks[0].ok&&checks[1].ok&&checks[2].ok;
  return{checks,score,strongEnough};
}
function PwMeter({pw}){
  const{checks,score}=pwCheck(pw);
  if(!pw)return null;
  const bands=['#e02424','#e02424','#c27803','#0e9f6e','#0e9f6e'];
  const labels=['Too weak','Weak','Fair','Good','Strong'];
  const c=bands[score];
  return(
    <div style={{marginTop:-4,marginBottom:12}}>
      <div style={{display:'flex',gap:4,marginBottom:7}}>
        {[0,1,2,3].map(i=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<score?c:'var(--border2)',transition:'background .2s'}}/>)}
      </div>
      <div style={{fontSize:11.5,color:c,fontWeight:600,marginBottom:6}}>{labels[score]}</div>
      <div style={{display:'grid',gap:3}}>
        {checks.map((ch,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:11.5,color:ch.ok?'var(--pos)':'var(--muted2)'}}>
            <span style={{fontWeight:700,width:11}}>{ch.ok?'✓':'○'}</span>{ch.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────
// mode: 'login' | 'signup' | 'reset' (request a reset email)
function AuthModal({onClose,onUser}){
  const [mode,setMode]=useState('login');
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const pwOk=pwCheck(pw).strongEnough;
  const submit=async()=>{
    setErr('');setBusy(true);
    try{
      if(!sb)throw new Error('Cloud features are unavailable right now.');
      if(mode==='reset'){
        const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
        if(error)throw error;
        setMsg('Check your email for a link to reset your password.');setBusy(false);return;
      }
      let r;
      if(mode==='login')r=await sb.auth.signInWithPassword({email,password:pw});
      else r=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
      if(r.error)throw r.error;
      if(mode==='signup'&&!r.data.session){setMsg('Account created. Check your email to confirm, then sign in.');setBusy(false);return;}
      if(r.data.user){onUser(r.data.user);onClose();}
    }catch(e){setErr(e.message||'Authentication failed.');}
    setBusy(false);
  };
  const switchMode=m=>{setMode(m);setErr('');setMsg('');setPw('');};
  const google=async()=>{
    setErr('');setBusy(true);
    try{
      if(!sb)throw new Error('Cloud features are unavailable right now.');
      const{error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});
      if(error)throw error;
      // success navigates away; leave busy on so the button stays disabled
    }catch(e){setErr(e.message||'Google sign-in failed.');setBusy(false);}
  };
  const title=mode==='login'?'Sign In':mode==='signup'?'Create Account':'Reset Password';
  const cta=busy?'Please wait…':mode==='login'?'Sign In':mode==='signup'?'Create Account':'Send Reset Link';
  const disabled=busy||!email||(mode==='login'&&!pw)||(mode==='signup'&&!pwOk);
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="glass" style={{width:'100%',maxWidth:420,padding:'32px 28px',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:12,right:14,background:'none',border:'none',fontSize:22,cursor:'pointer',color:'var(--muted)',lineHeight:1}}>&times;</button>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{title}</h2>
        <p style={{color:'var(--muted)',fontSize:13.5,marginBottom:22}}>
          {mode==='reset'?"Enter your account email and we'll send you a link to set a new password.":'Save your deals to the cloud and access them from any device.'}
        </p>
        {mode!=='reset'&&<button onClick={google} disabled={busy} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'11px 16px',background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:8,fontSize:14,fontWeight:600,color:'var(--text)',cursor:'pointer',fontFamily:"'Sora',sans-serif",marginBottom:EMAIL_AUTH?18:8}}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>}
        {EMAIL_AUTH&&<>
          {mode!=='reset'&&<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
            <div style={{flex:1,height:1,background:'var(--border)'}}/>
            <span style={{fontSize:12,color:'var(--muted2)'}}>or use email</span>
            <div style={{flex:1,height:1,background:'var(--border)'}}/>
          </div>}
          <Fld label="Email" type="email" value={email} onChange={v=>setEmail(v)}/>
          {mode!=='reset'&&<Fld label="Password" type="password" value={pw} onChange={v=>setPw(v)}/>}
          {mode==='signup'&&<PwMeter pw={pw}/>}
          {mode==='login'&&<button onClick={()=>switchMode('reset')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12.5,padding:0,marginTop:-6,marginBottom:8,fontFamily:"'Sora',sans-serif"}}>Forgot password?</button>}
        </>}
        {err&&<div style={{color:'var(--neg)',fontSize:13,marginBottom:10,marginTop:4}}>{err}</div>}
        {msg&&<div style={{color:'var(--pos)',fontSize:13,marginBottom:10,marginTop:4}}>{msg}</div>}
        {EMAIL_AUTH&&<button className="btn-p" onClick={submit} disabled={disabled} style={{width:'100%',marginBottom:16,marginTop:6}}>{cta}</button>}
        {EMAIL_AUTH&&<div style={{textAlign:'center',fontSize:13,color:'var(--muted)'}}>
          {mode==='login'&&<>No account? <button onClick={()=>switchMode('signup')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:"'Sora',sans-serif"}}>Sign Up</button></>}
          {mode==='signup'&&<>Have an account? <button onClick={()=>switchMode('login')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:"'Sora',sans-serif"}}>Sign In</button></>}
          {mode==='reset'&&<button onClick={()=>switchMode('login')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:13,fontFamily:"'Sora',sans-serif"}}>← Back to sign in</button>}
        </div>}
      </div>
    </div>
  );
}

// ─── RESET PASSWORD MODAL ──────────────────────────────────────────────────
// Shown after the user returns from a password-reset email (Supabase fires a
// PASSWORD_RECOVERY event). Sets a new password on the recovered session.
function ResetPasswordModal({onDone}){
  const [pw,setPw]=useState('');
  const [pw2,setPw2]=useState('');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const pwOk=pwCheck(pw).strongEnough;
  const submit=async()=>{
    setErr('');
    if(pw!==pw2){setErr('Passwords do not match.');return;}
    setBusy(true);
    try{
      if(!sb)throw new Error('Cloud features are unavailable right now.');
      const{error}=await sb.auth.updateUser({password:pw});
      if(error)throw error;
      onDone();
    }catch(e){setErr(e.message||'Could not update password.');setBusy(false);}
  };
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div className="glass" style={{width:'100%',maxWidth:420,padding:'32px 28px'}}>
        <h2 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Set a New Password</h2>
        <p style={{color:'var(--muted)',fontSize:13.5,marginBottom:22}}>Choose a new password for your account.</p>
        <Fld label="New password" type="password" value={pw} onChange={v=>setPw(v)}/>
        <PwMeter pw={pw}/>
        <Fld label="Confirm new password" type="password" value={pw2} onChange={v=>setPw2(v)}/>
        {err&&<div style={{color:'var(--neg)',fontSize:13,marginBottom:10,marginTop:4}}>{err}</div>}
        <button className="btn-p" onClick={submit} disabled={busy||!pwOk||!pw2} style={{width:'100%',marginTop:6}}>{busy?'Saving…':'Update Password'}</button>
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

export{AuthModal,ResetPasswordModal,SaveModal,Toast};
