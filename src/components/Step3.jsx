import{f,pn}from'../engine/format.js';
import{getGPI,getDevCost}from'../engine/income.js';
import{Fld,Slider,SecHdr}from'./ui.jsx';
// ─── STEP 3 INCOME & EXPENSES ─────────────────────────────────────────────
function Step3({inp,onChange}){
  const t=inp.assetType.toLowerCase();
  const gpi=getGPI(inp);
  const vac=gpi*(inp.vacancyRate||0)/100;
  const egi=gpi-vac+(inp.otherIncome||0);
  const mgmt=egi*(inp.managementFeePct||0)/100;
  const opex=(inp.propertyTax||0)+(inp.insurance||0)+mgmt+(inp.maintenance||0)+(inp.utilities||0)+(inp.reserves||0)+(inp.administrative||0);
  const noi=egi-opex;
  const er=egi>0?opex/egi:0;
  const capBasis=t==='development'?getDevCost(inp):(inp.purchasePrice||0);
  const capR=capBasis>0?noi/capBasis:0;
  return(
    <div className="fu">
      <h2 style={{fontSize:22,fontWeight:800,marginBottom:6}}>Income & Expenses</h2>
      <p style={{color:'#737373',marginBottom:20,fontSize:14}}>Year 1 operating assumptions with live preview as you type</p>
      <div className="glass g4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',marginBottom:24,overflow:'hidden'}}>
        {[
          {l:'Gross Income',v:f.$(gpi),c:'#3a5bf0'},
          {l:'Eff. Gross Income',v:f.$(egi),c:'#56687a'},
          {l:'NOI',v:f.$(noi),c:noi>0?'#1a7f37':'#b42318'},
          {l:'Expense Ratio',v:`${(er*100).toFixed(1)}%`,c:er>0.6?'#b42318':er>0.45?'#9a6700':'#1a7f37'},
        ].map(i=>(
          <div key={i.l} style={{padding:'12px 14px',textAlign:'center',borderRight:'1px solid #ececec'}}>
            <div style={{fontSize:17,fontWeight:800,color:i.c}}>{i.v}</div>
            <div style={{fontSize:11,color:'#737373',marginTop:3}}>{i.l}</div>
          </div>
        ))}
      </div>
      <SecHdr>Revenue</SecHdr>
      <Slider label="Physical Vacancy + Credit Loss" min={0} max={25} step={0.5} value={inp.vacancyRate||0} onChange={v=>onChange({vacancyRate:v})} fmt2={v=>`${v}%`}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="g2">
        {t==='multifamily'&&<><Fld label="Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/></>}
        {t==='commercial'&&<><Fld label="Total SF" value={inp.totalSF} onChange={v=>onChange({totalSF:pn(v)})}/><Fld label="Base Rent / SF" prefix="$" value={inp.avgRentPerSF} onChange={v=>onChange({avgRentPerSF:pn(v)})}/><Fld label="CAM / NNN Income" prefix="$" value={inp.camIncome||0} onChange={v=>onChange({camIncome:pn(v)})}/></>}
        {t==='mixed-use'&&<><Fld label="Residential Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/><Fld label="Commercial SF" value={inp.commercialSF||0} onChange={v=>onChange({commercialSF:pn(v)})}/><Fld label="Commercial Rent / SF" prefix="$" value={inp.commercialRentPerSF||0} onChange={v=>onChange({commercialRentPerSF:pn(v)})}/></>}
        {t==='development'&&<><Fld label="Stabilized Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/></>}
        <Fld label="Other Income (Annual)" prefix="$" hint="laundry, parking, fees" value={inp.otherIncome||0} onChange={v=>onChange({otherIncome:pn(v)})}/>
      </div>
      <SecHdr>Operating Expenses</SecHdr>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="g2">
        <Fld label="Property Taxes" prefix="$" hint="annual" value={inp.propertyTax||0} onChange={v=>onChange({propertyTax:pn(v)})}/>
        <Fld label="Insurance" prefix="$" hint="annual" value={inp.insurance||0} onChange={v=>onChange({insurance:pn(v)})}/>
        <Fld label="Property Management Fee" suffix="%" hint="% of EGI" value={inp.managementFeePct||0} onChange={v=>onChange({managementFeePct:pn(v)})}/>
        <Fld label="Repairs & Maintenance" prefix="$" hint="annual" value={inp.maintenance||0} onChange={v=>onChange({maintenance:pn(v)})}/>
        <Fld label="Utilities" prefix="$" hint="annual" value={inp.utilities||0} onChange={v=>onChange({utilities:pn(v)})}/>
        <Fld label="Capital Reserves" prefix="$" hint="annual" value={inp.reserves||0} onChange={v=>onChange({reserves:pn(v)})}/>
        <Fld label="Administrative" prefix="$" hint="annual" value={inp.administrative||0} onChange={v=>onChange({administrative:pn(v)})}/>
      </div>
      <div style={{background:'#eef1fe',borderRadius:10,padding:'12px 16px',marginTop:8,fontSize:13}}>
        <span style={{color:'#666666'}}>Implied Cap Rate: </span>
        <span style={{fontWeight:700,color:capR>0.07?'#1a7f37':capR>0.05?'#9a6700':'#b42318'}}>{f.pct(capR,2)}</span>
        <span style={{color:'#8c8c8c',marginLeft:16}}>NOI: </span>
        <span style={{fontWeight:700,color:'#191919'}}>{f.$f(noi)}</span>
      </div>
    </div>
  );
}

export{Step3};
