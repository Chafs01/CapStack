import{useState,useRef}from'react';
import{f,pn}from'../engine/format.js';
import{parseFile,extractFields,extractRentRoll}from'../engine/parse.js';
import{Fld}from'./ui.jsx';
import{UnitMixEditor,RetailEditor,CreditEditor}from'./editors.jsx';
// ─── STEP 2 PROPERTY + UPLOAD ─────────────────────────────────────────────
function Step2({inp,onChange,assetType}){
  const [dov,setDov]=useState(false);
  const [parsed,setParsed]=useState(null);
  const ref=useRef();
  const [rollInfo,setRollInfo]=useState(null);
  const handleFile=f2=>{
    if(!f2)return;
    parseFile(f2,res=>{
      setParsed(res);
      const ex=extractFields(res.data);
      const roll=extractRentRoll(res.data);
      if(roll){ex.unitMix=roll.unitMix;ex.numUnits=roll.numUnits;ex.avgRent=roll.avgRent;setRollInfo(roll);}
      else setRollInfo(null);
      if(Object.keys(ex).length)onChange(ex);
    });
  };
  const t=assetType.toLowerCase();
  return(
    <div className="fu">
      <h2 style={{fontSize:22,fontWeight:800,marginBottom:6}}>Property Details</h2>
      <p style={{color:'#737373',marginBottom:24,fontSize:14}}>Enter manually or upload a file to auto-populate</p>
      <div className={`upload-z${dov?' dov':''}`} style={{marginBottom:24}}
        onDragOver={e=>{e.preventDefault();setDov(true)}} onDragLeave={()=>setDov(false)}
        onDrop={e=>{e.preventDefault();setDov(false);handleFile(e.dataTransfer.files[0])}}
        onClick={()=>ref.current?.click()}>
        <input ref={ref} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
        <div style={{marginBottom:8}}>{parsed?
          <span style={{color:'#1a7f37',fontSize:24,fontWeight:800}}>&#10003;</span>:
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
        </div>
        <div style={{fontSize:14,fontWeight:700,color:'#3f3f3f',marginBottom:3}}>
          {parsed?`${parsed.data.length} rows imported, fields auto-populated`:'Drop a file or click to upload'}
        </div>
        <div style={{fontSize:12,color:'#737373'}}>
          {parsed?`${parsed.headers.length} columns detected`:'Accepts .csv, .xlsx, .xls (rent rolls, OM financials, lease abstracts)'}
        </div>
        {rollInfo&&<div style={{marginTop:10,padding:'8px 14px',background:'#e6f4ea',border:'1px solid #b8e0c4',borderRadius:4,fontSize:12.5,color:'#1a7f37',display:'inline-block'}}>
          Rent roll detected: {rollInfo.numUnits} units across {rollInfo.unitMix.length} floor plan{rollInfo.unitMix.length!==1?'s':''} loaded into the unit mix below.
        </div>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="g2">
        <Fld label="Property Name" value={inp.propertyName||''} onChange={v=>onChange({propertyName:v})}/>
        <Fld label="Address / Market" value={inp.address||''} onChange={v=>onChange({address:v})}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="g2">
        <Fld label="Purchase Price" prefix="$" value={inp.purchasePrice} onChange={v=>onChange({purchasePrice:pn(v)})}/>
        <Fld label="Acquisition Costs / Fees" suffix="%" hint={`closing, legal, title, acquisition fee = ${f.$((inp.purchasePrice||0)*(inp.acquisitionCostsPct||0)/100)}`} value={inp.acquisitionCostsPct} onChange={v=>onChange({acquisitionCostsPct:pn(v)})}/>
      </div>
      {(t==='multifamily')&&<UnitMixEditor rows={inp.unitMix} onChange={mix=>{const u=mix.reduce((a,r)=>a+(+r.count||0),0);const an=mix.reduce((a,r)=>a+(+r.count||0)*(+r.rent||0)*12,0);onChange({unitMix:mix,numUnits:u,avgRent:u?Math.round(an/u/12):0});}}/>}
      {(t==='commercial')&&<>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:6}} className="g2">
          <Fld label="Total Rentable SF" value={inp.totalSF} onChange={v=>onChange({totalSF:pn(v)})}/>
          <Fld label="CAM / NNN Income" prefix="$" value={inp.camIncome||0} onChange={v=>onChange({camIncome:pn(v)})}/>
        </div>
        <RetailEditor rows={inp.retailIncome} onChange={r=>onChange({retailIncome:r})}/>
      </>}
      {(t==='mixed-use')&&<>
        <UnitMixEditor rows={inp.unitMix} onChange={mix=>{const u=mix.reduce((a,r)=>a+(+r.count||0),0);const an=mix.reduce((a,r)=>a+(+r.count||0)*(+r.rent||0)*12,0);onChange({unitMix:mix,numUnits:u,avgRent:u?Math.round(an/u/12):0});}}/>
        <RetailEditor rows={inp.retailIncome} onChange={r=>{const sf=r.reduce((a,x)=>a+(+x.sf||0),0);onChange({retailIncome:r,commercialSF:sf});}}/>
      </>}
      {(t==='development')&&<>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="g2">
          <Fld label="Land / Site Cost" prefix="$" value={inp.landCost||inp.purchasePrice} onChange={v=>onChange({landCost:pn(v),purchasePrice:pn(v)})}/>
          <Fld label="Gross Buildable SF" value={inp.grossBuildableSF} onChange={v=>onChange({grossBuildableSF:pn(v)})}/>
          <Fld label="Hard Cost / SF" prefix="$" value={inp.hardCostPerSF} onChange={v=>onChange({hardCostPerSF:pn(v)})}/>
          <Fld label="Soft Costs" suffix="%" hint="% of hard costs" value={inp.softCostsPct} onChange={v=>onChange({softCostsPct:pn(v)})}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:6}} className="g3">
          <Fld label="Construction Period" suffix="mos" value={inp.constructionPeriodMonths} onChange={v=>onChange({constructionPeriodMonths:pn(v)})}/>
          <Fld label="Lease-Up Period" suffix="mos" value={inp.leaseUpMonths} onChange={v=>onChange({leaseUpMonths:pn(v)})}/>
          <div>
            <label style={{fontSize:13,fontWeight:600,color:'#3f3f3f',display:'block',marginBottom:6}}>Draw Pattern</label>
            <select className="input-f" value={inp.drawPattern||'straight'} onChange={e=>onChange({drawPattern:e.target.value})} style={{height:42}}>
              <option value="straight">Straight-line</option>
              <option value="scurve">S-curve</option>
            </select>
          </div>
        </div>
        <div style={{fontSize:12,color:'#8c8c8c',marginBottom:8,marginTop:4}}>Stabilized unit mix</div>
        <UnitMixEditor rows={inp.unitMix} onChange={mix=>{const u=mix.reduce((a,r)=>a+(+r.count||0),0);const an=mix.reduce((a,r)=>a+(+r.count||0)*(+r.rent||0)*12,0);onChange({unitMix:mix,numUnits:u,avgRent:u?Math.round(an/u/12):0});}}/>
        <div style={{height:6}}/>
        <CreditEditor rows={inp.devCredits} onChange={c=>onChange({devCredits:c})}/>
      </>}

      {(t==='affordable')&&<>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="g2">
          <Fld label="Land / Site Cost" prefix="$" value={inp.landCost} onChange={v=>onChange({landCost:pn(v),purchasePrice:pn(v)})}/>
          <Fld label="Gross Buildable SF" value={inp.grossBuildableSF} onChange={v=>onChange({grossBuildableSF:pn(v)})}/>
          <Fld label="Hard Cost / SF" prefix="$" value={inp.hardCostPerSF} onChange={v=>onChange({hardCostPerSF:pn(v)})}/>
          <Fld label="Soft Costs" suffix="%" hint="% of hard costs" value={inp.softCostsPct} onChange={v=>onChange({softCostsPct:pn(v)})}/>
          <Fld label="Developer Fee" prefix="$" value={inp.developerFee} onChange={v=>onChange({developerFee:pn(v)})}/>
          <Fld label="Soft Sources / Subsidy" prefix="$" hint="soft loans, grants" value={inp.softSources} onChange={v=>onChange({softSources:pn(v)})}/>
        </div>
        <div style={{fontSize:12,color:'#8c8c8c',marginBottom:8,marginTop:8,fontWeight:700,letterSpacing:'.3px'}}>TAX CREDIT ASSUMPTIONS</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}} className="g3">
          <div>
            <label style={{fontSize:13,fontWeight:600,color:'#3f3f3f',display:'block',marginBottom:6}}>Credit Type</label>
            <select className="input-f" value={inp.creditType||'9'} onChange={e=>{const v=e.target.value;onChange({creditType:v,creditRate:v==='4'?4:9});}} style={{height:40,marginBottom:14}}>
              <option value="9">9% (new construction)</option>
              <option value="4">4% (acq/rehab, bonds)</option>
            </select>
          </div>
          <Fld label="Credit Rate" suffix="%" value={inp.creditRate} onChange={v=>onChange({creditRate:pn(v)})}/>
          <Fld label="Credit Price" prefix="$" hint="per $1 of credit" value={inp.creditPrice} onChange={v=>onChange({creditPrice:parseFloat(v)||0})}/>
          <Fld label="Eligible Basis" suffix="%" hint="% of hard+soft+fee" value={inp.eligibleBasisPct} onChange={v=>onChange({eligibleBasisPct:pn(v)})}/>
          <Fld label="Affordable Units" suffix="%" hint="applicable fraction" value={inp.affordablePct} onChange={v=>onChange({affordablePct:pn(v)})}/>
          <Fld label="Min DSCR" hint="sizes the loan" value={inp.minDSCR} onChange={v=>onChange({minDSCR:parseFloat(v)||0})}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'4px 0 16px',padding:'10px 14px',background:'#f4f0f8',border:'1px solid #e0d8ec',borderRadius:4}}>
          <input type="checkbox" checked={!!inp.qctDda} onChange={e=>onChange({qctDda:e.target.checked})} style={{width:16,height:16,accentColor:'#7a5195'}}/>
          <span style={{fontSize:13,color:'#3f3f3f'}}>Located in a QCT or DDA (130% basis boost)</span>
        </div>
        <div style={{fontSize:12,color:'#8c8c8c',marginBottom:8,marginTop:4}}>Restricted unit mix (rents at AMI limits)</div>
        <UnitMixEditor rows={inp.unitMix} onChange={mix=>{const u=mix.reduce((a,r)=>a+(+r.count||0),0);const an=mix.reduce((a,r)=>a+(+r.count||0)*(+r.rent||0)*12,0);onChange({unitMix:mix,numUnits:u,avgRent:u?Math.round(an/u/12):0});}}/>
        <p style={{fontSize:12,color:'#7a5195',marginTop:4,marginBottom:10}}>The permanent loan is sized automatically to your minimum DSCR. LIHTC equity, soft sources, and deferred developer fee fill the remaining gap.</p>
        <CreditEditor rows={inp.devCredits} onChange={c=>onChange({devCredits:c})}/>
      </>}
    </div>
  );
}

export{Step2};
