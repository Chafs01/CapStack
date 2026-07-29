import{f,pn}from'../engine/format.js';
import{getGPI,getDevCost,getOtherIncome}from'../engine/income.js';
import{Fld,Slider,Card,Metric}from'./ui.jsx';
import{summaryFigures}from'../lib/figures.js';
import{OpExEditor,OtherIncomeEditor}from'./editors.jsx';
// ─── STEP 3 INCOME & EXPENSES ─────────────────────────────────────────────
// Legacy deals carry six named expense fields; new ones carry a list. The
// editor shows either as rows, and any edit commits the list and zeroes the
// old fields so only one of the two is ever counted.
const LEGACY_OPEX=[['propertyTax','Property Taxes'],['insurance','Insurance'],
  ['maintenance','Repairs & Maintenance'],['utilities','Utilities'],
  ['reserves','Capital Reserves'],['administrative','Administrative']];

function Step3({inp,onChange}){
  const t=inp.assetType.toLowerCase();
  const opexRows=Array.isArray(inp.opexItems)&&inp.opexItems.length
    ? inp.opexItems
    : LEGACY_OPEX.map(([k,cat])=>({cat,amount:inp[k]||0}));
  const otherRows=Array.isArray(inp.otherIncomeItems)&&inp.otherIncomeItems.length
    ? inp.otherIncomeItems
    : ((inp.otherIncome||0)>0?[{cat:'Custom',label:'Other income',amount:inp.otherIncome}]:[]);
  const setOther=rows=>onChange({otherIncomeItems:rows,otherIncome:0});

  const setOpex=rows=>onChange({opexItems:rows,
    propertyTax:0,insurance:0,maintenance:0,utilities:0,reserves:0,administrative:0});

  const gpi=getGPI(inp);
  const vac=gpi*(inp.vacancyRate||0)/100;
  const egi=gpi-vac+getOtherIncome(inp);
  const mgmt=egi*(inp.managementFeePct||0)/100;
  const opex=(inp.propertyTax||0)+(inp.insurance||0)+mgmt+(inp.maintenance||0)+(inp.utilities||0)+(inp.reserves||0)+(inp.administrative||0);
  const noi=egi-opex;
  const er=egi>0?opex/egi:0;
  const capBasis=t==='development'?getDevCost(inp):(inp.purchasePrice||0);
  const capR=capBasis>0?noi/capBasis:0;
  // Color marks an exception worth a second look — not every figure. An
  // untouched form has no exceptions to mark, so nothing on it reads red.
  const S=summaryFigures({gpi,egi,opex,noi,capBasis,capR});
  const DASH='—';
  const cells=[
    {label:'Gross Income',value:S.started?f.$(gpi):DASH},
    {label:'Eff. Gross Income',value:S.started?f.$(egi):DASH},
    {label:'NOI',value:S.noi.ready?f.$(noi):DASH,tone:S.noi.tone==='neg'?'neg':null},
    {label:'Expense Ratio',value:S.started?`${(er*100).toFixed(1)}%`:DASH,tone:S.started?(er>0.6?'neg':er>0.45?'warn':null):null},
  ];
  return(
    <div className="fu">
      <div style={{marginBottom:18}}>
        <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>Income &amp; Expenses</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-5)',lineHeight:1.55}}>Enter your Year 1 operating assumptions. The summary at the bottom updates as you type.</p>
      </div>

      <Card title="Revenue" sub="Gross potential income and vacancy">
        <Slider label="Physical Vacancy + Credit Loss" min={0} max={25} step={0.5} value={inp.vacancyRate||0} onChange={v=>onChange({vacancyRate:v})} fmt2={v=>`${v}%`}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}} className="g2">
          {t==='multifamily'&&<><Fld label="Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/></>}
          {t==='commercial'&&<><Fld label="Total SF" value={inp.totalSF} onChange={v=>onChange({totalSF:pn(v)})}/><Fld label="Base Rent / SF" prefix="$" value={inp.avgRentPerSF} onChange={v=>onChange({avgRentPerSF:pn(v)})}/><Fld label="CAM / NNN Income" prefix="$" value={inp.camIncome||0} onChange={v=>onChange({camIncome:pn(v)})}/></>}
          {t==='mixed-use'&&<><Fld label="Residential Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/><Fld label="Commercial SF" value={inp.commercialSF||0} onChange={v=>onChange({commercialSF:pn(v)})}/><Fld label="Commercial Rent / SF" prefix="$" value={inp.commercialRentPerSF||0} onChange={v=>onChange({commercialRentPerSF:pn(v)})}/></>}
          {t==='development'&&<><Fld label="Stabilized Units" value={inp.numUnits} onChange={v=>onChange({numUnits:pn(v)})}/><Fld label="Avg Monthly Rent" prefix="$" value={inp.avgRent} onChange={v=>onChange({avgRent:pn(v)})}/></>}
        </div>
        <div style={{paddingTop:14,borderTop:'1px solid var(--border)',marginTop:4}}>
          <OtherIncomeEditor rows={otherRows} onChange={setOther}/>
        </div>
      </Card>

      <Card title="Operating Expenses" sub="Annual, at Year 1 — add or rename lines to match the deal">
        <OpExEditor rows={opexRows} onChange={setOpex}/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}} className="g2">
          <Fld label="Property Management Fee" suffix="%" hint="of EGI — grows with income, so it is kept separate" value={inp.managementFeePct||0} onChange={v=>onChange({managementFeePct:pn(v)})}/>
        </div>
        <div style={{display:'flex',gap:28,flexWrap:'wrap',alignItems:'baseline',paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div>
            <span style={{color:'var(--muted)',fontSize:'var(--fs-4)'}}>Implied Cap Rate&nbsp;&nbsp;</span>
            <span className="mono" style={{fontWeight:700,fontSize:'var(--fs-5)',color:S.capR.tone==='neg'?'var(--neg)':S.capR.tone==='idle'?'var(--muted2)':'var(--text)'}}>{S.capR.ready?f.pct(capR,2):DASH}</span>
          </div>
          <div>
            <span style={{color:'var(--muted)',fontSize:'var(--fs-4)'}}>Year 1 NOI&nbsp;&nbsp;</span>
            <span className="mono" style={{fontWeight:700,fontSize:'var(--fs-5)',color:S.noi.tone==='neg'?'var(--neg)':S.noi.tone==='idle'?'var(--muted2)':'var(--text)'}}>{S.noi.ready?f.$f(noi):DASH}</span>
          </div>
        </div>
      </Card>

      <Card title="Capital Expenditure" sub="Roofs, HVAC, unit turns — money spent on the asset, not on running it">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}} className="g2">
          <Fld label="Annual CapEx Budget" prefix="$" hint={inp.numUnits>0?`${f.$((inp.capexAnnual||0)/inp.numUnits)} per unit / yr`:'annual reserve for capital work'}
            value={inp.capexAnnual||0} onChange={v=>onChange({capexAnnual:pn(v)})}/>
        </div>
        <p style={{fontSize:'var(--fs-3)',color:'var(--muted)',lineHeight:1.55,marginTop:2}}>
          Sits below NOI, so it reduces cash flow and your cash-on-cash return without
          altering the cap rate or the DSCR a lender sizes on. Leave it at zero and nothing changes.
        </p>
      </Card>

      {/* summary sits after the inputs so people aren't reading numbers
          before they've entered anything */}
      <div className="eyebrow" style={{marginBottom:9,marginTop:24}}>Year 1 summary</div>
      <div className="hair g4" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {cells.map(c=><Metric key={c.label} {...c}/>)}
      </div>
    </div>
  );
}

export{Step3};
