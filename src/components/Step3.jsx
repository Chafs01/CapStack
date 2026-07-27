import{f,pn}from'../engine/format.js';
import{getGPI,getDevCost}from'../engine/income.js';
import{Fld,Slider,Card,Metric}from'./ui.jsx';
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
  // Color marks an exception worth a second look — not every figure.
  const cells=[
    {label:'Gross Income',value:f.$(gpi)},
    {label:'Eff. Gross Income',value:f.$(egi)},
    {label:'NOI',value:f.$(noi),tone:noi>0?null:'neg'},
    {label:'Expense Ratio',value:`${(er*100).toFixed(1)}%`,tone:er>0.6?'neg':er>0.45?'warn':null},
  ];
  return(
    <div className="fu">
      <div style={{marginBottom:18}}>
        <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>Income &amp; Expenses</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-5)',lineHeight:1.55}}>Year 1 operating assumptions, with the running figures updating as you type.</p>
      </div>

      <div className="hair g4" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
        {cells.map(c=><Metric key={c.label} {...c}/>)}
      </div>

      <Card title="Revenue" sub="Gross potential income and vacancy">
        <Slider label="Physical Vacancy + Credit Loss" min={0} max={25} step={0.5} value={inp.vacancyRate||0} onChange={v=>onChange({vacancyRate:v})} fmt2={v=>`${v}%`}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}} className="g2">
          {t==='multifamily'&&<><Fld label="Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/></>}
          {t==='commercial'&&<><Fld label="Total SF" value={inp.totalSF} onChange={v=>onChange({totalSF:pn(v)})}/><Fld label="Base Rent / SF" prefix="$" value={inp.avgRentPerSF} onChange={v=>onChange({avgRentPerSF:pn(v)})}/><Fld label="CAM / NNN Income" prefix="$" value={inp.camIncome||0} onChange={v=>onChange({camIncome:pn(v)})}/></>}
          {t==='mixed-use'&&<><Fld label="Residential Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/><Fld label="Commercial SF" value={inp.commercialSF||0} onChange={v=>onChange({commercialSF:pn(v)})}/><Fld label="Commercial Rent / SF" prefix="$" value={inp.commercialRentPerSF||0} onChange={v=>onChange({commercialRentPerSF:pn(v)})}/></>}
          {t==='development'&&<><Fld label="Stabilized Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/></>}
          <Fld label="Other Income (Annual)" prefix="$" hint="laundry, parking, fees" value={inp.otherIncome||0} onChange={v=>onChange({otherIncome:pn(v)})}/>
        </div>
      </Card>

      <Card title="Operating Expenses" sub="Annual, at Year 1">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}} className="g2">
          <Fld label="Property Taxes" prefix="$" value={inp.propertyTax||0} onChange={v=>onChange({propertyTax:pn(v)})}/>
          <Fld label="Insurance" prefix="$" value={inp.insurance||0} onChange={v=>onChange({insurance:pn(v)})}/>
          <Fld label="Property Management Fee" suffix="%" hint="of EGI" value={inp.managementFeePct||0} onChange={v=>onChange({managementFeePct:pn(v)})}/>
          <Fld label="Repairs & Maintenance" prefix="$" value={inp.maintenance||0} onChange={v=>onChange({maintenance:pn(v)})}/>
          <Fld label="Utilities" prefix="$" value={inp.utilities||0} onChange={v=>onChange({utilities:pn(v)})}/>
          <Fld label="Capital Reserves" prefix="$" value={inp.reserves||0} onChange={v=>onChange({reserves:pn(v)})}/>
          <Fld label="Administrative" prefix="$" value={inp.administrative||0} onChange={v=>onChange({administrative:pn(v)})}/>
        </div>
        <div style={{display:'flex',gap:28,flexWrap:'wrap',alignItems:'baseline',paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div>
            <span style={{color:'var(--muted)',fontSize:'var(--fs-4)'}}>Implied Cap Rate&nbsp;&nbsp;</span>
            <span className="mono" style={{fontWeight:700,fontSize:'var(--fs-5)',color:capR>0?'var(--text)':'var(--neg)'}}>{f.pct(capR,2)}</span>
          </div>
          <div>
            <span style={{color:'var(--muted)',fontSize:'var(--fs-4)'}}>Year 1 NOI&nbsp;&nbsp;</span>
            <span className="mono" style={{fontWeight:700,fontSize:'var(--fs-5)',color:noi>0?'var(--text)':'var(--neg)'}}>{f.$f(noi)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export{Step3};
