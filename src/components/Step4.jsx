import{f,pn}from'../engine/format.js';
import{monthlyPmt}from'../engine/finance.js';
import{getGPI,getOpEx,getDevCost}from'../engine/income.js';
import{buildPF}from'../engine/buildPF.js';
import{Fld,Slider,SecHdr}from'./ui.jsx';
// ─── STEP 4 FINANCING ─────────────────────────────────────────────────────
function SizedDebtPreview({inp}){
  let ds=null; try{ds=buildPF(inp).debtSizing;}catch(e){}
  if(!ds)return null;
  return(
    <div style={{margin:'4px 0 8px',padding:'14px 16px',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:9}}>
      <div style={{fontSize:11,fontWeight:700,color:'var(--muted)',letterSpacing:'.5px',marginBottom:10}}>SIZING TEST &mdash; LOAN IS THE LESSER OF</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {ds.constraints.map((c,i)=>(
          <div key={i} style={{flex:1,minWidth:120,padding:'10px 12px',borderRadius:8,background:c.binds?'var(--ink)':'var(--surface)',border:'1px solid '+(c.binds?'var(--ink)':'var(--border)')}}>
            <div style={{fontSize:11,color:c.binds?'#aab3c9':'var(--muted)'}}>{c.name} <span style={{opacity:.7}}>({c.basis})</span></div>
            <div className="mono" style={{fontSize:14.5,fontWeight:700,color:c.binds?'#fff':'var(--text)',marginTop:2}}>{f.$(c.loan)}</div>
            {c.binds&&<div style={{fontSize:9.5,color:'#7d93ff',fontWeight:700,letterSpacing:'.5px',marginTop:2}}>BINDING</div>}
          </div>
        ))}
      </div>
      <div style={{marginTop:10,fontSize:13,color:'var(--muted)'}}>Sized loan: <span className="mono" style={{fontWeight:700,color:'var(--accent)'}}>{f.$(ds.sizedLoan)}</span> &middot; {ds.binding} constraint binds</div>
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
  return(
    <div className="fu">
      <h2 style={{fontSize:22,fontWeight:800,marginBottom:6}}>Financing & Assumptions</h2>
      <p style={{color:'#737373',marginBottom:20,fontSize:14}}>Debt structure, growth rates, and exit strategy</p>
      <div className="glass g4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',marginBottom:24,overflow:'hidden'}}>
        {[
          {l:t==='development'?'LTC':'LTV',v:`${(t==='development'&&devCost>0?la/devCost*100:ltv).toFixed(1)}%`,c:(t==='development'&&devCost>0?la/devCost*100:ltv)>90?'#b42318':(t==='development'&&devCost>0?la/devCost*100:ltv)>80?'#9a6700':'#1a7f37'},
          {l:'Equity Required',v:f.$(eq),c:'#3a5bf0'},
          {l:'Ann. Debt Service',v:f.$(ds),c:'#56687a'},
          {l:'DSCR',v:dscr?`${dscr.toFixed(2)}x`:'—',c:!dscr?'#666666':dscr<1.2?'#b42318':dscr<1.4?'#9a6700':'#1a7f37'},
        ].map(i=>(
          <div key={i.l} style={{padding:'12px 14px',textAlign:'center',borderRight:'1px solid #ececec'}}>
            <div style={{fontSize:17,fontWeight:800,color:i.c}}>{i.v}</div>
            <div style={{fontSize:11,color:'#737373',marginTop:3}}>{i.l}</div>
          </div>
        ))}
      </div>
      {t==='development'&&(
        <div style={{background:'#fff8eb',border:'1px solid rgba(245,158,11,.2)',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13}}>
          <span style={{color:'#5f5f5f'}}>Total Development Cost: </span>
          <span style={{fontWeight:800,color:'#9a6700'}}>{f.$f(devCost)}</span>
          <span style={{color:'#666666',marginLeft:16}}>Return on Cost (Y1): </span>
          <span style={{fontWeight:700,color:'#9a6700'}}>{devCost>0?f.pct(noi/devCost,2):'—'}</span>
        </div>
      )}
      <SecHdr>Loan Terms</SecHdr>
      <label style={{display:'flex',alignItems:'center',gap:11,cursor:'pointer',marginBottom:16,padding:'12px 15px',background:inp.sizeDebt?'var(--accent-tint)':'var(--surface2)',border:'1px solid '+(inp.sizeDebt?'#c9d4fb':'var(--border)'),borderRadius:9}}>
        <input type="checkbox" checked={!!inp.sizeDebt} onChange={e=>onChange({sizeDebt:e.target.checked})} style={{width:16,height:16,accentColor:'var(--accent)'}}/>
        <span style={{fontSize:13.5,fontWeight:600}}>Size the loan automatically &mdash; lesser of DSCR, {t==='development'?'LTC':'LTV'}, and debt yield</span>
      </label>
      {!inp.sizeDebt?(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}} className="g2">
          <Fld label="Loan Amount" prefix="$" value={inp.loanAmount} onChange={v=>onChange({loanAmount:pn(v)})}/>
          <div>
            <Fld label={t==='development'?'Loan-to-Cost':'Loan-to-Value'} suffix="%" hint="type any value, sets loan amount" value={+((t==='development'&&devCost>0?la/devCost*100:ltv)).toFixed(1)} onChange={v=>onChange({loanAmount:Math.round((t==='development'?devCost:pp)*pn(v)/100)})}/>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:-6,marginBottom:14}}>
              {[50,60,65,70,75,80,85,90].map(p=>(
                <button key={p} className="btn-s" style={{padding:'4px 10px',fontSize:12}} onClick={()=>onChange({loanAmount:Math.round((t==='development'?devCost:pp)*p/100)})}>{p}%</button>
              ))}
            </div>
          </div>
        </div>
      ):(
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}} className="g3">
            <Fld label="Min DSCR" hint="stabilized coverage" value={inp.minDSCR} onChange={v=>onChange({minDSCR:parseFloat(v)||0})}/>
            <Fld label={t==='development'?'Max LTC':'Max LTV'} suffix="%" value={t==='development'?inp.maxLTC:inp.maxLTV} onChange={v=>onChange(t==='development'?{maxLTC:pn(v)}:{maxLTV:pn(v)})}/>
            <Fld label="Min Debt Yield" suffix="%" value={inp.minDebtYield} onChange={v=>onChange({minDebtYield:parseFloat(v)||0})}/>
          </div>
          <SizedDebtPreview inp={inp}/>
        </>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:14}} className="g2">
        <Fld label="Interest Rate" suffix="%" value={inp.interestRate} onChange={v=>onChange({interestRate:pn(v)})}/>
        <Fld label="Amortization" suffix="yrs" value={inp.amortYears} onChange={v=>onChange({amortYears:pn(v)})}/>
        <Fld label="Interest-Only Period" suffix="yrs" hint="0 = none" value={inp.ioPeriod} onChange={v=>onChange({ioPeriod:pn(v)})}/>
        <Fld label="Origination / Loan Fee" suffix="%" value={inp.loanFeesPct} onChange={v=>onChange({loanFeesPct:pn(v)})}/>
      </div>
      <SecHdr>Hold & Exit Assumptions</SecHdr>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}} className="g2">
        <Slider label="Revenue Growth Rate" min={0} max={8} step={0.25} value={inp.revenueGrowth||3} onChange={v=>onChange({revenueGrowth:v})} fmt2={v=>`${v}% / yr`}/>
        <Slider label="Expense Growth Rate" min={0} max={8} step={0.25} value={inp.expenseGrowth||2.5} onChange={v=>onChange({expenseGrowth:v})} fmt2={v=>`${v}% / yr`}/>
        <Slider label="Holding Period" min={3} max={10} step={1} value={inp.holdingPeriod||7} onChange={v=>onChange({holdingPeriod:v})} fmt2={v=>`${v} yrs`}/>
        <Slider label="Exit Cap Rate" min={3.5} max={10} step={0.25} value={inp.exitCapRate||5.5} onChange={v=>onChange({exitCapRate:v})} fmt2={v=>`${v}%`}/>
        <Slider label="Selling Costs" min={1} max={6} step={0.25} value={inp.sellingCostsPct||3} onChange={v=>onChange({sellingCostsPct:v})} fmt2={v=>`${v}%`}/>
        <Slider label="Discount Rate (NPV)" min={4} max={15} step={0.25} value={inp.discountRate||8} onChange={v=>onChange({discountRate:v})} fmt2={v=>`${v}%`}/>
      </div>

      {t!=='affordable'?(<>
        <SecHdr>Equity Waterfall (LP / GP Promote)</SecHdr>
        <p style={{fontSize:12.5,color:'#737373',marginTop:-6,marginBottom:14}}>Splits the levered cash flow between a limited partner and the sponsor. Return of capital and preferred return first, then tiered promote above each LP IRR hurdle.</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}} className="g3">
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

        <SecHdr>After-Tax Analysis</SecHdr>
        <label style={{display:'flex',alignItems:'center',gap:11,cursor:'pointer',marginBottom:14,padding:'12px 15px',background:inp.afterTax?'var(--accent-tint)':'var(--surface2)',border:'1px solid '+(inp.afterTax?'#c9d4fb':'var(--border)'),borderRadius:9}}>
          <input type="checkbox" checked={!!inp.afterTax} onChange={e=>onChange({afterTax:e.target.checked})} style={{width:16,height:16,accentColor:'var(--accent)'}}/>
          <span style={{fontSize:13.5,fontWeight:600}}>Add after-tax analysis &mdash; depreciation shield, recapture, and capital gains</span>
        </label>
        {inp.afterTax&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}} className="g3">
          {t!=='development'&&<Fld label="Land (non-depreciable)" suffix="%" hint="% of cost" value={inp.landPct!=null?inp.landPct:20} onChange={v=>onChange({landPct:pn(v)})}/>}
          <Fld label="Depreciation Period" suffix="yrs" hint="27.5 resi / 39 comm" value={inp.depYears!=null?inp.depYears:(t==='commercial'?39:27.5)} onChange={v=>onChange({depYears:parseFloat(v)||0})}/>
          <Fld label="Ordinary Tax Rate" suffix="%" value={inp.taxRate!=null?inp.taxRate:37} onChange={v=>onChange({taxRate:parseFloat(v)||0})}/>
          <Fld label="Capital Gains Rate" suffix="%" value={inp.capGainsRate!=null?inp.capGainsRate:20} onChange={v=>onChange({capGainsRate:parseFloat(v)||0})}/>
          <Fld label="Depr. Recapture Rate" suffix="%" value={inp.recaptureRate!=null?inp.recaptureRate:25} onChange={v=>onChange({recaptureRate:parseFloat(v)||0})}/>
        </div>}

        <SecHdr>Refinance / Cash-Out</SecHdr>
        <label style={{display:'flex',alignItems:'center',gap:11,cursor:'pointer',marginBottom:14,padding:'12px 15px',background:inp.refiEnabled?'var(--accent-tint)':'var(--surface2)',border:'1px solid '+(inp.refiEnabled?'#c9d4fb':'var(--border)'),borderRadius:9}}>
          <input type="checkbox" checked={!!inp.refiEnabled} onChange={e=>onChange({refiEnabled:e.target.checked})} style={{width:16,height:16,accentColor:'var(--accent)'}}/>
          <span style={{fontSize:13.5,fontWeight:600}}>Model a mid-hold refinance &mdash; pull equity out and re-lever</span>
        </label>
        {inp.refiEnabled&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}} className="g3">
          <Fld label="Refinance in Year" value={inp.refiYear!=null?inp.refiYear:3} onChange={v=>onChange({refiYear:pn(v)})}/>
          <Fld label="Refi LTV" suffix="%" value={inp.refiLTV!=null?inp.refiLTV:70} onChange={v=>onChange({refiLTV:pn(v)})}/>
          <Fld label="Refi Cap Rate" suffix="%" hint="values the property" value={inp.refiCapRate!=null?inp.refiCapRate:(inp.exitCapRate||5.5)} onChange={v=>onChange({refiCapRate:parseFloat(v)||0})}/>
          <Fld label="New Interest Rate" suffix="%" value={inp.refiRate!=null?inp.refiRate:(inp.interestRate||6)} onChange={v=>onChange({refiRate:parseFloat(v)||0})}/>
          <Fld label="Refi Costs" suffix="%" hint="% of new loan" value={inp.refiCostPct!=null?inp.refiCostPct:1} onChange={v=>onChange({refiCostPct:parseFloat(v)||0})}/>
        </div>}
      </>):(
        <div style={{marginTop:18,padding:'14px 16px',background:'#f4f0f8',border:'1px solid #e0d8ec',borderRadius:4,fontSize:13,color:'#7a5195'}}>
          The LP/GP promote waterfall is not applied to affordable / LIHTC deals. Tax-credit partnership economics are driven by credit delivery and are shown in the LIHTC analysis instead.
        </div>
      )}
    </div>
  );
}

export{Step4};
