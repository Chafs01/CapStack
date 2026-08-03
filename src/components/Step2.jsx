import{useState,useRef}from'react';
import{f,pn}from'../engine/format.js';
import{parseFile,extractFields,extractRentRoll}from'../engine/parse.js';
import{Fld,Card}from'./ui.jsx';
import{UnitMixEditor,RetailEditor,CreditEditor,DevCostEditor,
  HARD_COST_CATEGORIES,SOFT_COST_CATEGORIES,HARD_COST_BASES,SOFT_COST_BASES,
  REHAB_CATEGORIES,REHAB_BASES}from'./editors.jsx';
import{getHardCost,getSoftCost,getRehab}from'../engine/income.js';
// ─── STEP 2 PROPERTY + UPLOAD ─────────────────────────────────────────────
const G2={display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'};
const G3={display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 16px'};
// Labels/formats for the "here's what the file actually filled in" receipt.
const FIELD_L={purchasePrice:'Purchase price',loanAmount:'Loan amount',numUnits:'Units',avgRent:'Average rent',
  stabilizedNOI:'Stabilized NOI',totalSF:'Total SF',avgRentPerSF:'Rent per SF',propertyTax:'Property taxes',insurance:'Insurance'};
// f.$f, not f.$ — this is a receipt of what was read, so it shows the exact
// figure rather than rounding $1,650 to "$2K".
const FIELD_F={purchasePrice:f.$f,loanAmount:f.$f,avgRent:f.$f,stabilizedNOI:f.$f,propertyTax:f.$f,insurance:f.$f,
  totalSF:v=>v.toLocaleString('en-US'),avgRentPerSF:v=>'$'+v};

function Step2({inp,onChange,assetType}){
  const [dov,setDov]=useState(false);
  const [parsed,setParsed]=useState(null);
  const ref=useRef();
  const [rollInfo,setRollInfo]=useState(null);
  const [filled,setFilled]=useState([]);
  const handleFile=f2=>{
    if(!f2)return;
    parseFile(f2,res=>{
      setParsed(res);
      const ex=extractFields(res.data);
      const roll=extractRentRoll(res.data);
      if(roll){ex.unitMix=roll.unitMix;ex.numUnits=roll.numUnits;ex.avgRent=roll.avgRent;setRollInfo(roll);}
      else setRollInfo(null);
      // Show the user exactly which fields the file moved, so a partial or
      // failed read is obvious instead of hiding behind a green checkmark.
      setFilled(Object.keys(ex).filter(k=>k!=='unitMix').map(k=>[FIELD_L[k]||k,FIELD_F[k]?FIELD_F[k](ex[k]):ex[k]]));
      if(Object.keys(ex).length)onChange(ex);
    });
  };
  const got=!!rollInfo||filled.length>0;
  const t=assetType.toLowerCase();
  const isCost=t==='development'||t==='affordable'; // land cost basis, not a purchase price
  const setMix=mix=>{
    const u=mix.reduce((a,r)=>a+(+r.count||0),0);
    const an=mix.reduce((a,r)=>a+(+r.count||0)*(+r.rent||0)*12,0);
    onChange({unitMix:mix,numUnits:u,avgRent:u?Math.round(an/u/12):0});
  };
  const acqFld=<Fld label="Acquisition Costs / Fees" suffix="%" hint={`closing, legal, title = ${f.$((inp.purchasePrice||0)*(inp.acquisitionCostsPct||0)/100)}`} value={inp.acquisitionCostsPct} onChange={v=>onChange({acquisitionCostsPct:pn(v)})}/>;

  // A budget entered before itemising existed is shown as the lines it always
  // was — one hard cost quote, one soft cost percentage — so nothing on screen
  // moves just because entry got richer. Touching a line writes the list, and
  // from then on the list is what the model reads.
  const hardRows=Array.isArray(inp.hardCostItems)?inp.hardCostItems
    :((inp.hardCostPerSF||0)>0?[{cat:'Structure & Shell',basis:'perSF',amount:inp.hardCostPerSF}]:[]);
  const softRows=Array.isArray(inp.softCostItems)?inp.softCostItems
    :((inp.softCostsPct||0)>0?[{cat:'Custom',label:'Soft costs',basis:'pctHard',amount:inp.softCostsPct}]:[]);
  // Renovation is new, so there is no legacy shape to honour — an absent list
  // is simply no renovation.
  const rehabRows=Array.isArray(inp.rehabItems)?inp.rehabItems:[];
  const rehabTotal=getRehab({...inp,rehabItems:rehabRows});
  const rehabPct=Math.max(0,Math.min(+(inp.rehabFinancedPct)||0,100));
  const rehabMos=Math.max(0,+(inp.rehabMonths)||0);
  const rehabFinHint=rehabTotal>0
    ? `${f.$(rehabTotal*rehabPct/100)} on the loan, ${f.$(rehabTotal*(1-rehabPct/100))} out of pocket`
    : 'a bridge or rehab loan funds part of the work';
  const rehabTimeHint=rehabTotal>0&&rehabMos>0
    ? `${f.$(rehabTotal*(1-rehabPct/100)/rehabMos)} of cash a month for ${rehabMos} months`
    : '0 spends it all at closing';

  const hardTotal=getHardCost({...inp,hardCostItems:hardRows});
  const softTotal=getSoftCost({...inp,softCostItems:softRows},hardTotal);
  const devBudget=(<>
    <DevCostEditor rows={hardRows} onChange={r=>onChange({hardCostItems:r})}
      cats={HARD_COST_CATEGORIES} bases={HARD_COST_BASES}
      label="Hard Cost Line Items" noun="hard cost"
      placeholder="Name this line (e.g. Podium Deck, Solar Array)"
      sf={inp.grossBuildableSF} units={inp.numUnits} hard={0}/>
    <div style={{paddingTop:14,borderTop:'1px solid var(--border)'}}>
      <DevCostEditor rows={softRows} onChange={r=>onChange({softCostItems:r})}
        cats={SOFT_COST_CATEGORIES} bases={SOFT_COST_BASES}
        label="Soft Cost Line Items" noun="soft cost"
        placeholder="Name this line (e.g. Public Art Fee, Relocation)"
        sf={inp.grossBuildableSF} units={inp.numUnits} hard={hardTotal}/>
    </div>
  </>);
  // The total is the number every other figure is built on, so it is shown
  // where it is entered rather than three steps later.
  const budgetTotal=fee=>{
    const land=inp.landCost||inp.purchasePrice||0;
    const total=land+hardTotal+softTotal+(fee||0);
    const sf=+inp.grossBuildableSF||0,u=+inp.numUnits||0;
    const parts=[['Land',land],['Hard',hardTotal],['Soft',softTotal]];
    if(fee)parts.push(['Developer Fee',fee]);
    return(
      <div style={{paddingTop:16,borderTop:'1px solid var(--border)'}}>
        <div style={{display:'flex',gap:28,flexWrap:'wrap',alignItems:'baseline'}}>
          {parts.map(([l,v])=>(
            <div key={l}>
              <span style={{color:'var(--muted)',fontSize:'var(--fs-4)'}}>{l}&nbsp;&nbsp;</span>
              <span className="mono" style={{fontWeight:600,fontSize:'var(--fs-4)',color:'var(--muted)'}}>{f.$(v)}</span>
            </div>
          ))}
          <div>
            <span style={{color:'var(--muted)',fontSize:'var(--fs-4)'}}>Total Development Cost&nbsp;&nbsp;</span>
            <span className="mono" style={{fontWeight:700,fontSize:'var(--fs-5)',color:total>0?'var(--text)':'var(--muted2)'}}>{total>0?f.$f(total):'—'}</span>
          </div>
        </div>
        {total>0&&(sf>0||u>0)&&(
          <div style={{marginTop:6,fontSize:'var(--fs-3)',color:'var(--muted2)'}}>
            {sf>0&&<span>{f.$f(total/sf)} / buildable SF</span>}
            {sf>0&&u>0&&<span>&nbsp;&middot;&nbsp;</span>}
            {u>0&&<span>{f.$f(total/u)} / unit</span>}
          </div>
        )}
      </div>
    );
  };

  return(
    <div className="fu">
      <div style={{marginBottom:18}}>
        <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>Property Details</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-5)',lineHeight:1.55}}>Enter the deal manually, or drop in a rent roll and we'll fill what we can.</p>
      </div>

      <Card title="Start from a file" sub="Optional — rent roll, OM financials, or lease abstract"
        info={<>Drop in a rent roll, an offering memorandum's financial page, or a CSV and
          the fields it recognises are filled in for you. It reads what it can and shows
          you exactly which fields it moved, so a partial read is obvious rather than
          silent. Nothing is locked — everything it fills stays editable, and you can skip
          this entirely and type the deal in yourself.</>}>
        <div className={`upload-z${dov?' dov':''}`}
          onDragOver={e=>{e.preventDefault();setDov(true)}} onDragLeave={()=>setDov(false)}
          onDrop={e=>{e.preventDefault();setDov(false);handleFile(e.dataTransfer.files[0])}}
          onClick={()=>ref.current?.click()}>
          <input ref={ref} type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>handleFile(e.target.files[0])}/>
          <div style={{marginBottom:8}}>{parsed?
            <span style={{color:got?'var(--pos)':'var(--muted2)',fontSize:'var(--fs-9)',fontWeight:700}}>{got?'✓':'—'}</span>:
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
          </div>
          <div style={{fontSize:'var(--fs-5)',fontWeight:600,color:'var(--text)',marginBottom:4}}>
            {!parsed?'Drop a file, or click to browse'
              :got?`Read ${parsed.data.length} row${parsed.data.length!==1?'s':''} — ${filled.length+(rollInfo?1:0)} field${filled.length+(rollInfo?1:0)!==1?'s':''} filled in below`
              :"Couldn't read this one — enter the deal manually below"}
          </div>
          <div style={{fontSize:'var(--fs-3)',color:'var(--muted2)'}}>
            {!parsed?'.csv, .xlsx, .xls'
              :got?`${parsed.headers.length} columns detected — check every value before you rely on it`
              :'Works best with one header row and columns named like Unit Type, Rent, Purchase Price'}
          </div>
          {(rollInfo||filled.length>0)&&<div style={{marginTop:12,padding:'10px 14px',background:'var(--pos-tint)',border:'1px solid var(--pos-brd)',borderRadius:'var(--r-md)',fontSize:'var(--fs-3)',color:'var(--pos)',display:'inline-block',fontWeight:600,textAlign:'left'}}>
            {rollInfo&&<div style={{marginBottom:filled.length?6:0}}>
              Rent roll detected — {rollInfo.numUnits} units across {rollInfo.unitMix.length} floor plan{rollInfo.unitMix.length!==1?'s':''}, loaded into the unit mix below.
            </div>}
            {filled.map(([l,v])=>(
              <div key={l} style={{display:'flex',gap:10,justifyContent:'space-between'}}>
                <span>{l}</span><span className="mono">{String(v)}</span>
              </div>
            ))}
          </div>}
        </div>
      </Card>

      <Card title="Property"
        info={<>The basics of what you are buying. Purchase price is the contract price,
          before costs. Acquisition costs are the fees to close — legal, title, inspection,
          lender third parties — usually 1 to 2% of price, and they are real money that
          comes out of your pocket alongside the down payment, so leaving them at zero
          understates the equity the deal needs.</>}>
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
        <Card title="Unit Mix" sub="Floor plans, counts, and monthly rents"
          info={<>Every floor plan, how many of each, and what one rents for today. This
            drives gross potential income, so use in-place rents rather than what you hope
            to charge — the upside belongs in the Renovation Budget and the growth rate,
            where it can be seen and argued with. If the rent roll shows a unit vacant,
            still enter its market rent; vacancy is taken as a percentage on the next
            step.</>}>
          <UnitMixEditor rows={inp.unitMix} onChange={setMix}/>
        </Card>
      )}

      {t==='commercial'&&(
        <Card title="Space & Income" sub="Rentable area and tenant rents"
          info={<>Commercial rent is quoted per square foot per year, so 25,000 SF at $28
            is $700,000 of base rent. CAM or NNN income is what tenants reimburse you for
            taxes, insurance and common-area upkeep — on a true triple-net lease that is
            most of the operating cost, so if you enter the reimbursement here you must
            also enter the matching expense on the next step or the deal will look far
            better than it is.</>}>
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
        <Card title="Commercial / Retail" sub="Ground-floor and other commercial space"
          info={<>The non-residential half of a mixed-use building, usually the ground
            floor. Rent per SF per year, entered by space. Commercial tenants pay more per
            foot than apartments but leave for longer and cost more to re-let, so a lender
            will often value this income more conservatively than the residential
            income above it.</>}>
          <RetailEditor rows={inp.retailIncome} onChange={r=>{const sf=r.reduce((a,x)=>a+(+x.sf||0),0);onChange({retailIncome:r,commercialSF:sf});}}/>
        </Card>
      </>)}

      {!isCost&&(
        <Card title="Renovation Budget" sub="Optional — one-time work at or after closing. Leave empty for a turnkey deal"
          info={<>A scope of work you finish, not a yearly reserve. Enter it the way a
            contractor quotes it — per unit for turns, lump sum for a roof — and set how
            much of it the loan funds and how many months it takes to spend. It adds to
            your cost basis and to total cash in, and it lands in the year you actually
            spend it, so an 18-month scope shows up across two years of cash flow rather
            than all at closing. If the work is meant to raise rents, raise them in the
            unit mix too; this side only spends the money.</>}>
          <DevCostEditor rows={rehabRows} onChange={r=>onChange({rehabItems:r})}
            cats={REHAB_CATEGORIES} bases={REHAB_BASES}
            label="Renovation Line Items" noun="renovation line"
            placeholder="Name this scope (e.g. Boiler Replacement, Balcony Repair)"
            sf={inp.totalSF||0} units={inp.numUnits||0} hard={0}/>
          <div style={G2} className="g2">
            <Fld label="Funded by Loan" suffix="%" hint={rehabFinHint}
              value={inp.rehabFinancedPct||0} onChange={v=>onChange({rehabFinancedPct:pn(v)})}/>
            <Fld label="Spend Over" suffix="mos" hint={rehabTimeHint}
              value={inp.rehabMonths||0} onChange={v=>onChange({rehabMonths:pn(v)})}/>
          </div>
          <p style={{fontSize:'var(--fs-3)',color:'var(--muted)',lineHeight:1.55,marginTop:2}}>
            This is a scope you finish, not the annual CapEx reserve on the next step —
            that one recurs every year of the hold. Renovation adds to your basis and to
            total cash in, and it lands in the year you actually spend it.
          </p>
        </Card>
      )}

      {t==='development'&&(<>
        <Card title="Development Budget" sub="Land, hard and soft costs — add or rename lines to match the budget"
          info={<>What it costs to build. Hard costs are physical construction — sitework,
            shell, MEP, finishes — quoted by trade, per SF or per unit. Soft costs are
            everything else: design, permits, legal, insurance, construction-loan interest.
            Several soft lines are normally quoted as a percentage of hard cost, which is
            why that basis is offered here and not on the hard side. Carry a contingency
            on both; 5 to 10% on hard cost is standard and the first thing a lender looks
            for. This total, not the land price, is what the deal is measured against.</>}>
          <div style={G2} className="g2">
            <Fld label="Land / Site Cost" prefix="$" value={inp.landCost||inp.purchasePrice} onChange={v=>onChange({landCost:pn(v),purchasePrice:pn(v)})}/>
            <Fld label="Gross Buildable SF" hint="the denominator for any per-SF line" value={inp.grossBuildableSF} onChange={v=>onChange({grossBuildableSF:pn(v)})}/>
            {acqFld}
          </div>
          {devBudget}
          {budgetTotal(0)}
        </Card>
        <Card title="Schedule" sub="Construction and lease-up timing"
          info={<>How long before the building earns anything. Construction is months of
            spending with no income; lease-up is the stretch after delivery while units
            fill. Both push the first real cash flow further out, and on a development
            that delay is usually the difference between a good return and a bad one.
            Be honest here — permitting and weather do not care about the model.</>}>
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
        <Card title="Development Budget" sub="Land, costs, and developer fee — add or rename lines to match the budget"
          info={<>What it costs to build. Hard costs are physical construction — sitework,
            shell, MEP, finishes — quoted by trade, per SF or per unit. Soft costs are
            everything else: design, permits, legal, insurance, construction-loan interest.
            Several soft lines are normally quoted as a percentage of hard cost, which is
            why that basis is offered here and not on the hard side. Carry a contingency
            on both; 5 to 10% on hard cost is standard and the first thing a lender looks
            for. This total, not the land price, is what the deal is measured against.</>}>
          <div style={G2} className="g2">
            <Fld label="Land / Site Cost" prefix="$" value={inp.landCost} onChange={v=>onChange({landCost:pn(v),purchasePrice:pn(v)})}/>
            <Fld label="Gross Buildable SF" hint="the denominator for any per-SF line" value={inp.grossBuildableSF} onChange={v=>onChange({grossBuildableSF:pn(v)})}/>
            <Fld label="Developer Fee" prefix="$" hint="kept separate — it can be deferred to close the gap" value={inp.developerFee} onChange={v=>onChange({developerFee:pn(v)})}/>
            <Fld label="Soft Sources / Subsidy" prefix="$" hint="soft loans, grants" value={inp.softSources} onChange={v=>onChange({softSources:pn(v)})}/>
          </div>
          {devBudget}
          {budgetTotal(inp.developerFee||0)}
        </Card>
        <Card title="Tax Credit Assumptions" sub="Credit type, pricing, and eligible basis"
          info={<>How LIHTC turns into money. The credit rate — 9% for competitive new
            construction, 4% with bonds — is applied to eligible basis, which is roughly
            the depreciable development cost, times the share of units held affordable.
            That produces an annual credit claimed over ten years, which an investor buys
            up front at a price per credit dollar (commonly $0.85 to $0.95). Minimum DSCR
            matters more than usual here: the permanent loan is sized off it, and
            everything the loan does not cover has to come from credits, soft money, or
            a deferred developer fee.</>}>
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
