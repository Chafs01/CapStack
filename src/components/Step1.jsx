import{Card}from'./ui.jsx';
// ─── STEP 1 ASSET TYPE ────────────────────────────────────────────────────
// Categorical identity colors for the five asset types — deliberately literal
// hexes, not semantic tokens, since they encode "which asset" not "good/bad".
const ASSETS=[
  {id:'residential',abbr:'2-4',label:'Residential 2\u20134 Units',sub:'Duplex, triplex, fourplex \u2014 residential financing',c:'#181716'},
  {id:'multifamily',abbr:'MF',label:'Multifamily 5+ Units',sub:'Apartments \u2014 commercial financing',c:'#181716'},
  {id:'commercial',abbr:'CRE',label:'Commercial',sub:'Office, retail, industrial NNN',c:'#3a3733'},
  {id:'mixed-use',abbr:'MXU',label:'Mixed-Use',sub:'Residential + commercial floors',c:'#5c554c'},
  {id:'development',abbr:'DEV',label:'Development',sub:'Ground-up construction / value-add',c:'#7a7268'},
  {id:'affordable',abbr:'LIHTC',label:'Affordable / LIHTC',sub:'Tax-credit & syndication underwriting',c:'#958c83'},
];

const ASSET_DESC={
  residential:{
    what:'Two-to-four unit residential property \u2014 a duplex, triplex or fourplex. Legally residential, so it finances like a house rather than a commercial building.',
    models:'Underwritten on the same rent-roll and cash-flow engine as larger multifamily, with residential loan defaults (higher LTV, 30-year fully amortising, no balloon). Note that exit value is still calculated from your cap rate; a 2\u20134 unit property is normally appraised off sales comparables, so treat the exit figure as a yield check rather than an appraisal.'
  },
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
