import{pn}from'../engine/format.js';
import{MAX_HOLD}from'../engine/finance.js';
import{getDevCost}from'../engine/income.js';
import{Fld,Slider,Card}from'./ui.jsx';
import{CompEditor}from'./editors.jsx';
import{compsSummary}from'../engine/comps.js';
// ─── STEP 4 FINANCING ─────────────────────────────────────────────────────
const G2={display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'};
const G3={display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 16px'};

function Step4({inp,onChange}){
  const pp=inp.purchasePrice||0;
  const la=inp.loanAmount||0;
  const ltv=pp>0?la/pp*100:0;
  const t=inp.assetType.toLowerCase();
  const devCost=t==='development'?getDevCost(inp):0;
  const isDev=t==='development';
  // A comp set is the working-out behind the exit price. Editing it recomputes
  // the average and writes it to exitPPU; clearing the last comp hands the
  // field back rather than stranding a stale number.
  const comps=Array.isArray(inp.exitComps)?inp.exitComps:[];
  const compS=compsSummary(comps);
  const setComps=rows=>{
    const S=compsSummary(rows);
    onChange(S.used>0?{exitComps:rows,exitPPU:Math.round(S.ppu)}:{exitComps:rows});
  };
  const lev=isDev&&devCost>0?la/devCost*100:ltv;
  return(
    <div className="fu">
      <div style={{marginBottom:18}}>
        <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>Financing &amp; Assumptions</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-5)',lineHeight:1.55}}>Debt structure, growth rates, and exit strategy. Full results come after you generate the analysis.</p>
      </div>

      <Card title="Loan Terms" sub="Your debt on the deal"
        info={<>The mortgage. Amortization is the schedule the payment is calculated on —
          30 years is common on residential, 25 on commercial — and it is usually longer
          than the term, so a balance is still owed when the loan matures. Interest-only
          years raise early cash flow and pay down nothing. DSCR is NOI divided by the
          annual payment; below about 1.25x most lenders will not fund the amount you
          have entered.</>}>
        {!inp.sizeDebt?(
          <div style={G2} className="g2">
            <Fld label="Loan Amount" prefix="$" value={inp.loanAmount} onChange={v=>onChange({loanAmount:pn(v)})}/>
            <div>
              <Fld label={isDev?'Loan-to-Cost':'Loan-to-Value'} suffix="%" hint="sets the loan amount" value={+lev.toFixed(1)} onChange={v=>onChange({loanAmount:Math.round((isDev?devCost:pp)*pn(v)/100)})}/>
              {/* row gap leaves room for the enlarged mobile tap area below */}
              <div style={{display:'flex',gap:'12px 6px',flexWrap:'wrap',marginTop:-8,marginBottom:16}}>
                {[50,60,65,70,75,80,85,90].map(p=>(
                  <button key={p} className="btn-q" onClick={()=>onChange({loanAmount:Math.round((isDev?devCost:pp)*p/100)})}>{p}%</button>
                ))}
              </div>
            </div>
          </div>
        ):(
          <>
            <div style={G3} className="g3">
              <Fld label="Min DSCR" hint="stabilized coverage" value={inp.minDSCR} onChange={v=>onChange({minDSCR:parseFloat(v)||0})}/>
              <Fld label={isDev?'Max LTC':'Max LTV'} suffix="%" value={isDev?inp.maxLTC:inp.maxLTV} onChange={v=>onChange(isDev?{maxLTC:pn(v)}:{maxLTV:pn(v)})}/>
              <Fld label="Min Debt Yield" suffix="%" value={inp.minDebtYield} onChange={v=>onChange({minDebtYield:parseFloat(v)||0})}/>
            </div>
          </>
        )}
        <div style={G2} className="g2">
          <Fld label="Interest Rate" suffix="%" value={inp.interestRate} onChange={v=>onChange({interestRate:pn(v)})}/>
          <Fld label="Amortization" suffix="yrs" value={inp.amortYears} onChange={v=>onChange({amortYears:pn(v)})}/>
          <Fld label="Interest-Only Period" suffix="yrs" hint="0 = none" value={inp.ioPeriod} onChange={v=>onChange({ioPeriod:pn(v)})}/>
          <Fld label="Origination / Loan Fee" suffix="%" value={inp.loanFeesPct} onChange={v=>onChange({loanFeesPct:pn(v)})}/>
        </div>
      </Card>

      <Card title="Hold & Exit" sub="Growth, hold period, and exit pricing"
        info={<>How long you own it and what you sell it for. The exit cap rate is the
          single most powerful number in the model: it prices the sale, and most of a
          levered return usually comes from that sale rather than from operations. The
          honest habit is to exit at a cap rate at or above the one you bought at —
          assuming it compresses is assuming the market does you a favour. Check the
          sensitivity grid on the results screen before trusting any headline IRR.</>}>
        <div className="eyebrow" style={{marginBottom:9}}>How the exit is priced</div>
        <div style={{display:'flex',gap:10,marginBottom:6,flexWrap:'wrap'}}>
          {[['cap','Income \u2014 cap rate','Values the property off forward NOI. Standard for 5+ unit and commercial assets.'],
            ['ppu','Sales comparables \u2014 $ per unit','How 1\u20134 unit residential is actually appraised.']].map(([k,lab,help])=>{
            const on=(inp.exitMethod==='ppu'?'ppu':'cap')===k;
            return(
              <button key={k} type="button" onClick={()=>onChange({exitMethod:k})}
                style={{flex:'1 1 240px',textAlign:'left',padding:'13px 15px',cursor:'pointer',borderRadius:0,
                  background:on?'var(--accent-tint)':'none',border:'1px solid '+(on?'var(--accent)':'var(--border)'),
                  fontFamily:"'Inter',sans-serif"}}>
                <div style={{fontSize:'var(--fs-4)',fontWeight:on?600:500,marginBottom:3}}>{lab}</div>
                <div style={{fontSize:'var(--fs-3)',color:'var(--muted)',lineHeight:1.5}}>{help}</div>
              </button>
            );
          })}
        </div>
        {inp.exitMethod==='ppu'&&(<>
          {/* The comps derive the per-unit figure rather than the user typing a
              conclusion. Writing the average straight into exitPPU means every
              other module — sensitivity, refinance, the workbook — keeps
              reading the one field it always has. */}
          <CompEditor rows={comps} onChange={setComps} residential={inp.propClass==='residential'}/>
          <div style={G2} className="g2">
            <Fld label={inp.propClass==='residential'?'Comparable Property Value per Unit':'Exit Price per Unit'} prefix="$"
              hint={compS.used?`average of ${compS.used} comparable${compS.used===1?'':'s'} — edit a comp to change it`:'comparable sale value today'}
              disabled={compS.used>0}
              value={inp.exitPPU!=null?inp.exitPPU:0} onChange={v=>onChange({exitPPU:pn(v)})}/>
            <Fld label="Annual Appreciation" suffix="%" hint="applied over the hold" value={inp.apprRate!=null?inp.apprRate:3} onChange={v=>onChange({apprRate:parseFloat(v)||0})}/>
          </div>
        </>)}
        {inp.exitMethod==='ppu'&&!(inp.exitPPU>0)&&(
          <div style={{background:'var(--neg-tint)',border:'1px solid var(--neg-brd)',padding:'11px 14px',marginBottom:16,fontSize:'var(--fs-4)',color:'var(--neg)',lineHeight:1.5}}>
            Enter a comparable price per unit. Without one the exit is valued at zero and the returns below will be meaningless.
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 28px'}} className="g2">
          <Slider label={t==='mixed-use'?'Other Income Growth':'Revenue Growth Rate'} min={0} max={8} step={0.25} value={inp.revenueGrowth||3} onChange={v=>onChange({revenueGrowth:v})} fmt2={v=>`${v}% / yr`}/>
          {t==='mixed-use'&&<><Slider label="Residential Rent Growth" min={0} max={8} step={0.25} value={inp.residentialGrowthRate!=null?inp.residentialGrowthRate:inp.revenueGrowth||3} onChange={v=>onChange({residentialGrowthRate:v})} fmt2={v=>`${v}% / yr`}/><Slider label="Commercial Rent Growth" min={0} max={8} step={0.25} value={inp.commercialGrowthRate!=null?inp.commercialGrowthRate:inp.revenueGrowth||3} onChange={v=>onChange({commercialGrowthRate:v})} fmt2={v=>`${v}% / yr`}/></>}
          <Slider label="Expense Growth Rate" min={0} max={8} step={0.25} value={inp.expenseGrowth||2.5} onChange={v=>onChange({expenseGrowth:v})} fmt2={v=>`${v}% / yr`}/>
          <Slider label="Holding Period" min={3} max={MAX_HOLD} step={1} value={inp.holdingPeriod||7} onChange={v=>onChange({holdingPeriod:v})} fmt2={v=>`${v} yrs`}/>
          {inp.exitMethod!=='ppu'&&<Slider label="Exit Cap Rate" min={3.5} max={10} step={0.25} value={inp.exitCapRate||5.5} onChange={v=>onChange({exitCapRate:v})} fmt2={v=>`${v}%`}/>}
          <Slider label="Selling Costs" min={1} max={6} step={0.25} value={inp.sellingCostsPct||3} onChange={v=>onChange({sellingCostsPct:v})} fmt2={v=>`${v}%`}/>
          <Slider label="Discount Rate (NPV)" min={4} max={15} step={0.25} value={inp.discountRate||8} onChange={v=>onChange({discountRate:v})} fmt2={v=>`${v}%`}/>
        </div>
        {(inp.holdingPeriod||7)>10&&(
          <p style={{fontSize:'var(--fs-3)',color:'var(--muted)',lineHeight:1.55,marginTop:2}}>
            Past ten years the growth rates compound into everything, so the later
            figures are a projection rather than an underwrite. Useful for seeing the
            loan amortise; not a number to put in front of a lender.
          </p>
        )}
      </Card>

      {t!=='affordable'&&(
        <Card title="Advanced modelling" sub="Optional — add only what you need"
          info={<>Four optional layers. Each one opens its own section below with its
            own explanation, so you can switch one on and read what it wants before
            filling anything in. None of them is required — the pro forma above is
            already complete — and switching one off leaves everything you typed
            intact in case you want it back.</>}>
          <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.6,marginBottom:16}}>
            Everything above is enough for a complete pro forma. These add depth if your deal calls for it.
          </p>
          {[
            ['sizeDebt','Size the loan automatically','Solve the loan from lender tests — DSCR, ' + (isDev?'LTC':'LTV') + ', and debt yield — instead of typing an amount.'],
            ['waterfallEnabled','Equity waterfall','Split returns between a limited partner and the sponsor, with a preferred return and promote hurdles.'],
            ['afterTax','After-tax analysis','Layer in the depreciation shield, recapture, and capital gains at sale.'],
            ['refiEnabled','Mid-hold refinance','Pull equity out partway through the hold and re-lever on new debt.'],
          ].map(([key,label,help])=>(
            <label key={key} className={'tgl'+(inp[key]?' on':'')} style={{marginBottom:8,alignItems:'flex-start'}}>
              <input type="checkbox" checked={!!inp[key]} onChange={e=>onChange({[key]:e.target.checked})} style={{width:16,height:16,marginTop:2,accentColor:'var(--accent)'}}/>
              <span style={{display:'block'}}>
                {label}
                <span style={{display:'block',fontWeight:400,color:'var(--muted)',fontSize:'var(--fs-3)',marginTop:3,lineHeight:1.5}}>{help}</span>
              </span>
            </label>
          ))}
        </Card>
      )}

      {t!=='affordable'&&inp.waterfallEnabled&&(
        <Card title="Equity Waterfall" sub="LP / GP promote structure"
          info={<>How profit is divided when you raise money from investors. Cash flows
            through it in order, each stage filling before the next gets anything. First
            everyone gets their capital back. Then the LP — your investors — earns a
            preferred return, typically 7 to 9% a year, before the sponsor sees profit.
            Above that, the split tilts toward the sponsor at each hurdle: that extra
            share is the promote, and it is how a sponsor gets paid for performance
            rather than for raising money. A common shape is 8% pref, then 80/20, then
            70/30 above a 15% LP IRR. Leave this off if you are buying with your own
            money — there is nobody to split with.</>}>
          <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.6,marginBottom:16}}>Splits levered cash flow between a limited partner and the sponsor. Return of capital and preferred return first, then tiered promote above each LP IRR hurdle.</p>
          <div style={G3} className="g3">
            <Fld label="LP Equity Share" suffix="%" hint="sponsor co-invests the rest" value={inp.lpSharePct!=null?inp.lpSharePct:90} onChange={v=>onChange({lpSharePct:pn(v)})}/>
            <Fld label="Preferred Return" suffix="%" hint="LP IRR before promote" value={inp.prefRate!=null?inp.prefRate:8} onChange={v=>onChange({prefRate:parseFloat(v)||0})}/>
            <div/>
            <Fld label="Hurdle 2 (LP IRR)" suffix="%" value={inp.hurdle2!=null?inp.hurdle2:12} onChange={v=>onChange({hurdle2:parseFloat(v)||0})}/>
            <Fld label="LP Share, Pref to H2" suffix="%" value={inp.lpTier2!=null?inp.lpTier2:80} onChange={v=>onChange({lpTier2:pn(v)})}/>
            <div/>
            <Fld label="Hurdle 3 (LP IRR)" suffix="%" value={inp.hurdle3!=null?inp.hurdle3:15} onChange={v=>onChange({hurdle3:parseFloat(v)||0})}/>
            <Fld label="LP Share, H2 to H3" suffix="%" value={inp.lpTier3!=null?inp.lpTier3:70} onChange={v=>onChange({lpTier3:pn(v)})}/>
            <Fld label="LP Share, Above H3" suffix="%" value={inp.lpTier4!=null?inp.lpTier4:60} onChange={v=>onChange({lpTier4:pn(v)})}/>
          </div>
        </Card>
      )}

      {t!=='affordable'&&inp.afterTax&&(
        <Card title="After-Tax Analysis" sub="Depreciation, recapture, capital gains"
          info={<>What you actually keep. The building — not the land under it — is
            written off over 27.5 years for residential or 39 for commercial, and that
            paper loss shelters real income, which is why real estate cash flow is
            taxed lightly. The catch comes at sale: the IRS takes back the depreciation
            you claimed at up to 25%, and taxes the gain on top. Land percentage is the
            share of price you assign to dirt; 20 to 30% is typical, and your county
            assessment is the usual evidence. These are estimates, not tax advice — an
            accountant should see the real numbers before you file.</>}>
          <div style={G3} className="g3">
            {!isDev&&<Fld label="Land (non-depreciable)" suffix="%" hint="of cost" value={inp.landPct!=null?inp.landPct:20} onChange={v=>onChange({landPct:pn(v)})}/>}
            <Fld label="Depreciation Period" suffix="yrs" hint="27.5 resi / 39 comm" value={inp.depYears!=null?inp.depYears:(t==='commercial'?39:27.5)} onChange={v=>onChange({depYears:parseFloat(v)||0})}/>
            <Fld label="Ordinary Tax Rate" suffix="%" value={inp.taxRate!=null?inp.taxRate:37} onChange={v=>onChange({taxRate:parseFloat(v)||0})}/>
            <Fld label="Capital Gains Rate" suffix="%" value={inp.capGainsRate!=null?inp.capGainsRate:20} onChange={v=>onChange({capGainsRate:parseFloat(v)||0})}/>
            <Fld label="Depr. Recapture Rate" suffix="%" value={inp.recaptureRate!=null?inp.recaptureRate:25} onChange={v=>onChange({recaptureRate:parseFloat(v)||0})}/>
          </div>
        </Card>
      )}

      {t!=='affordable'&&inp.refiEnabled&&(
        <Card title="Refinance / Cash-Out" sub="Mid-hold re-lever"
          info={<>Replacing the loan partway through the hold, usually after the rents
            have come up. The property is revalued at the refi cap rate, a new loan is
            written at the LTV you set, the old one is paid off, and whatever is left
            comes back to you — tax-free, because borrowing is not income. It is the
            engine behind the BRRRR strategy. The trade is a bigger payment against
            that cash, so watch what it does to DSCR: a cash-out that drops coverage
            below roughly 1.25x is a loan no lender will write.</>}>
          <div style={G3} className="g3">
            <Fld label="Refinance in Year" value={inp.refiYear!=null?inp.refiYear:3} onChange={v=>onChange({refiYear:pn(v)})}/>
            <Fld label="Refi LTV" suffix="%" value={inp.refiLTV!=null?inp.refiLTV:70} onChange={v=>onChange({refiLTV:pn(v)})}/>
            {inp.exitMethod!=='ppu'&&<Fld label="Refi Cap Rate" suffix="%" hint="values the property" value={inp.refiCapRate!=null?inp.refiCapRate:(inp.exitCapRate||5.5)} onChange={v=>onChange({refiCapRate:parseFloat(v)||0})}/>}
            <Fld label="New Interest Rate" suffix="%" value={inp.refiRate!=null?inp.refiRate:(inp.interestRate||6)} onChange={v=>onChange({refiRate:parseFloat(v)||0})}/>
            <Fld label="Refi Costs" suffix="%" hint="of new loan" value={inp.refiCostPct!=null?inp.refiCostPct:1} onChange={v=>onChange({refiCostPct:parseFloat(v)||0})}/>
          </div>
        </Card>
      )}

      {/* Calculated debt sizing, coverage, equity, and return metrics stay off
          the form. They appear together only after Generate Analysis. */}
    </div>
  );
}

export{Step4};
