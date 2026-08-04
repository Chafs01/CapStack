import{sb}from'./supabase.js';
// ─── BILLING ──────────────────────────────────────────────────────────────
// Thin client over the three Edge Functions. Everything that could be abused
// lives server-side: this file knows how to ask, never what to charge.
//
// Each call sends the user's access token and nothing identifying beyond it.
// The functions read identity from that token rather than from a body, so a
// tampered request can only ever act on the sender's own account.

const FN=name=>{
  const base=import.meta.env.VITE_SUPABASE_URL;
  return base?`${String(base).replace(/\/+$/,'')}/functions/v1/${name}`:null;
};

async function call(name,body){
  const url=FN(name);
  if(!url||!sb)throw new Error('Billing is not configured yet.');
  const{data:{session}}=await sb.auth.getSession();
  if(!session)throw new Error('Please sign in first.');
  const res=await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
    body:JSON.stringify(body||{}),
  });
  let data=null;
  try{data=await res.json();}catch(e){/* non-JSON error page */}
  if(!res.ok||!data||data.error)throw new Error((data&&data.error)||`Request failed (${res.status})`);
  return data;
}

// Both of these hand back a Stripe-hosted URL. Navigating rather than opening
// a new tab: pop-up blockers eat a window opened after an await, and losing
// the checkout to a blocked pop-up looks like the payment failing.
async function startCheckout(plan){
  const{url}=await call('create-checkout-session',{plan});
  if(!url)throw new Error('Checkout did not return a link.');
  window.location.href=url;
}

async function openBillingPortal(){
  const{url}=await call('billing-portal');
  if(!url)throw new Error('The billing portal did not return a link.');
  window.location.href=url;
}

// Stripe sends the customer back to /account?checkout=success. The webhook is
// what actually grants the plan, and it may land a moment after the redirect,
// so the caller refreshes the session rather than trusting the query string —
// a URL parameter is not evidence that anyone paid.
function checkoutOutcome(){
  try{
    const q=new URLSearchParams(window.location.search).get('checkout');
    return q==='success'||q==='cancelled'?q:null;
  }catch(e){return null;}
}
function clearCheckoutParam(){
  try{
    const u=new URL(window.location.href);
    u.searchParams.delete('checkout');
    window.history.replaceState(null,'',u.pathname+(u.search||'')+(u.hash||''));
  }catch(e){/* history blocked — harmless */}
}

export{startCheckout,openBillingPortal,checkoutOutcome,clearCheckoutParam};
