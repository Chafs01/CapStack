import{f,pn}from'../engine/format.js';
import{resolveLine,resolveCostLine}from'../engine/income.js';
import{NumIn}from'./ui.jsx';
// ─── RENT ROLL EDITORS ──────────────────────────────────────────────────
const UNIT_TYPES=['Studio','1BR','2BR','3BR','4BR','Penthouse','Other'];
const CREDIT_TYPES=[
  {id:'Historic',rate:20,price:0.90,note:'20% of qualified rehab expenditures (federal HTC), claimed over 5 years'},
  {id:'Brownfield',rate:10,price:1.00,note:'state-specific; set your rate and basis (remediation / eligible costs)'},
  {id:'LIHTC (est.)',rate:9,price:0.90,note:'rough estimate only; use the Affordable asset type for the full LIHTC calculation'},
  {id:'New Markets',rate:39,price:0.80,note:'NMTC, 39% of qualified investment over 7 years'},
  {id:'Solar / ITC',rate:30,price:0.90,note:'energy investment tax credit on eligible solar/energy basis'},
  {id:'Other',rate:0,price:1.00,note:'custom credit'},
];
function CreditEditor({rows,onChange}){
  rows=rows||[];
  const set=(i,p)=>onChange(rows.map((r,j)=>j===i?{...r,...p}:r));
  const add=()=>{const t=CREDIT_TYPES[0];onChange([...rows,{type:t.id,basis:0,rate:t.rate,price:t.price}]);};
  const del=i=>onChange(rows.filter((_,j)=>j!==i));
  const pickType=(i,id)=>{const t=CREDIT_TYPES.find(c=>c.id===id)||CREDIT_TYPES[0];set(i,{type:id,rate:t.rate,price:t.price});};
  const eq=r=>(+r.basis||0)*((+r.rate||0)/100)*(r.price!=null?+r.price:0.9);
  const tot=rows.reduce((s,r)=>s+eq(r),0);
  const C='1.3fr 1.2fr .7fr .7fr 1fr 30px';
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <label style={{fontSize:'var(--fs-4)',fontWeight:600,color:'var(--text)'}}>Tax Credits (historic, brownfield, affordable)</label>
        <span style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>{rows.length} credit{rows.length!==1?'s':''} &middot; {f.$(tot)} equity</span>
      </div>
      {rows.length>0&&<div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:'var(--fs-2)',fontWeight:700,color:'var(--muted2)'}}>
        <div>Type</div><div>Eligible Basis</div><div>Rate %</div><div>Price</div><div>Equity</div><div></div>
      </div>}
      {rows.map((r,i)=>{
        const ct=CREDIT_TYPES.find(c=>c.id===r.type);
        return(
        <div key={i} style={{marginBottom:8}}>
          <div style={{display:'grid',gridTemplateColumns:C,gap:8,alignItems:'center'}}>
            <select className="input-f" value={r.type||'Historic'} onChange={e=>pickType(i,e.target.value)} style={{height:38}}>
              {CREDIT_TYPES.map(c=><option key={c.id} value={c.id}>{c.id}</option>)}
            </select>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--muted2)',fontSize:'var(--fs-4)'}}>$</span>
              <NumIn value={r.basis} onChange={v=>set(i,{basis:pn(v)})} style={{paddingLeft:24}}/>
            </div>
            <input className="input-f" value={r.rate!=null?r.rate:''} onChange={e=>set(i,{rate:parseFloat(e.target.value)||0})} placeholder="0"/>
            <input className="input-f" value={r.price!=null?r.price:''} onChange={e=>set(i,{price:parseFloat(e.target.value)||0})} placeholder="0.90"/>
            <div className="mono" style={{fontSize:'var(--fs-4)',fontWeight:700,color:'var(--purple)',paddingLeft:2}}>{f.$((+r.basis||0)*((+r.rate||0)/100)*(r.price!=null?+r.price:0.9))}</div>
            <button onClick={()=>del(i)} title="Remove" style={{background:'none',border:'1px solid var(--border)',borderRadius:3,color:'var(--neg)',cursor:'pointer',width:30,height:30,fontSize:'var(--fs-5)',lineHeight:1}}>&times;</button>
          </div>
          {ct&&<div style={{fontSize:'var(--fs-2)',color:'var(--purple)',marginTop:3,marginLeft:2}}>{ct.note}</div>}
        </div>
        );
      })}
      <button onClick={add} className="btn-s" style={{padding:'7px 14px',fontSize:'var(--fs-4)',marginTop:2}}>+ Add credit</button>
    </div>
  );
}
function delBtn(onClick){return(
  <button onClick={onClick} title="Remove" style={{background:'none',border:'1px solid var(--border)',borderRadius:3,color:'var(--neg)',cursor:'pointer',width:30,height:30,fontSize:'var(--fs-5)',lineHeight:1,flexShrink:0}}>&times;</button>
);}
function UnitMixEditor({rows,onChange}){
  rows=rows||[];
  const set=(i,p)=>onChange(rows.map((r,j)=>j===i?{...r,...p}:r));
  const add=()=>onChange([...rows,{type:'1BR',count:0,rent:0}]);
  const del=i=>onChange(rows.filter((_,j)=>j!==i));
  const tU=rows.reduce((s,r)=>s+(+r.count||0),0);
  const tA=rows.reduce((s,r)=>s+(+r.count||0)*(+r.rent||0)*12,0);
  const C='1.4fr 1fr 1.2fr 30px';
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <label style={{fontSize:'var(--fs-4)',fontWeight:600,color:'var(--text)'}}>Unit Mix / Floor Plans</label>
        <span style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>{tU} units &middot; {f.$(tA)}/yr</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:'var(--fs-2)',fontWeight:700,color:'var(--muted2)'}}>
        <div>Type</div><div># Units</div><div>Rent / Mo</div><div></div>
      </div>
      {rows.map((r,i)=>(
        <div key={i}>
          <div style={{display:'grid',gridTemplateColumns:C,gap:8,marginBottom:r.type==='Other'?4:8,alignItems:'center'}}>
            <select className="input-f" value={r.type||'1BR'} onChange={e=>set(i,{type:e.target.value})} style={{height:38}}>
              {UNIT_TYPES.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
            <NumIn value={r.count} onChange={v=>set(i,{count:pn(v)})}/>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--muted2)',fontSize:'var(--fs-4)'}}>$</span>
              <NumIn value={r.rent} onChange={v=>set(i,{rent:pn(v)})} style={{paddingLeft:24}}/>
            </div>
            <button onClick={()=>del(i)} title="Remove" style={{background:'none',border:'1px solid var(--border)',borderRadius:3,color:'var(--neg)',cursor:'pointer',width:30,height:30,fontSize:'var(--fs-5)',lineHeight:1}}>&times;</button>
          </div>
          {r.type==='Other'&&<input className="input-f" value={r.label||''} onChange={e=>set(i,{label:e.target.value})} placeholder="Name this floor plan (e.g. Live/Work Loft, Garden 2BR)" style={{marginBottom:8,fontSize:'var(--fs-4)'}}/>}
        </div>
      ))}
      <button className="btn-s" style={{padding:'7px 14px',fontSize:'var(--fs-4)',marginTop:2}} onClick={add}>+ Add unit type</button>
    </div>
  );
}
// Operating expense categories a real underwriter actually breaks out. Six
// fixed boxes is fine for a duplex and useless for a deal where the whole job
// is arguing about the line items -- so the list is open, and "Custom" covers
// whatever this asset has that the list does not.
const EXPENSE_BASES=[['amount','Annual $'],['perUnitYr','$ / unit / yr'],['pctEGI','% of EGI']];
const INCOME_BASES=[['amount','Annual $'],['perUnitMo','$ / unit / mo'],['perUnitYr','$ / unit / yr']];
const BASIS_SUFFIX={amount:'$',perUnitYr:'$',perUnitMo:'$',pctEGI:'%',perSF:'$',perUnit:'$',pctHard:'%'};

const OPEX_CATEGORIES=['Property Taxes','Insurance','Repairs & Maintenance','Utilities',
  'Water & Sewer','Trash Removal','Landscaping / Snow','Turnover & Make-Ready','Contract Services',
  'Payroll / On-Site','Marketing & Leasing','Legal & Professional','HOA / Condo Dues',
  'Pest Control','Security','Capital Reserves','Administrative','Custom'];

function OpExEditor({rows,onChange,units}){
  rows=rows||[];
  const set=(i,p)=>onChange(rows.map((r,j)=>j===i?{...r,...p}:r));
  const add=()=>onChange([...rows,{cat:'Property Taxes',amount:0}]);
  const del=i=>onChange(rows.filter((_,j)=>j!==i));
  const total=rows.reduce((s,r)=>s+resolveLine(r,units,0),0);
  const C='1.4fr 0.95fr 0.85fr 30px';
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:12,flexWrap:'wrap'}}>
        <label style={{fontSize:'var(--fs-4)',fontWeight:600,color:'var(--text)'}}>Operating Expense Line Items</label>
        <span style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>{rows.length} line{rows.length!==1?'s':''} &middot; {f.$(total)}/yr</span>
      </div>
      {rows.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:'var(--fs-2)',fontWeight:700,color:'var(--muted2)'}}>
          <div>Category</div><div>Quoted as</div><div>Amount</div><div></div>
        </div>
      )}
      {rows.map((r,i)=>(
        <div key={i}>
          <div style={{display:'grid',gridTemplateColumns:C,gap:8,marginBottom:r.cat==='Custom'?4:8,alignItems:'center'}}>
            <select className="input-f" value={r.cat||'Custom'} onChange={e=>set(i,{cat:e.target.value})} style={{height:38}}>
              {OPEX_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {/* changing basis clears the figure: 300 a door is not 300 a year */}
            <select className="input-f" value={r.basis||'amount'} onChange={e=>set(i,{basis:e.target.value,amount:0})} style={{height:38}}>
              {EXPENSE_BASES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--muted2)',fontSize:'var(--fs-4)'}}>{BASIS_SUFFIX[r.basis||'amount']}</span>
              <NumIn value={r.amount} onChange={v=>set(i,{amount:pn(v)})} style={{paddingLeft:24}}/>
            </div>
            <button onClick={()=>del(i)} aria-label="Remove" title="Remove" style={{background:'none',border:'1px solid var(--border)',borderRadius:3,color:'var(--neg)',cursor:'pointer',width:30,height:30,fontSize:'var(--fs-5)',lineHeight:1}}>&times;</button>
          </div>
          {r.cat==='Custom'&&<input className="input-f" value={r.label||''} onChange={e=>set(i,{label:e.target.value})} placeholder="Name this expense (e.g. Elevator Service, Dock Maintenance)" style={{marginBottom:8,fontSize:'var(--fs-4)'}}/>}
        </div>
      ))}
      <button className="btn-s" style={{padding:'7px 14px',fontSize:'var(--fs-4)',marginTop:2}} onClick={add}>+ Add expense line</button>
    </div>
  );
}
// Ancillary income lines. Same reasoning as the expense list: one "Other
// Income" box cannot hold laundry, parking, storage, pet rent and a rooftop
// antenna lease, and those are the lines that get argued over.
const OTHER_INCOME_CATEGORIES=['Laundry','Parking','Storage','Pet Rent & Fees',
  'Utility Reimbursement (RUBS)','Application Fees','Late Fees','Month-to-Month Premium',
  'Vending & Amenities','Cleaning & Move-In Fees','Short-Term / Furnished Premium',
  'Rooftop / Antenna Lease','Signage','Cell Tower Lease','Custom'];

function OtherIncomeEditor({rows,onChange,units}){
  rows=rows||[];
  const set=(i,p)=>onChange(rows.map((r,j)=>j===i?{...r,...p}:r));
  const add=()=>onChange([...rows,{cat:'Laundry',amount:0}]);
  const del=i=>onChange(rows.filter((_,j)=>j!==i));
  const total=rows.reduce((s,r)=>s+resolveLine(r,units,0),0);
  const C='1.4fr 0.95fr 0.85fr 30px';
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:12,flexWrap:'wrap'}}>
        <label style={{fontSize:'var(--fs-4)',fontWeight:600,color:'var(--text)'}}>Other Income Line Items</label>
        <span style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>{rows.length} line{rows.length!==1?'s':''} &middot; {f.$(total)}/yr</span>
      </div>
      {rows.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:'var(--fs-2)',fontWeight:700,color:'var(--muted2)'}}>
          <div>Source</div><div>Quoted as</div><div>Amount</div><div></div>
        </div>
      )}
      {rows.map((r,i)=>(
        <div key={i}>
          <div style={{display:'grid',gridTemplateColumns:C,gap:8,marginBottom:r.cat==='Custom'?4:8,alignItems:'center'}}>
            <select className="input-f" value={r.cat||'Custom'} onChange={e=>set(i,{cat:e.target.value})} style={{height:38}}>
              {OTHER_INCOME_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input-f" value={r.basis||'amount'} onChange={e=>set(i,{basis:e.target.value,amount:0})} style={{height:38}}>
              {INCOME_BASES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--muted2)',fontSize:'var(--fs-4)'}}>$</span>
              <NumIn value={r.amount} onChange={v=>set(i,{amount:pn(v)})} style={{paddingLeft:24}}/>
            </div>
            <button onClick={()=>del(i)} aria-label="Remove" title="Remove" style={{background:'none',border:'1px solid var(--border)',borderRadius:3,color:'var(--neg)',cursor:'pointer',width:30,height:30,fontSize:'var(--fs-5)',lineHeight:1}}>&times;</button>
          </div>
          {r.cat==='Custom'&&<input className="input-f" value={r.label||''} onChange={e=>set(i,{label:e.target.value})} placeholder="Name this income (e.g. Billboard Lease, EV Charging)" style={{marginBottom:8,fontSize:'var(--fs-4)'}}/>}
        </div>
      ))}
      <button className="btn-s" style={{padding:'7px 14px',fontSize:'var(--fs-4)',marginTop:2}} onClick={add}>+ Add income line</button>
    </div>
  );
}
// A development budget gets the same treatment operating expenses got. One
// blended $/SF is not how anyone builds one: the trades quote separately, and
// the lines are exactly what a lender and a GC argue about. Softs carry a
// percent-of-hard basis on top, because contingency and most fees are quoted
// that way.
const HARD_COST_CATEGORIES=['Demolition & Abatement','Sitework & Excavation','Utilities & Connections',
  'Foundations','Structure & Shell','Exterior & Envelope','Roofing','Windows & Doors',
  'Mechanical, Electrical & Plumbing','Fire Protection','Elevators & Conveyance','Interior Finishes',
  'Millwork & Casework','Appliances','FF&E','Parking & Paving','Landscaping & Hardscape',
  'Site Amenities','General Conditions','Contractor Fee & Overhead','Hard Cost Contingency','Custom'];
const SOFT_COST_CATEGORIES=['Architecture & Engineering','Permits & Plan Check','Impact & Utility Fees',
  'Environmental & Geotechnical','Survey','Legal','Accounting & Audit','Title & Recording',
  'Builder’s Risk Insurance','Property Taxes During Construction','Construction Loan Interest',
  'Financing & Lender Fees','Appraisal & Market Study','Project Management','Marketing & Lease-Up',
  'Operating Reserve','Soft Cost Contingency','Custom'];
const HARD_COST_BASES=[['amount','Lump sum $'],['perSF','$ / buildable SF'],['perUnit','$ / unit']];
const SOFT_COST_BASES=[...HARD_COST_BASES,['pctHard','% of hard costs']];
// A renovation scope on an existing building. Narrower than a ground-up budget
// — no land, no developer fee, no shell — and the lines are the ones a buyer
// actually walks the property counting: how many kitchens, which roofs, what
// the exterior needs. Per-unit is first among the bases because unit turns are
// quoted that way and are usually the biggest line.
const REHAB_CATEGORIES=['Unit Turns / Interiors','Kitchens & Baths','Flooring','Appliances',
  'Roof','HVAC','Plumbing','Electrical','Windows & Doors','Exterior & Siding','Paint',
  'Parking & Site Work','Landscaping','Common Areas & Amenities','Life Safety & Code',
  'Environmental & Abatement','Permits & Design','Contingency','Custom'];
const REHAB_BASES=[['amount','Lump sum $'],['perUnit','$ / unit'],['perSF','$ / SF']];

function DevCostEditor({rows,onChange,cats,bases,label,noun,placeholder,sf,units,hard}){
  rows=rows||[];
  const set=(i,p)=>onChange(rows.map((r,j)=>j===i?{...r,...p}:r));
  const add=()=>onChange([...rows,{cat:cats[0],amount:0}]);
  const del=i=>onChange(rows.filter((_,j)=>j!==i));
  const total=rows.reduce((s,r)=>s+resolveCostLine(r,sf,units,hard),0);
  const C='1.4fr 0.95fr 0.85fr 30px';
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:12,flexWrap:'wrap'}}>
        <label style={{fontSize:'var(--fs-4)',fontWeight:600,color:'var(--text)'}}>{label}</label>
        <span style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>{rows.length} line{rows.length!==1?'s':''} &middot; {f.$(total)}</span>
      </div>
      {rows.length>0&&(
        <div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:'var(--fs-2)',fontWeight:700,color:'var(--muted2)'}}>
          <div>Line Item</div><div>Quoted as</div><div>Amount</div><div></div>
        </div>
      )}
      {rows.map((r,i)=>(
        <div key={i}>
          <div style={{display:'grid',gridTemplateColumns:C,gap:8,marginBottom:r.cat==='Custom'?4:8,alignItems:'center'}}>
            <select className="input-f" value={r.cat||'Custom'} onChange={e=>set(i,{cat:e.target.value})} style={{height:38}}>
              {cats.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {/* changing basis clears the figure: $22 a foot is not $22 total */}
            <select className="input-f" value={r.basis||'amount'} onChange={e=>set(i,{basis:e.target.value,amount:0})} style={{height:38}}>
              {bases.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--muted2)',fontSize:'var(--fs-4)'}}>{BASIS_SUFFIX[r.basis||'amount']}</span>
              <NumIn value={r.amount} onChange={v=>set(i,{amount:pn(v)})} style={{paddingLeft:24}}/>
            </div>
            <button onClick={()=>del(i)} aria-label="Remove" title="Remove" style={{background:'none',border:'1px solid var(--border)',borderRadius:3,color:'var(--neg)',cursor:'pointer',width:30,height:30,fontSize:'var(--fs-5)',lineHeight:1}}>&times;</button>
          </div>
          {r.cat==='Custom'&&<input className="input-f" value={r.label||''} onChange={e=>set(i,{label:e.target.value})} placeholder={placeholder} style={{marginBottom:8,fontSize:'var(--fs-4)'}}/>}
          {/* what this line actually resolves to, so a per-foot quote is never a mystery */}
          {r.basis&&r.basis!=='amount'&&(+r.amount||0)!==0&&(
            <div style={{fontSize:'var(--fs-2)',color:'var(--muted2)',marginTop:-2,marginBottom:8,marginLeft:2}}>
              = {f.$(resolveCostLine(r,sf,units,hard))}
            </div>
          )}
        </div>
      ))}
      <button className="btn-s" style={{padding:'7px 14px',fontSize:'var(--fs-4)',marginTop:2}} onClick={add}>+ Add {noun}</button>
    </div>
  );
}
function RetailEditor({rows,onChange,label}){
  rows=rows||[];
  const set=(i,p)=>onChange(rows.map((r,j)=>j===i?{...r,...p}:r));
  const add=()=>onChange([...rows,{name:'Retail Space',sf:0,rentPerSF:0}]);
  const del=i=>onChange(rows.filter((_,j)=>j!==i));
  const tSF=rows.reduce((s,r)=>s+(+r.sf||0),0);
  const tA=rows.reduce((s,r)=>s+(+r.sf||0)*(+r.rentPerSF||0),0);
  const C='1.6fr 1fr 1fr 30px';
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <label style={{fontSize:'var(--fs-4)',fontWeight:600,color:'var(--text)'}}>{label||'Commercial / Retail Income'}</label>
        <span style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>{tSF.toLocaleString()} SF &middot; {f.$(tA)}/yr</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:'var(--fs-2)',fontWeight:700,color:'var(--muted2)'}}>
        <div>Tenant / Space</div><div>SF</div><div>Rent / SF</div><div></div>
      </div>
      {rows.map((r,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:C,gap:8,marginBottom:8,alignItems:'center'}}>
          <input className="input-f" value={r.name||''} onChange={e=>set(i,{name:e.target.value})} placeholder="Tenant name"/>
          <NumIn value={r.sf} onChange={v=>set(i,{sf:pn(v)})}/>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--muted2)',fontSize:'var(--fs-4)'}}>$</span>
            <NumIn value={r.rentPerSF} onChange={v=>set(i,{rentPerSF:pn(v)})} style={{paddingLeft:24}}/>
          </div>
          <button onClick={()=>del(i)} title="Remove" style={{background:'none',border:'1px solid var(--border)',borderRadius:3,color:'var(--neg)',cursor:'pointer',width:30,height:30,fontSize:'var(--fs-5)',lineHeight:1}}>&times;</button>
        </div>
      ))}
      <button className="btn-s" style={{padding:'7px 14px',fontSize:'var(--fs-4)',marginTop:2}} onClick={add}>+ Add retail space</button>
    </div>
  );
}

export{UNIT_TYPES,CREDIT_TYPES,OPEX_CATEGORIES,OTHER_INCOME_CATEGORIES,
  HARD_COST_CATEGORIES,SOFT_COST_CATEGORIES,HARD_COST_BASES,SOFT_COST_BASES,
  REHAB_CATEGORIES,REHAB_BASES,
  CreditEditor,UnitMixEditor,OpExEditor,OtherIncomeEditor,DevCostEditor,RetailEditor};
