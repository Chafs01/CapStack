import{useState}from'react';
import{plan}from'../lib/plan.js';
import{startCheckout}from'../lib/billing.js';
// ─── PRICING ──────────────────────────────────────────────────────────────
// What each plan costs and what it actually changes. Written as differences
// rather than a feature matrix with ticks in every row: a free tier that lists
// "underwriting" as a feature reads like the paid tiers might not include it.
//
// The free column is deliberately generous-sounding, because it is generous —
// every number the model produces is on screen. What is sold is help reading
// those numbers, and the documents that leave the app.

const TIERS=[
  {
    id:'free',name:'Free',price:'$0',cadence:'',
    line:'Underwrite anything. Keep the numbers.',
    points:[
      'Every figure on screen — IRR, cap rate, DSCR, the full pro forma table, sensitivity, yield on cost',
      'All five asset types, and the section explainers',
      'One saved deal',
    ],
    lacks:['No exports','No analyst notes or deal-health detail','No portfolio roll-up'],
  },
  {
    id:'pro',name:'Pro',price:'$10',cadence:'/ month',
    line:'The reading, and the documents.',
    points:[
      'Everything in Free',
      'Analyst notes and every deal-health finding, with what to do about each',
      'Live-formula Excel workbook and the investment memo',
      'Unlimited saved deals, share links, portfolio roll-up',
    ],
    lacks:[],
    highlight:true,
  },
  {
    id:'plus',name:'Broker',price:'$50',cadence:'/ month',
    line:'The same work, under your name.',
    points:[
      'Everything in Pro',
      'Your firm name and contact line on the memo and the workbook, instead of ours',
      'Exports drop the SmartCapStack credit and filename',
    ],
    lacks:[],
  },
];

function Pricing({user,onBack,onSignIn,notify}){
  const current=plan(user);
  const [busy,setBusy]=useState('');
  const go=async id=>{
    if(!user){onSignIn();return;}
    setBusy(id);
    try{await startCheckout(id);}
    catch(e){notify&&notify(e.message||'Could not start checkout.');setBusy('');}
  };
  return(
    <div className="fu" style={{maxWidth:1000,margin:'0 auto',padding:'32px 24px 60px'}}>
      <button className="btn-s" onClick={onBack} style={{marginBottom:20}}>&larr; Back</button>
      <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>Plans</h2>
      <p style={{fontSize:'var(--fs-5)',color:'var(--muted)',lineHeight:1.6,marginBottom:26}}>
        The model is free to use and always will be — every number it produces stays on
        screen on any plan. What you pay for is the layer that tells you whether those
        numbers are any good, and the documents you send to a lender.
      </p>

      {/* Equal heights, deliberately. With alignItems:'start' each card shrank
          to its own content, which made Broker — the dearest plan — the
          smallest box on the page and read as the least substantial. */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16,alignItems:'stretch'}}>
        {TIERS.map(t=>{
          const isCurrent=current===t.id;
          return(
            <div key={t.id} className="glass" style={{padding:'24px 22px',
              borderColor:t.highlight?'var(--accent)':'var(--border)',
              borderWidth:t.highlight?2:1,
              display:'flex',flexDirection:'column',height:'100%'}}>
              <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8}}>
                <div className="eyebrow" style={{color:t.highlight?'var(--accent)':'var(--muted2)'}}>{t.name}</div>
                {isCurrent&&<span style={{fontSize:'var(--fs-2)',fontWeight:700,color:'var(--pos)'}}>CURRENT</span>}
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:5,marginTop:8}}>
                <span className="mono" style={{fontSize:'var(--fs-9)',fontWeight:800}}>{t.price}</span>
                <span style={{fontSize:'var(--fs-3)',color:'var(--muted)'}}>{t.cadence}</span>
              </div>
              <div style={{fontSize:'var(--fs-4)',color:'var(--text)',marginTop:6,lineHeight:1.5}}>{t.line}</div>

              <ul style={{listStyle:'none',padding:0,margin:'16px 0 0',flex:1}}>
                {t.points.map((p,i)=>(
                  <li key={i} style={{display:'flex',gap:9,padding:'6px 0',fontSize:'var(--fs-3)',color:'var(--text)',lineHeight:1.55}}>
                    <span aria-hidden="true" style={{color:'var(--pos)',flexShrink:0}}>&#10003;</span>{p}
                  </li>
                ))}
                {t.lacks.map((p,i)=>(
                  <li key={'x'+i} style={{display:'flex',gap:9,padding:'6px 0',fontSize:'var(--fs-3)',color:'var(--muted2)',lineHeight:1.55}}>
                    <span aria-hidden="true" style={{flexShrink:0}}>&mdash;</span>{p}
                  </li>
                ))}
              </ul>

              <div style={{marginTop:18}}>
                {t.id==='free'?(
                  <div style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>No card. No expiry.</div>
                ):isCurrent?(
                  <div style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>This is your plan.</div>
                ):(
                  <button className={t.highlight?'btn-p':'btn-s'} style={{width:'100%'}}
                    disabled={busy===t.id} onClick={()=>go(t.id)}>
                    {busy===t.id?'Opening checkout…':(user?`Choose ${t.name}`:'Sign in to choose')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{fontSize:'var(--fs-3)',color:'var(--muted)',lineHeight:1.6,marginTop:24}}>
        Cancel any time from your account page; you keep the plan until the period you
        have paid for ends. Nothing you have saved is ever deleted for downgrading — over
        the free limit, older deals become read-only rather than disappearing.
      </p>
    </div>
  );
}

export{Pricing,TIERS};
