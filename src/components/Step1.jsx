
// ─── STEP 1 ASSET TYPE ────────────────────────────────────────────────────
const ASSETS=[
  {id:'multifamily',abbr:'MF',label:'Multifamily',sub:'Apartments, condos, townhomes',c:'#3a5bf0'},
  {id:'commercial',abbr:'CRE',label:'Commercial',sub:'Office, retail, industrial NNN',c:'#56687a'},
  {id:'mixed-use',abbr:'MXU',label:'Mixed-Use',sub:'Residential + commercial floors',c:'#1a7f37'},
  {id:'development',abbr:'DEV',label:'Development',sub:'Ground-up construction / value-add',c:'#b54708'},
  {id:'affordable',abbr:'LIHTC',label:'Affordable / LIHTC',sub:'Tax-credit & syndication underwriting',c:'#7a5195'},
];

const ASSET_DESC={
  multifamily:{
    what:'Apartment and rental-housing acquisitions, underwritten on stabilized operations.',
    models:'You build a unit-mix rent roll, set vacancy and operating expenses, and the model runs a ten-year levered return with exit at your cap rate.'
  },
  commercial:{
    what:'Office, retail, and industrial properties driven by tenant and NNN income.',
    models:'You enter income by tenant or space plus CAM recovery, and the model carries it through to returns driven by lease income and the exit cap.'
  },
  'mixed-use':{
    what:'Combined residential and commercial assets under a single capital stack.',
    models:'You model an apartment unit mix and ground-floor retail as separate income streams, and the model blends them into one set of returns.'
  },
  development:{
    what:'Ground-up construction and heavier value-add projects.',
    models:'You enter land, hard and soft costs, and a developer fee, and the model bases returns on total development cost rather than a purchase price.'
  },
  affordable:{
    what:'Low-Income Housing Tax Credit deals and tax-credit syndication.',
    models:'The model runs the full credit calculation, sizes a loan to your minimum DSCR, raises syndication equity, and fills the gap with a deferred developer fee.'
  }
};
function Step1({val,onChange}){
  const cur=ASSETS.find(a=>a.id===val)||ASSETS[0];
  const d=ASSET_DESC[cur.id]||{};
  return(
    <div className="fu">
      <h2 style={{fontSize:23,fontWeight:700,marginBottom:6}}>What are you underwriting?</h2>
      <p style={{color:'var(--muted)',marginBottom:26,fontSize:14}}>Pick the asset type and the model adapts its inputs and outputs to match.</p>

      <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Asset type</label>
      <div style={{position:'relative',maxWidth:440}}>
        <span style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',width:11,height:11,borderRadius:3,background:cur.c,pointerEvents:'none'}}/>
        <select value={cur.id} onChange={e=>onChange(e.target.value)}
          style={{width:'100%',appearance:'none',WebkitAppearance:'none',background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:10,padding:'15px 44px 15px 38px',fontSize:16,fontWeight:600,color:'var(--text)',fontFamily:"'Sora',sans-serif",cursor:'pointer',boxShadow:'var(--shadow)',outline:'none'}}>
          {ASSETS.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" style={{position:'absolute',right:18,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      <div style={{marginTop:24,maxWidth:560}}>
        <div style={{height:3,width:38,background:cur.c,borderRadius:2,marginBottom:16}}/>
        <div style={{fontSize:18,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",marginBottom:10}}>{cur.label}</div>
        <p style={{fontSize:15,color:'var(--text)',lineHeight:1.6,marginBottom:12}}>{d.what}</p>
        <p style={{fontSize:14,color:'var(--muted)',lineHeight:1.65}}>{d.models}</p>
      </div>
    </div>
  );
}

export{ASSETS,ASSET_DESC,Step1};
