import{useState,useRef}from'react';
import{f,pn}from'../engine/format.js';
import{parseFile,extractFields,extractRentRoll}from'../engine/parse.js';
import{Fld,Card}from'./ui.jsx';
import{UnitMixEditor,RetailEditor,CreditEditor}from'./editors.jsx';
// ─── STEP 2 PROPERTY + UPLOAD ─────────────────────────────────────────────
const G2={display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'};
const G3={display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 16px'};

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
  const isCost=t==='development'||t==='affordable'; // land cost basis, not a purchase price
  const setMix=mix=>{
    const u=mix.reduce((a,r)=>a+(+r.count||0),0);
    const an=mix.reduce((a,r)=>a+(+r.count||0)*(+r.rent||0)*12,0);
    onChange({unitMix:mix,numUnits:u,avgRent:u?Math.round(an/u/12):0});
  };
  const acqFld=<Fld label="Acquisition Costs / Fees" suffix="%" hint={`closing, legal, title = ${f.$((inp.purchasePrice||0)*(inp.acquisitionCostsPct||0)/100)}`} value={inp.acquisitionCostsPct} onChange={v=>onChange({acquisitionCostsPct:pn(v)})}/>;

  return(
    <div className="fu">
      <div style={{marginBottom:18}}>
        <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>Property Details</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-5)',lineHeight:1.55}}>Enter the deal manually, or drop in a rent roll and we'll fill what we can.</p>
      </div>

      <Card title="Start from a file" sub="Optional — rent roll, OM financials, or lease abstract">
        <div className={`upload-z${dov?' dov':''}`}
          onDragOver={e=>{e.preventDefault();setDov(true)}} onDragLeave={()=>setDov(false)}
          onDrop={e=>{e.preventDefault();setDov(false);handleFile(e.dataTransfer.files[0])}}
          onClick={()=>ref.current?.click()}>
          <input ref={ref} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
          <div style={{marginBottom:8}}>{parsed?
            <span style={{color:'var(--pos)',fontSize:'var(--fs-9)',fontWeight:700}}>&#10003;</span>:
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
          </div>
          <div style={{fontSize:'var(--fs-5)',fontWeight:600,color:'var(--text)',marginBottom:4}}>
            {parsed?`${parsed.data.length} rows imported, fields auto-populated`:'Drop a file, or click to browse'}
          </div>
          <div style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>
            {parsed?`${parsed.headers.length} columns detected`:'.csv, .xlsx, .xls'}
          </div>
          {rollInfo&&<div style={{marginTop:12,padding:'8px 14px',background:'var(--pos-tint)',border:'1px solid var(--pos-brd)',borderRadius:'var(--r-md)',fontSize:'var(--fs-3)',color:'var(--pos)',display:'inline-block',fontWeight:600}}>
            Rent roll detected — {rollInfo.numUnits} units across {rollInfo.unitMix.length} floor plan{rollInfo.unitMix.length!==1?'s':''}, loaded into the unit mix below.
          </div>}
        </div>
      </Card>

      <Card title="Property">
        <div style={G2} className="g2">
          <Fld label="Property Name" value={inp.propertyName||''} onChange={v=>onChange({propertyName:v})}/>
          <Fld label="Address / Market" value={inp.address||''} onChange={v=>onChange({address:v})}/>
        </div>
        {!isCost&&(
          <div style={G2} className="g2">
            <Fld label="Purchase Price" prefix="$" value={inp.purchasePrice} onChange={v=>onChange({purchasePrice:pn(v)})}/>
            {acqFld}
          </div>
        )}
      </Card>

      {t==='multifamily'&&(
        <Card title="Unit Mix" sub="Floor plans, counts, and monthly rents">
          <UnitMixEditor rows={inp.unitMix} onChange={setMix}/>
        </Card>
      )}

      {t==='commercial'&&(
        <Card title="Space & Income" sub="Rentable area and tenant rents">
          <div style={G2} className="g2">
            <Fld label="Total Rentable SF" value={inp.totalSF} onChange={v=>onChange({totalSF:pn(v)})}/>
            <Fld label="CAM / NNN Income" prefix="$" value={inp.camIncome||0} onChange={v=>onChange({camIncome:pn(v)})}/>
          </div>
          <RetailEditor rows={inp.retailIncome} onChange={r=>onChange({retailIncome:r})}/>
        </Card>
      )}

      {t==='mixed-use'&&(<>
        <Card title="Residential Unit Mix">
          <UnitMixEditor rows={inp.unitMix} onChange={setMix}/>
        </Card>
        <Card title="Commercial / Retail" sub="Ground-floor and other commercial space">
          <RetailEditor rows={inp.retailIncome} onChange={r=>{const sf=r.reduce((a,x)=>a+(+x.sf||0),0);onChange({retailIncome:r,commercialSF:sf});}}/>
        </Card>
      </>)}

      {t==='development'&&(<>
        <Card title="Development Budget" sub="Land, hard and soft costs">
          <div style={G2} className="g2">
            <Fld label="Land / Site Cost" prefix="$" value={inp.landCost||inp.purchasePrice} onChange={v=>onChange({landCost:pn(v),purchasePrice:pn(v)})}/>
            <Fld label="Gross Buildable SF" value={inp.grossBuildableSF} onChange={v=>onChange({grossBuildableSF:pn(v)})}/>
            <Fld label="Hard Cost / SF" prefix="$" value={inp.hardCostPerSF} onChange={v=>onChange({hardCostPerSF:pn(v)})}/>
            <Fld label="Soft Costs" suffix="%" hint="of hard costs" value={inp.softCostsPct} onChange={v=>onChange({softCostsPct:pn(v)})}/>
            {acqFld}
          </div>
        </Card>
        <Card title="Schedule" sub="Construction and lease-up timing">
          <div style={G3} className="g3">
            <Fld label="Construction Period" suffix="mos" value={inp.constructionPeriodMonths} onChange={v=>onChange({constructionPeriodMonths:pn(v)})}/>
            <Fld label="Lease-Up Period" suffix="mos" value={inp.leaseUpMonths} onChange={v=>onChange({leaseUpMonths:pn(v)})}/>
            <div style={{marginBottom:16}}>
              <label className="fld-l">Draw Pattern</label>
              <select className="input-f" value={inp.drawPattern||'straight'} onChange={e=>onChange({drawPattern:e.target.value})} style={{height:40}}>
                <option value="straight">Straight-line</option>
                <option value="scurve">S-curve</option>
              </select>
            </div>
          </div>
        </Card>
        <Card title="Stabilized Unit Mix" sub="Rents at stabilization">
          <UnitMixEditor rows={inp.unitMix} onChange={setMix}/>
        </Card>
        <Card title="Tax Credits" sub="Historic, brownfield, or other stacked credits">
          <CreditEditor rows={inp.devCredits} onChange={c=>onChange({devCredits:c})}/>
        </Card>
      </>)}

      {t==='affordable'&&(<>
        <Card title="Development Budget" sub="Land, costs, and developer fee">
          <div style={G2} className="g2">
            <Fld label="Land / Site Cost" prefix="$" value={inp.landCost} onChange={v=>onChange({landCost:pn(v),purchasePrice:pn(v)})}/>
            <Fld label="Gross Buildable SF" value={inp.grossBuildableSF} onChange={v=>onChange({grossBuildableSF:pn(v)})}/>
            <Fld label="Hard Cost / SF" prefix="$" value={inp.hardCostPerSF} onChange={v=>onChange({hardCostPerSF:pn(v)})}/>
            <Fld label="Soft Costs" suffix="%" hint="of hard costs" value={inp.softCostsPct} onChange={v=>onChange({softCostsPct:pn(v)})}/>
            <Fld label="Developer Fee" prefix="$" value={inp.developerFee} onChange={v=>onChange({developerFee:pn(v)})}/>
            <Fld label="Soft Sources / Subsidy" prefix="$" hint="soft loans, grants" value={inp.softSources} onChange={v=>onChange({softSources:pn(v)})}/>
          </div>
        </Card>
        <Card title="Tax Credit Assumptions" sub="Credit type, pricing, and eligible basis">
          <div style={G3} className="g3">
            <div style={{marginBottom:16}}>
              <label className="fld-l">Credit Type</label>
              <select className="input-f" value={inp.creditType||'9'} onChange={e=>{const v=e.target.value;onChange({creditType:v,creditRate:v==='4'?4:9});}} style={{height:40}}>
                <option value="9">9% (new construction)</option>
                <option value="4">4% (acq/rehab, bonds)</option>
              </select>
            </div>
            <Fld label="Credit Rate" suffix="%" value={inp.creditRate} onChange={v=>onChange({creditRate:pn(v)})}/>
            <Fld label="Credit Price" prefix="$" hint="per $1 of credit" value={inp.creditPrice} onChange={v=>onChange({creditPrice:parseFloat(v)||0})}/>
            <Fld label="Eligible Basis" suffix="%" hint="of hard+soft+fee" value={inp.eligibleBasisPct} onChange={v=>onChange({eligibleBasisPct:pn(v)})}/>
            <Fld label="Affordable Units" suffix="%" hint="applicable fraction" value={inp.affordablePct} onChange={v=>onChange({affordablePct:pn(v)})}/>
            <Fld label="Min DSCR" hint="sizes the loan" value={inp.minDSCR} onChange={v=>onChange({minDSCR:parseFloat(v)||0})}/>
          </div>
          <label className={'tgl'+(inp.qctDda?' on':'')} style={{marginBottom:12}}>
            <input type="checkbox" checked={!!inp.qctDda} onChange={e=>onChange({qctDda:e.target.checked})} style={{width:16,height:16,accentColor:'var(--accent)'}}/>
            <span>Located in a QCT or DDA &mdash; 130% basis boost</span>
          </label>
          <p style={{fontSize:'var(--fs-3)',color:'var(--muted)',lineHeight:1.6}}>The permanent loan is sized automatically to your minimum DSCR. LIHTC equity, soft sources, and a deferred developer fee fill the remaining gap.</p>
        </Card>
        <Card title="Restricted Unit Mix" sub="Rents at AMI limits">
          <UnitMixEditor rows={inp.unitMix} onChange={setMix}/>
        </Card>
        <Card title="Additional Tax Credits" sub="Historic, brownfield, or other stacked credits">
          <CreditEditor rows={inp.devCredits} onChange={c=>onChange({devCredits:c})}/>
        </Card>
      </>)}
    </div>
  );
}

export{Step2};
