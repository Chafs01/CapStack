import{f,pn}from'../engine/format.js';
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
        <label style={{fontSize:13,fontWeight:600,color:'#3f3f3f'}}>Tax Credits (historic, brownfield, affordable)</label>
        <span style={{fontSize:12,color:'#8c8c8c'}}>{rows.length} credit{rows.length!==1?'s':''} &middot; {f.$(tot)} equity</span>
      </div>
      {rows.length>0&&<div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:11,fontWeight:700,color:'#8c8c8c'}}>
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
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'#8c8c8c',fontSize:13}}>$</span>
              <input className="input-f" value={r.basis||''} onChange={e=>set(i,{basis:pn(e.target.value)})} placeholder="0" style={{paddingLeft:24}}/>
            </div>
            <input className="input-f" value={r.rate!=null?r.rate:''} onChange={e=>set(i,{rate:parseFloat(e.target.value)||0})} placeholder="0"/>
            <input className="input-f" value={r.price!=null?r.price:''} onChange={e=>set(i,{price:parseFloat(e.target.value)||0})} placeholder="0.90"/>
            <div className="mono" style={{fontSize:13,fontWeight:700,color:'#7a5195',paddingLeft:2}}>{f.$((+r.basis||0)*((+r.rate||0)/100)*(r.price!=null?+r.price:0.9))}</div>
            <button onClick={()=>del(i)} title="Remove" style={{background:'none',border:'1px solid #e2e6f0',borderRadius:3,color:'#b42318',cursor:'pointer',width:30,height:30,fontSize:15,lineHeight:1}}>&times;</button>
          </div>
          {ct&&<div style={{fontSize:11,color:'#9a8aae',marginTop:3,marginLeft:2}}>{ct.note}</div>}
        </div>
        );
      })}
      <button onClick={add} className="btn-s" style={{padding:'7px 14px',fontSize:13,marginTop:2}}>+ Add credit</button>
    </div>
  );
}
function delBtn(onClick){return(
  <button onClick={onClick} title="Remove" style={{background:'none',border:'1px solid #e2e6f0',borderRadius:3,color:'#b42318',cursor:'pointer',width:30,height:30,fontSize:15,lineHeight:1,flexShrink:0}}>&times;</button>
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
        <label style={{fontSize:13,fontWeight:600,color:'#3f3f3f'}}>Unit Mix / Floor Plans</label>
        <span style={{fontSize:12,color:'#8c8c8c'}}>{tU} units &middot; {f.$(tA)}/yr</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:11,fontWeight:700,color:'#8c8c8c'}}>
        <div>Type</div><div># Units</div><div>Rent / Mo</div><div></div>
      </div>
      {rows.map((r,i)=>(
        <div key={i}>
          <div style={{display:'grid',gridTemplateColumns:C,gap:8,marginBottom:r.type==='Other'?4:8,alignItems:'center'}}>
            <select className="input-f" value={r.type||'1BR'} onChange={e=>set(i,{type:e.target.value})} style={{height:38}}>
              {UNIT_TYPES.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
            <input className="input-f" value={r.count||''} onChange={e=>set(i,{count:pn(e.target.value)})} placeholder="0"/>
            <div style={{position:'relative'}}>
              <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'#8c8c8c',fontSize:13}}>$</span>
              <input className="input-f" value={r.rent||''} onChange={e=>set(i,{rent:pn(e.target.value)})} placeholder="0" style={{paddingLeft:24}}/>
            </div>
            <button onClick={()=>del(i)} title="Remove" style={{background:'none',border:'1px solid #e2e6f0',borderRadius:3,color:'#b42318',cursor:'pointer',width:30,height:30,fontSize:15,lineHeight:1}}>&times;</button>
          </div>
          {r.type==='Other'&&<input className="input-f" value={r.label||''} onChange={e=>set(i,{label:e.target.value})} placeholder="Name this floor plan (e.g. Live/Work Loft, Garden 2BR)" style={{marginBottom:8,fontSize:13}}/>}
        </div>
      ))}
      <button className="btn-s" style={{padding:'7px 14px',fontSize:13,marginTop:2}} onClick={add}>+ Add unit type</button>
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
        <label style={{fontSize:13,fontWeight:600,color:'#3f3f3f'}}>{label||'Commercial / Retail Income'}</label>
        <span style={{fontSize:12,color:'#8c8c8c'}}>{tSF.toLocaleString()} SF &middot; {f.$(tA)}/yr</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:C,gap:8,padding:'0 2px 6px',fontSize:11,fontWeight:700,color:'#8c8c8c'}}>
        <div>Tenant / Space</div><div>SF</div><div>Rent / SF</div><div></div>
      </div>
      {rows.map((r,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:C,gap:8,marginBottom:8,alignItems:'center'}}>
          <input className="input-f" value={r.name||''} onChange={e=>set(i,{name:e.target.value})} placeholder="Tenant name"/>
          <input className="input-f" value={r.sf||''} onChange={e=>set(i,{sf:pn(e.target.value)})} placeholder="0"/>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'#8c8c8c',fontSize:13}}>$</span>
            <input className="input-f" value={r.rentPerSF||''} onChange={e=>set(i,{rentPerSF:pn(e.target.value)})} placeholder="0" style={{paddingLeft:24}}/>
          </div>
          <button onClick={()=>del(i)} title="Remove" style={{background:'none',border:'1px solid #e2e6f0',borderRadius:3,color:'#b42318',cursor:'pointer',width:30,height:30,fontSize:15,lineHeight:1}}>&times;</button>
        </div>
      ))}
      <button className="btn-s" style={{padding:'7px 14px',fontSize:13,marginTop:2}} onClick={add}>+ Add retail space</button>
    </div>
  );
}

export{UNIT_TYPES,CREDIT_TYPES,CreditEditor,UnitMixEditor,RetailEditor};
