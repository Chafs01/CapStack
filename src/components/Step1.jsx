import{Card}from'./ui.jsx';
// ─── STEP 1 ASSET TYPE ────────────────────────────────────────────────────
// Categorical identity colors for the five asset types — deliberately literal
// hexes, not semantic tokens, since they encode "which asset" not "good/bad".
const ASSETS=[
  {id:'multifamily',abbr:'MF',label:'Multifamily',sub:'Apartments, condos, townhomes',c:'#3a5bf0'},
  {id:'commercial',abbr:'CRE',label:'Commercial',sub:'Office, retail, industrial NNN',c:'#5a6478'},
  {id:'mixed-use',abbr:'MXU',label:'Mixed-Use',sub:'Residential + commercial floors',c:'#0e9f6e'},
  {id:'development',abbr:'DEV',label:'Development',sub:'Ground-up construction / value-add',c:'#c27803'},
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
      <div style={{marginBottom:20}}>
        <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>What are you underwriting?</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-5)',lineHeight:1.55}}>Pick the asset type and the model adapts its inputs and outputs to match.</p>
      </div>

      <div className="eyebrow" style={{marginBottom:9}}>Asset type</div>
      <div className="seg-wrap" style={{marginBottom:18}}>
        {ASSETS.map(a=>{
          const on=a.id===cur.id;
          return(
            <button key={a.id} className={'seg'+(on?' on':'')} onClick={()=>onChange(a.id)} type="button">
              <span className="seg-abbr" style={on?undefined:{background:a.c+'1a',color:a.c}}>{a.abbr}</span>
              <span className="seg-label">{a.label}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:14}}>
          <span style={{width:10,height:10,borderRadius:3,background:cur.c,flexShrink:0}}/>
          <div style={{fontSize:'var(--fs-7)',fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{cur.label}</div>
          <span className="eyebrow" style={{marginLeft:'auto'}}>{cur.sub}</span>
        </div>
        <p style={{fontSize:'var(--fs-5)',color:'var(--text)',lineHeight:1.65,marginBottom:10,maxWidth:640}}>{d.what}</p>
        <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.7,maxWidth:640}}>{d.models}</p>
      </Card>
    </div>
  );
}

export{ASSETS,ASSET_DESC,Step1};
