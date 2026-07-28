import{f,pn}from'../engine/format.js';
import{monthlyPmt}from'../engine/finance.js';
import{getGPI,getOpEx,getDevCost}from'../engine/income.js';
import{buildPF}from'../engine/buildPF.js';
import{Fld,Slider,Card,Metric}from'./ui.jsx';
// ─── STEP 4 FINANCING ─────────────────────────────────────────────────────
const G2={display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'};
const G3={display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0 16px'};

function SizedDebtPreview({inp}){
  let ds=null; try{ds=buildPF(inp).debtSizing;}catch(e){}
  if(!ds)return null;
  return(
    <div style={{margin:'0 0 16px',padding:'14px 16px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)'}}>
      <div className="eyebrow" style={{marginBottom:10}}>Sizing test &mdash; loan is the lesser of</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {ds.constraints.map((c,i)=>(
          <div key={i} style={{flex:1,minWidth:130,padding:'10px 12px',borderRadius:'var(--r-md)',background:'none',border:'1px solid '+(c.binds?'var(--accent)':'var(--border)')}}>
            <div style={{fontSize:'var(--fs-2)',color:c.binds?'var(--on-dark-muted)':'var(--muted)'}}>{c.name} <span style={{opacity:.7}}>({c.basis})</span></div>
            <div className="mono" style={{fontSize:'var(--fs-6)',fontWeight:700,color:c.binds?'var(--accent)':'var(--text)',marginTop:3}}>{f.$(c.loan)}</div>
            {c.binds&&<div style={{fontSize:'var(--fs-1)',color:'var(--on-dark-accent)',fontWeight:700,letterSpacing:'.1em',marginTop:3}}>BINDING</div>}
          </div>
        ))}
      </div>
      <div style={{marginTop:12,fontSize:'var(--fs-4)',color:'var(--muted)'}}>Sized loan <span className="mono" style={{fontWeight:700,color:'var(--text)'}}>{f.$(ds.sizedLoan)}</span> &middot; {ds.binding} constraint binds</div>
    </div>
  );
}

function Step4({inp,onChange}){
  const pp=inp.purchasePrice||0;
  const la=inp.loanAmount||0;
  const ltv=pp>0?la/pp*100:0;
  const acqC=pp*(inp.acquisitionCostsPct||0)/100;
  const lf=la*(inp.loanFeesPct||0)/100;
  const t=inp.assetType.toLowerCase();
  const devCost=t==='development'?getDevCost(inp):0;
  const eq=(t==='development'?devCost:pp)+acqC+lf-la;
  const ds=monthlyPmt(la,(inp.interestRate||0)/100,inp.amortYears||30)*12;
  const noi=getGPI(inp)*(1-(inp.vacancyRate||0)/100)+(inp.otherIncome||0)-getOpEx(inp);
  const dscr=ds>0?noi/ds:null;
  const isDev=t==='development';
  const lev=isDev&&devCost>0?la/devCost*100:ltv;
  // Color marks an exception worth a second look — not every figure.
  const cells=[
    {label:isDev?'Loan-to-Cost':'Loan-to-Value',value:`${lev.toFixed(1)}%`,tone:lev>90?'neg':lev>80?'warn':null},
    {label:'Equity Required',value:f.$(eq)},
    {label:'Annual Debt Service',value:f.$(ds)},
    {label:'DSCR',value:dscr?`${dscr.toFixed(2)}x`:'—',tone:!dscr?null:dscr<1.2?'neg':dscr<1.4?'warn':null},
  ];
  return(
    <div className="fu">
      <div style={{marginBottom:18}}>
        <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>Financing &amp; Assumptions</h2>
        <p style={{color:'var(--muted)',fontSize:'var(--fs-5)',lineHeight:1.55}}>Debt structure, growth rates, and exit strategy. The summary at the bottom updates as you type.</p>
      </div>

      <Card title="Loan Terms" sub="Sizing, rate, and amortization">
        <label className={'tgl'+(inp.sizeDebt?' on':'')} style={{marginBottom:16}}>
          <input type="checkbox" checked={!!inp.sizeDebt} onChange={e=>onChange({sizeDebt:e.target.checked})} style={{width:16,height:16,accentColor:'var(--accent)'}}/>
          <span>Size the loan automatically &mdash; lesser of DSCR, {isDev?'LTC':'LTV'}, and debt yield</span>
        </label>
        {!inp.sizeDebt?(
          <div style={G2} className="g2">
            <Fld label="Loan Amount" prefix="$" value={inp.loanAmount} onChange={v=>onChange({loanAmount:pn(v)})}/>
            <div>
              <Fld label={isDev?'Loan-to-Cost':'Loan-to-Value'} suffix="%" hint="sets the loan amount" value={+lev.toFixed(1)} onChange={v=>onChange({loanAmount:Math.round((isDev?devCost:pp)*pn(v)/100)})}/>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:-8,marginBottom:16}}>
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
            <SizedDebtPreview inp={inp}/>
          </>
        )}
        <div style={G2} className="g2">
          <Fld label="Interest Rate" suffix="%" value={inp.interestRate} onChange={v=>onChange({interestRate:pn(v)})}/>
          <Fld label="Amortization" suffix="yrs" value={inp.amortYears} onChange={v=>onChange({amortYears:pn(v)})}/>
          <Fld label="Interest-Only Period" suffix="yrs" hint="0 = none" value={inp.ioPeriod} onChange={v=>onChange({ioPeriod:pn(v)})}/>
          <Fld label="Origination / Loan Fee" suffix="%" value={inp.loanFeesPct} onChange={v=>onChange({loanFeesPct:pn(v)})}/>
        </div>
      </Card>

      <Card title="Hold & Exit" sub="Growth, hold period, and exit pricing">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 28px'}} className="g2">
          <Slider label="Revenue Growth Rate" min={0} max={8} step={0.25} value={inp.revenueGrowth||3} onChange={v=>onChange({revenueGrowth:v})} fmt2={v=>`${v}% / yr`}/>
          <Slider label="Expense Growth Rate" min={0} max={8} step={0.25} value={inp.expenseGrowth||2.5} onChange={v=>onChange({expenseGrowth:v})} fmt2={v=>`${v}% / yr`}/>
          <Slider label="Holding Period" min={3} max={10} step={1} value={inp.holdingPeriod||7} onChange={v=>onChange({holdingPeriod:v})} fmt2={v=>`${v} yrs`}/>
          <Slider label="Exit Cap Rate" min={3.5} max={10} step={0.25} value={inp.exitCapRate||5.5} onChange={v=>onChange({exitCapRate:v})} fmt2={v=>`${v}%`}/>
          <Slider label="Selling Costs" min={1} max={6} step={0.25} value={inp.sellingCostsPct||3} onChange={v=>onChange({sellingCostsPct:v})} fmt2={v=>`${v}%`}/>
          <Slider label="Discount Rate (NPV)" min={4} max={15} step={0.25} value={inp.discountRate||8} onChange={v=>onChange({discountRate:v})} fmt2={v=>`${v}%`}/>
        </div>
      </Card>

      {t!=='affordable'?(<>
        <Card title="Equity Waterfall" sub="LP / GP promote structure">
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

        <Card title="After-Tax Analysis" sub="Optional">
          <label className={'tgl'+(inp.afterTax?' on':'')} style={{marginBottom:inp.afterTax?16:0}}>
            <input type="checkbox" checked={!!inp.afterTax} onChange={e=>onChange({afterTax:e.target.checked})} style={{width:16,height:16,accentColor:'var(--accent)'}}/>
            <span>Add after-tax analysis &mdash; depreciation shield, recapture, and capital gains</span>
          </label>
          {inp.afterTax&&<div style={G3} className="g3">
            {!isDev&&<Fld label="Land (non-depreciable)" suffix="%" hint="of cost" value={inp.landPct!=null?inp.landPct:20} onChange={v=>onChange({landPct:pn(v)})}/>}
            <Fld label="Depreciation Period" suffix="yrs" hint="27.5 resi / 39 comm" value={inp.depYears!=null?inp.depYears:(t==='commercial'?39:27.5)} onChange={v=>onChange({depYears:parseFloat(v)||0})}/>
            <Fld label="Ordinary Tax Rate" suffix="%" value={inp.taxRate!=null?inp.taxRate:37} onChange={v=>onChange({taxRate:parseFloat(v)||0})}/>
            <Fld label="Capital Gains Rate" suffix="%" value={inp.capGainsRate!=null?inp.capGainsRate:20} onChange={v=>onChange({capGainsRate:parseFloat(v)||0})}/>
            <Fld label="Depr. Recapture Rate" suffix="%" value={inp.recaptureRate!=null?inp.recaptureRate:25} onChange={v=>onChange({recaptureRate:parseFloat(v)||0})}/>
          </div>}
        </Card>

        <Card title="Refinance / Cash-Out" sub="Optional">
          <label className={'tgl'+(inp.refiEnabled?' on':'')} style={{marginBottom:inp.refiEnabled?16:0}}>
            <input type="checkbox" checked={!!inp.refiEnabled} onChange={e=>onChange({refiEnabled:e.target.checked})} style={{width:16,height:16,accentColor:'var(--accent)'}}/>
            <span>Model a mid-hold refinance &mdash; pull equity out and re-lever</span>
          </label>
          {inp.refiEnabled&&<div style={G3} className="g3">
            <Fld label="Refinance in Year" value={inp.refiYear!=null?inp.refiYear:3} onChange={v=>onChange({refiYear:pn(v)})}/>
            <Fld label="Refi LTV" suffix="%" value={inp.refiLTV!=null?inp.refiLTV:70} onChange={v=>onChange({refiLTV:pn(v)})}/>
            <Fld label="Refi Cap Rate" suffix="%" hint="values the property" value={inp.refiCapRate!=null?inp.refiCapRate:(inp.exitCapRate||5.5)} onChange={v=>onChange({refiCapRate:parseFloat(v)||0})}/>
            <Fld label="New Interest Rate" suffix="%" value={inp.refiRate!=null?inp.refiRate:(inp.interestRate||6)} onChange={v=>onChange({refiRate:parseFloat(v)||0})}/>
            <Fld label="Refi Costs" suffix="%" hint="of new loan" value={inp.refiCostPct!=null?inp.refiCostPct:1} onChange={v=>onChange({refiCostPct:parseFloat(v)||0})}/>
          </div>}
        </Card>
      </>):(
        <Card title="Partnership Economics">
          <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.65}}>The LP/GP promote waterfall is not applied to affordable / LIHTC deals. Tax-credit partnership economics are driven by credit delivery, and are shown in the LIHTC analysis instead.</p>
        </Card>
      )}

      {/* summary sits after the inputs so people aren't reading numbers
          before they've entered anything */}
      <div className="eyebrow" style={{marginBottom:9,marginTop:24}}>Financing summary</div>
      <div className="hair g4" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {cells.map(c=><Metric key={c.label} {...c}/>)}
      </div>
      {isDev&&(
        <div style={{display:'flex',gap:28,flexWrap:'wrap',alignItems:'baseline',background:'var(--warn-tint)',border:'1px solid var(--warn-brd)',borderRadius:'var(--r-md)',padding:'12px 16px',marginTop:14}}>
          <div>
            <span style={{color:'var(--muted)',fontSize:'var(--fs-4)'}}>Total Development Cost&nbsp;&nbsp;</span>
            <span className="mono" style={{fontWeight:700,fontSize:'var(--fs-5)',color:'var(--text)'}}>{f.$f(devCost)}</span>
          </div>
          <div>
            <span style={{color:'var(--muted)',fontSize:'var(--fs-4)'}}>Return on Cost (Yr 1)&nbsp;&nbsp;</span>
            <span className="mono" style={{fontWeight:700,fontSize:'var(--fs-5)',color:'var(--text)'}}>{devCost>0?f.pct(noi/devCost,2):'—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export{Step4};
