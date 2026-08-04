import{useState,useEffect}from'react';
import{sb}from'../lib/supabase.js';
import{persistDeal}from'../lib/deals.js';
import{canSaveDeal,dealLimit,plan}from'../lib/plan.js';
import{loadDeals}from'../lib/deals.js';
import{track}from'../lib/telemetry.js';
import{Fld}from'./ui.jsx';

// Email/password sign-up + reset. Kept behind a flag because it is only safe
// to show when password-reset mail actually gets delivered -- a reset form
// whose email never arrives locks people out with no way back. Delivery now
// runs through Resend on the verified send.smartcapstack.com domain, so the
// form is live. Google OAuth is always available alongside it.
const EMAIL_AUTH=true;
// Google sign-in is hidden for now, not removed: the OAuth call, the provider
// config and every account created through it still work, so flipping this back
// to true restores the button and those users sign straight back into the same
// records. Accounts are matched on email, so a Google user who sets a password
// keeps their saved deals either way.
const GOOGLE_AUTH=false;

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
  const labels=['Too weak','Weak','Fair','Good','Strong'];
  // Monochrome, like everything else here. This used to carry its own traffic
  // -light palette -- three hardcoded hex values in a theme whose whole premise
  // is ink on warm off-white, which is exactly why it read as bolted on. A rule
  // that fills in and a requirement that goes from grey to black say the same
  // thing without importing a second design language.
  return(
    <div style={{marginTop:-4,marginBottom:14}}>
      <div style={{display:'flex',gap:4,marginBottom:7}}>
        {[0,1,2,3].map(i=><div key={i} style={{flex:1,height:2,background:i<score?'var(--text)':'var(--border2)',transition:'background .2s'}}/>)}
      </div>
      <div style={{fontSize:'var(--fs-2)',color:'var(--muted)',fontWeight:600,letterSpacing:'.14em',textTransform:'uppercase',marginBottom:5}}>{labels[score]}</div>
      <div style={{fontSize:'var(--fs-2)',color:'var(--muted2)',lineHeight:1.7}}>
        {checks.map((ch,i)=>(
          <span key={i} style={{color:ch.ok?'var(--text)':'var(--muted2)'}}>
            {ch.label}{i<checks.length-1?<span style={{color:'var(--border2)'}}>&nbsp;·&nbsp;</span>:null}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── AUTH MODAL ───────────────────────────────────────────────────────────
// mode: 'login' | 'signup' | 'reset' (request a reset email)
function AuthView({onClose,onUser}){
  const [mode,setMode]=useState('login');
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [pw2,setPw2]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  // A "we sent you an email" line under a form the user has already finished
  // with reads like the form failed to submit. When there is nothing left to
  // do but go and open an inbox, the form is replaced by the message rather
  // than sitting behind it.
  const [sent,setSent]=useState(null); // {kind:'confirm'|'reset', email}
  const pwOk=pwCheck(pw).strongEnough;
  const submit=async()=>{
    setErr('');setBusy(true);
    try{
      if(!sb)throw new Error('Cloud features are unavailable right now.');
      if(mode==='reset'){
        const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
        if(error)throw error;
        setSent({kind:'reset',email});setBusy(false);return;
      }
      let r;
      if(mode==='login')r=await sb.auth.signInWithPassword({email,password:pw});
      else r=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:window.location.origin+window.location.pathname}});
      if(r.error)throw r.error;
      if(mode==='signup'){
        // Supabase hides "this email is taken" behind a fake success so a
        // signup form cannot be used to harvest which addresses have accounts.
        // The tell is the identities array: a genuinely new user comes back
        // with one, an existing address comes back with none and nothing was
        // created. We choose to say so, because a silent no-op leaves someone
        // waiting forever for a confirmation email that is never coming.
        const u=r.data.user;
        if(u&&Array.isArray(u.identities)&&u.identities.length===0){
          setSent({kind:'exists',email});setBusy(false);return;
        }
        // Sign-ups belong in the same event table as everything else, so "how
        // many people made an account" is answerable next to "how many ran a
        // deal" rather than living in a provider's dashboard. Deliberately no
        // email address or user id: this table is insert-only and holds nothing
        // that identifies a person, and a signup event is no reason to start.
        track('account_created',{confirmRequired:!r.data.session});
        if(!r.data.session){setSent({kind:'confirm',email});setBusy(false);return;}
      }
      if(r.data.user){onUser(r.data.user);onClose();}
    }catch(e){
      const m=e.message||'Authentication failed.';
      // With email confirmation switched off Supabase stops obfuscating and
      // says so outright. Same situation, same panel.
      if(mode==='signup'&&/already registered|already exists/i.test(m))setSent({kind:'exists',email});
      else setErr(m);
    }
    setBusy(false);
  };
  // Offered straight from the "already have an account" panel, because that is
  // the moment someone realises they have forgotten their password.
  const sendReset=async()=>{
    setErr('');setBusy(true);
    try{
      if(!sb)throw new Error('Cloud features are unavailable right now.');
      const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
      if(error)throw error;
      setSent({kind:'reset',email});
    }catch(e){setErr(e.message||'Could not send the reset link.');}
    setBusy(false);
  };
  const switchMode=m=>{setMode(m);setErr('');setMsg('');setPw('');setPw2('');};
  // A typo in a password you cannot see is only discoverable at the reset
  // screen, so sign-up asks twice. Only complain once there is something to
  // compare -- flagging a mismatch against a half-typed second entry is noise.
  const pwMismatch=mode==='signup'&&pw2.length>0&&pw!==pw2;
  const google=async()=>{
    setErr('');setBusy(true);
    try{
      if(!sb)throw new Error('Cloud features are unavailable right now.');
      const{error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});
      if(error)throw error;
    }catch(e){setErr(e.message||'Google sign-in failed.');}
    // Always release the button. This used to stay latched on the assumption
    // that success navigates away -- but when the redirect does not happen, the
    // flag is shared with the email form, so every other way in reads "Please
    // wait..." and is disabled with nothing to click.
    setBusy(false);
  };
  const title=mode==='login'?'Sign In':mode==='signup'?'Create Account':'Reset Password';
  const cta=busy?'Please wait…':mode==='login'?'Sign In':mode==='signup'?'Create Account':'Send Reset Link';
  const disabled=busy||!email||(mode==='login'&&!pw)||(mode==='signup'&&(!pwOk||pw!==pw2));
  return(
    // A page, not a dialog. Signing in is a destination -- it deserves a URL's
    // worth of presence, room to breathe, and the same fade-up every other view
    // gets, rather than a square that appears over the top of the work.
    <div className="fu" style={{maxWidth:430,margin:'0 auto',padding:'64px 24px 96px'}}>
      {/* Enter submits. Typing a password and reaching for the mouse is not how
          anyone fills in a login, and the button is the only thing that knows
          whether the form is complete -- so Enter defers to the same disabled
          check rather than firing a request the button would have refused. */}
      <div className="card" style={{padding:'34px 30px',marginBottom:20}}
        onKeyDown={e=>{
          if(e.key!=='Enter')return;
          if(sent){e.preventDefault();onClose();return;}
          if(EMAIL_AUTH&&!disabled){e.preventDefault();submit();}
        }}>
        {sent?(<>
          <h2 style={{fontSize:'var(--fs-8)',fontWeight:700,marginBottom:10}}>
            {sent.kind==='confirm'?'Account created':sent.kind==='reset'?'Reset link sent':'That email already has an account'}
          </h2>
          {sent.kind==='exists'?(<>
            <p style={{color:'var(--muted)',fontSize:'var(--fs-4)',lineHeight:1.65,marginBottom:8}}>
              There is already an account for
            </p>
            <p className="mono" style={{fontSize:'var(--fs-4)',fontWeight:600,marginBottom:20,wordBreak:'break-all'}}>{sent.email}</p>
            <p style={{color:'var(--muted)',fontSize:'var(--fs-3)',lineHeight:1.65,marginBottom:24}}>
              Nothing new was created. Sign in with the password you set, or have a link sent to set a new one.
            </p>
            <div style={{display:'flex',gap:22,alignItems:'baseline',flexWrap:'wrap'}}>
              <button className="btn-p" onClick={()=>{setSent(null);setMode('login');setPw('');setPw2('');}}>Sign in →</button>
              <button className="btn-s" disabled={busy} onClick={sendReset}>{busy?'Sending…':'Email me a reset link'}</button>
            </div>
            {err&&<div style={{color:'var(--neg)',fontSize:'var(--fs-3)',marginTop:14}}>{err}</div>}
          </>):(<>
            <p style={{color:'var(--muted)',fontSize:'var(--fs-4)',lineHeight:1.65,marginBottom:8}}>
              {sent.kind==='confirm'?'Open the confirmation link we sent to':'Open the link we sent to'}
            </p>
            <p className="mono" style={{fontSize:'var(--fs-4)',fontWeight:600,marginBottom:20,wordBreak:'break-all'}}>{sent.email}</p>
            <p style={{color:'var(--muted)',fontSize:'var(--fs-3)',lineHeight:1.65,marginBottom:24}}>
              {sent.kind==='confirm'
                ?'Then come back and sign in. If it has not arrived in a minute, check your spam folder.'
                :'The link sets a new password. If it has not arrived in a minute, check your spam folder.'}
            </p>
            <button className="btn-p" onClick={onClose}>Done</button>
          </>)}
        </>):(<>
        <h2 style={{fontSize:'var(--fs-8)',fontWeight:700,marginBottom:4}}>{title}</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-4)',marginBottom:22}}>
          {mode==='reset'?"Enter your account email and we'll send you a link to set a new password.":'Save your deals to the cloud and access them from any device.'}
        </p>
        {GOOGLE_AUTH&&mode!=='reset'&&<button onClick={google} disabled={busy} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'11px 16px',background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:8,fontSize:'var(--fs-5)',fontWeight:600,color:'var(--text)',cursor:'pointer',fontFamily:"'Inter',sans-serif",marginBottom:EMAIL_AUTH?18:8}}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>}
        {EMAIL_AUTH&&<>
          {/* "or use email" only means something when there is another way in */}
          {GOOGLE_AUTH&&mode!=='reset'&&<div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
            <div style={{flex:1,height:1,background:'var(--border)'}}/>
            <span style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>or use email</span>
            <div style={{flex:1,height:1,background:'var(--border)'}}/>
          </div>}
          <Fld label="Email" type="email" value={email} onChange={v=>setEmail(v)}/>
          {mode!=='reset'&&<Fld label="Password" type="password" value={pw} onChange={v=>setPw(v)}/>}
          {mode==='signup'&&<PwMeter pw={pw}/>}
          {mode==='signup'&&<>
            <Fld label="Confirm Password" type="password" value={pw2} onChange={v=>setPw2(v)}/>
            {pwMismatch&&<div style={{color:'var(--neg)',fontSize:'var(--fs-3)',marginTop:-10,marginBottom:12}}>Passwords do not match.</div>}
          </>}
          {/* its own line: once the submit button stopped being full-width the
              two sat side by side and read as one run-on string */}
          {mode==='login'&&<button onClick={()=>switchMode('reset')} style={{display:'block',background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'var(--fs-3)',padding:0,marginTop:-4,marginBottom:4,borderBottom:'1px solid var(--border2)',fontFamily:"'Inter',sans-serif"}}>Forgot password?</button>}
        </>}
        {err&&<div style={{color:'var(--neg)',fontSize:'var(--fs-4)',marginBottom:10,marginTop:4}}>{err}</div>}
        {msg&&<div style={{color:'var(--pos)',fontSize:'var(--fs-4)',marginBottom:10,marginTop:4}}>{msg}</div>}
        {/* btn-p is an underlined text action, so stretching it to full width
            left a lonely rule across the panel. It sits at its own width, like
            Continue does on every wizard step. */}
        {EMAIL_AUTH&&<button className="btn-p" onClick={submit} disabled={disabled} style={{display:'block',marginBottom:22,marginTop:18}}>{cta}</button>}
        {EMAIL_AUTH&&<div style={{fontSize:'var(--fs-4)',color:'var(--muted)'}}>
          {mode==='login'&&<>No account? <button onClick={()=>switchMode('signup')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:'var(--fs-4)',fontFamily:"'Inter',sans-serif"}}>Sign Up</button></>}
          {mode==='signup'&&<>Have an account? <button onClick={()=>switchMode('login')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:'var(--fs-4)',fontFamily:"'Inter',sans-serif"}}>Sign In</button></>}
          {mode==='reset'&&<button onClick={()=>switchMode('login')} style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:'var(--fs-4)',fontFamily:"'Inter',sans-serif"}}>← Back to sign in</button>}
        </div>}
        </>)}
      </div>
      <button className="btn-s" onClick={onClose}>← Back</button>
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
        <h2 style={{fontSize:'var(--fs-8)',fontWeight:700,marginBottom:4}}>Set a New Password</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-4)',marginBottom:22}}>Choose a new password for your account.</p>
        <Fld label="New password" type="password" value={pw} onChange={v=>setPw(v)}/>
        <PwMeter pw={pw}/>
        <Fld label="Confirm new password" type="password" value={pw2} onChange={v=>setPw2(v)}/>
        {err&&<div style={{color:'var(--neg)',fontSize:'var(--fs-4)',marginBottom:10,marginTop:4}}>{err}</div>}
        <button className="btn-p" onClick={submit} disabled={busy||!pwOk||!pw2} style={{width:'100%',marginTop:6}}>{busy?'Saving…':'Update Password'}</button>
      </div>
    </div>
  );
}

// ─── SAVE MODAL & TOAST ───────────────────────────────────────────────────
function Toast({msg,action}){
  if(!msg)return null;
  return(
    <div className="fu" style={{position:'fixed',bottom:26,left:'50%',transform:'translateX(-50%)',background:'var(--surface)',color:'var(--text)',border:'1px solid var(--text)',padding:'11px 22px',borderRadius:0,fontSize:'var(--fs-4)',fontWeight:600,zIndex:600,boxShadow:'var(--shadow-lg)',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:18}}>
      <span>{msg}</span>
      {action&&<button onClick={action.run} style={{background:'none',border:'none',borderBottom:'1px solid var(--text)',borderRadius:0,padding:'1px 0',cursor:'pointer',font:'inherit',color:'var(--text)'}}>{action.label}</button>}
    </div>
  );
}
function SaveModal({inp,res,user,existingId,onClose,onSaved,onSignIn,onUpgrade}){
  const [name,setName]=useState(inp.propertyName||'');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  // The cap is on how many deals are kept, so it is checked against what is
  // already stored rather than trusted from a prop. Read once when the modal
  // opens; null means "not counted yet", which never blocks a save.
  const [count,setCount]=useState(null);
  useEffect(()=>{let live=true;
    loadDeals(user).then(d=>{if(live)setCount(Array.isArray(d)?d.length:0)}).catch(()=>{});
    return()=>{live=false};
  },[user]);
  const known=count==null?[]:new Array(count);
  const atCap=count!=null&&!canSaveDeal(known,user,existingId);
  // "Save as new copy" needs a free slot even when the deal it copies has one
  const copyAtCap=count!=null&&!canSaveDeal(known,user,null);
  const doSave=async asNew=>{
    if(asNew?copyAtCap:atCap)return;
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
        <button onClick={onClose} style={{position:'absolute',top:12,right:14,background:'none',border:'none',fontSize:'var(--fs-8)',cursor:'pointer',color:'var(--muted)',lineHeight:1}}>&times;</button>
        <h2 style={{fontSize:'var(--fs-8)',fontWeight:700,marginBottom:4}}>{existingId?'Update deal':'Save deal'}</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-4)',marginBottom:18}}>
          {user?'Saved to your account and synced across devices.':"You're not signed in — this deal will only be saved in this browser."}
        </p>
        <Fld label="Deal name" value={name} onChange={v=>setName(v)}/>
        {err&&<div style={{color:'var(--neg)',fontSize:'var(--fs-4)',marginBottom:10,marginTop:-4}}>{err}</div>}
        {atCap&&(
          <div style={{background:'var(--warn-tint)',border:'1px solid var(--warn-brd)',padding:'11px 14px',marginBottom:12,fontSize:'var(--fs-4)',color:'var(--text)',lineHeight:1.5}}>
            You have {count} saved {count===1?'deal':'deals'}, the limit on the{' '}
            {plan(user)==='pro'?'Pro':'free'} plan. {plan(user)==='pro'
              ?'Broker saves without limit.'
              :'Upgrade to save more.'} You can also delete one you no longer need &mdash;
            nothing you have saved is at risk.
            {onUpgrade&&<button className="btn-s" onClick={onUpgrade} style={{display:'block',marginTop:9,fontSize:'var(--fs-3)'}}>See plans</button>}
          </div>
        )}
        <button className="btn-p" onClick={()=>doSave(false)} disabled={busy||atCap} style={{width:'100%',marginTop:4,opacity:atCap?.5:1,cursor:atCap?'not-allowed':undefined}}>
          {busy?'Saving…':atCap?`Plan limit: ${dealLimit(user)} saved`:(existingId?'Update deal':'Save deal')}
        </button>
        {existingId&&<button className="btn-s" onClick={()=>doSave(true)} disabled={busy||copyAtCap} style={{width:'100%',marginTop:8,opacity:copyAtCap?.5:1,cursor:copyAtCap?'not-allowed':undefined}}>Save as new copy</button>}
        {!user&&<button onClick={onSignIn} style={{display:'block',margin:'14px auto 0',background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontWeight:600,fontSize:'var(--fs-4)',fontFamily:"'Inter',sans-serif"}}>Sign in to save to the cloud</button>}
      </div>
    </div>
  );
}

export{AuthView,ResetPasswordModal,SaveModal,Toast};
