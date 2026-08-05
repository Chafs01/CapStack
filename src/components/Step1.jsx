import{Card}from'./ui.jsx';
// ─── STEP 1 ASSET TYPE ────────────────────────────────────────────────────
// Categorical identity colors for the five asset types — deliberately literal
// hexes, not semantic tokens, since they encode "which asset" not "good/bad".
const ASSETS=[
  {id:'residential',abbr:'1-4',label:'Residential 1\u20134 Units',sub:'Single-family, condo, duplex, triplex, fourplex',c:'#181716'},
  {id:'multifamily',abbr:'MF',label:'Multifamily 5+ Units',sub:'Apartments \u2014 commercial financing',c:'#181716'},
  {id:'commercial',abbr:'CRE',label:'Commercial — Simplified',sub:'Income-property screening for retail, office, or industrial',c:'#3a3733'},
  {id:'mixed-use',abbr:'MXU',label:'Mixed-Use',sub:'Residential + commercial floors',c:'#5c554c'},
  {id:'development',abbr:'DEV',label:'Ground-Up Development',sub:'Construction, lease-up, and project returns',c:'#7a7268'},
  {id:'affordable',abbr:'LIHTC',label:'Preliminary Affordable / LIHTC',sub:'Early feasibility and capital-stack sizing',c:'#958c83'},
];

const ASSET_DESC={
  residential:{
    what:'One-to-four unit residential \u2014 a single-family rental, condo, duplex, triplex or fourplex. Legally residential, so it finances like a house rather than a commercial building.',
    models:'Underwritten on the same rent-roll and cash-flow engine as larger multifamily, with residential loan defaults \u2014 higher LTV, 30-year fully amortising, no balloon. Exit defaults to the sales-comparable method (price per unit, appreciated over the hold), which is how 1\u20134 unit property is actually appraised, rather than a cap rate.'
  },
  multifamily:{
    what:'Apartment and rental-housing acquisitions, underwritten on stabilized operations.',
    models:'You build a unit-mix rent roll, set vacancy and operating expenses, and the model runs a levered return over the hold you choose, with exit at your cap rate.'
  },
  commercial:{
    what:'A simplified income-property screen for retail, office, or industrial real estate.',
    models:'You enter annual rent by tenant or space plus expense recoveries. It does not model lease expirations, contractual steps, downtime, tenant improvements, or leasing commissions, so use it for early screening rather than lease-level underwriting.'
  },
  'mixed-use':{
    what:'Combined residential and commercial assets under a single capital stack.',
    models:'You model an apartment unit mix and ground-floor retail as separate income streams, and the model blends them into one set of returns.'
  },
  development:{
    what:'Ground-up residential construction from land acquisition through construction, lease-up, stabilization, and exit.',
    models:'You enter land, hard and soft costs, and a developer fee, and the model bases returns on total development cost rather than a purchase price.'
  },
  affordable:{
    what:'Preliminary Low-Income Housing Tax Credit feasibility and capital-stack sizing.',
    models:'The model estimates qualified basis, credits, DSCR-sized permanent debt, syndication equity, soft sources, and deferred fee. It does not replace a state allocation, tax opinion, or investor pay-in model.'
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

      {/* full-width stacked rows; the selected one carries the oxblood rule */}
      <div style={{display:'grid',gap:10,marginBottom:26}}>
        {ASSETS.map(a=>{
          const on=a.id===cur.id;
          return(
            <button key={a.id} onClick={()=>onChange(a.id)} type="button"
              style={{textAlign:'left',padding:'16px 18px',cursor:'pointer',
                background:on?'var(--accent-tint)':'none',
                border:'1px solid '+(on?'var(--accent)':'var(--border)'),
                borderRadius:0,fontFamily:"'Inter',sans-serif",transition:'all .15s'}}>
              <div style={{fontSize:'var(--fs-5)',fontWeight:on?600:500,color:on?'var(--accent)':'var(--text)',marginBottom:3}}>{a.label}</div>
              <div style={{fontSize:'var(--fs-3)',color:'var(--muted)'}}>{a.sub}</div>
            </button>
          );
        })}
      </div>

      <div style={{borderTop:'1px solid var(--border)',paddingTop:18}}>
        <p style={{fontSize:'var(--fs-5)',color:'var(--text)',lineHeight:1.65,marginBottom:10}}>{d.what}</p>
        <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.7}}>{d.models}</p>
      </div>
    </div>
  );
}

// inp carries assetType for the engine and propClass for the finer UI label
function dealTypeLabel(inp){
  const id=inp&&inp.propClass?inp.propClass:String(inp&&inp.assetType||'').toLowerCase();
  const a=ASSETS.find(x=>x.id===id);
  return a?a.label:(inp&&inp.assetType)||'';
}

export{ASSETS,ASSET_DESC,Step1,dealTypeLabel};
