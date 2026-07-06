import{useState}from'react';
import{Bar,Line,LineChart,ComposedChart,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer}from'recharts';
import{f}from'../engine/format.js';
import{buildPF}from'../engine/buildPF.js';
import{calcWaterfall}from'../engine/waterfall.js';
import{calcAfterTax}from'../engine/afterTax.js';
import{calcProjectTimeline}from'../engine/timeline.js';
import{calcRefinance}from'../engine/refinance.js';
import{calcScenarios}from'../engine/scenarios.js';
import{calcDevCredits}from'../engine/devCredits.js';
import{openMemo,downloadMemo}from'../engine/memo.js';
import{Chip}from'./ui.jsx';
// ─── RESULTS CHARTS ────────────────────────────────────────────────────────
function ChartTip({active,payload,label}){
  if(!active||!payload||!payload.length)return null;
  return(
    <div style={{background:'#ffffff',border:'1px solid #e0e0e0',borderRadius:9,padding:'10px 14px'}}>
      <p style={{fontWeight:700,marginBottom:6,color:'#191919',fontSize:13}}>{label}</p>
      {payload.map(p=>(
        <p key={p.name} style={{color:p.color,fontSize:12.5,marginBottom:2}}>
          {p.name}: {typeof p.value==='number'?(/rate|return|coc/i.test(p.name)?`${p.value.toFixed(2)}%`:f.$(p.value,false)):p.value}
        </p>
      ))}
    </div>
  );
}

// ─── PROFORMA TABLE ────────────────────────────────────────────────────────
function PFTable({rows,hp}){
  const visible=rows.slice(0,hp);
  const defs=[
    {l:'Gross Potential Income',k:'gpi',fmt:f.$f,type:'income'},
    {l:'  Less: Vacancy Loss',k:'vacL',fmt:v=>`(${f.$f(v)})`,type:'deduct'},
    {l:'Effective Gross Income',k:'egi',fmt:f.$f,type:'sub'},
    {l:'  Less: Operating Expenses',k:'opex',fmt:v=>`(${f.$f(v)})`,type:'deduct'},
    {l:'Net Operating Income',k:'noi',fmt:f.$f,type:'hl'},
    {l:'  Less: Debt Service',k:'ds',fmt:v=>`(${f.$f(v)})`,type:'deduct'},
    {l:'Cash Flow Before Tax',k:'cfbt',fmt:f.$f,type:'hl'},
    {l:'RATIOS & METRICS',k:null,type:'sec'},
    {l:'Cap Rate',k:'capR',fmt:v=>f.pct(v,2),type:'metric'},
    {l:'Cash-on-Cash Return',k:'coc',fmt:v=>f.pct(v,2),type:'metric'},
    {l:'DSCR',k:'dscr',fmt:v=>v?`${v.toFixed(2)}x`:'N/A',type:'metric'},
    {l:'Expense Ratio',k:'expR',fmt:v=>f.pct(v,1),type:'metric'},
    {l:'Loan Balance (EOY)',k:'bal',fmt:f.$f,type:'metric'},
  ];
  return(
    <div style={{overflowX:'auto'}}>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{textAlign:'left',minWidth:190}}>Line Item</th>
            {visible.map(r=><th key={r.yr}>Year {r.yr}</th>)}
          </tr>
        </thead>
        <tbody>
          {defs.map((d,i)=>{
            if(d.type==='sec')return(
              <tr key={i} className="sec"><td colSpan={visible.length+1}>{d.l}</td></tr>
            );
            return(
              <tr key={i} className={d.type==='hl'?'sub':''}>
                <td>{d.l}</td>
                {visible.map(r=>{
                  const v=d.k?r[d.k]:null;
                  const str=v!=null?d.fmt(v):'—';
                  const isPos=d.k==='cfbt'&&v>0;
                  const isNeg=d.k==='cfbt'&&v<0;
                  return<td key={r.yr} className={isPos?'pos':isNeg?'neg':''}>{str}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── SENSITIVITY TABLE ─────────────────────────────────────────────────────
function SensTable({inp}){
  const [caps,setCaps]=useState([4.5,5.0,5.5,6.0,6.5,7.0]);
  const [growths,setGrowths]=useState([1,2,3,4,5]);
  const getIRR=(rg,ec)=>buildPF({...inp,revenueGrowth:rg,exitCapRate:ec}).ret.irr;
  const setCap=(i,v)=>setCaps(caps.map((c,j)=>j===i?(parseFloat(v)||0):c));
  const setGr=(i,v)=>setGrowths(growths.map((g,j)=>j===i?(parseFloat(v)||0):g));
  const axIn={width:'100%',border:'none',background:'transparent',color:'#fff',fontWeight:700,fontSize:12,textAlign:'center',outline:'none',fontFamily:'inherit'};
  const axInL={width:46,border:'1px solid #c7c5c0',borderRadius:3,background:'#fff',color:'#1f3864',fontWeight:700,fontSize:12,textAlign:'center',outline:'none',fontFamily:'inherit',padding:'3px 2px'};
  return(
    <div>
      <div className="sect-lbl" style={{marginBottom:6}}>Levered IRR Sensitivity</div>
      <p style={{fontSize:12,color:'#737373',marginBottom:6}}>Each cell is the deal's levered IRR at that revenue growth and exit cap. Edit any axis value below and the grid recalculates live. All other inputs held constant.</p>
      <p style={{fontSize:12,color:'#737373',marginBottom:14}}><span style={{color:'#1a7f37'}}>&#9632; &gt;15%</span>  <span style={{color:'#9a6700',marginLeft:8}}>&#9632; 10-15%</span>  <span style={{color:'#b42318',marginLeft:8}}>&#9632; &lt;10%</span></p>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
        <span style={{fontSize:11,fontWeight:700,color:'#8c8c8c',letterSpacing:'.5px'}}>EXIT CAP RATE &rarr; (columns, editable)</span>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="tbl">
          <thead><tr>
            <th style={{textAlign:'left',minWidth:140}}>Revenue Growth &darr;<br/><span style={{fontWeight:400,color:'#8c9bb5'}}>vs. Exit Cap &rarr;</span></th>
            {caps.map((c,i)=><th key={i}><input value={c} onChange={e=>setCap(i,e.target.value)} style={axIn} inputMode="decimal"/></th>)}
          </tr></thead>
          <tbody>{growths.map((g,gi)=>(
            <tr key={gi}>
              <td style={{fontWeight:700,color:'#5f5f5f'}}>
                <input value={g} onChange={e=>setGr(gi,e.target.value)} style={axInL} inputMode="decimal"/> <span style={{color:'#8c8c8c'}}>% / yr</span>
              </td>
              {caps.map((c,ci)=>{
                const irr=getIRR(g,c);
                const col=irr>0.15?'#1a7f37':irr>0.10?'#9a6700':'#b42318';
                const bg=irr>0.15?'#e6f4ea':irr>0.10?'#fbf3da':'#fdecea';
                return<td key={ci} style={{background:bg,color:col,fontWeight:700,textAlign:'center',borderRadius:3}}>{f.pct(irr,1)}</td>;
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ANALYST NOTES (auto-generated) ───────────────────────────────────────
function analystNotes(res,inp){
  const{rows,ret,sum,exit,equity}=res;
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const notes=[];
  notes.push(`This deal projects a ${f.pct(ret.irr,1)} levered IRR and a ${f.x(ret.em)} equity multiple over a ${hp}-year hold, returning ${f.$f(ret.totalCF+exit.proceeds)} on ${f.$f(equity)} of invested equity.`);
  if(sum.dscr!=null){
    if(sum.dscr<1.20)notes.push(`Year 1 DSCR of ${sum.dscr.toFixed(2)}x is below the 1.20x to 1.25x minimum most lenders require. As structured, this loan amount is unlikely to be financeable without more income or less leverage.`);
    else if(sum.dscr<1.40)notes.push(`Year 1 DSCR of ${sum.dscr.toFixed(2)}x clears typical lender minimums but leaves a thin cushion. A modest income shortfall or expense overrun would pressure coverage.`);
    else notes.push(`Year 1 DSCR of ${sum.dscr.toFixed(2)}x provides healthy debt coverage with room to absorb underperformance.`);
  }
  const totalRet=ret.totalCF+exit.proceeds;
  if(totalRet>0){
    const saleShare=exit.proceeds/totalRet;
    if(saleShare>0.7)notes.push(`${f.pct(saleShare,0)} of total capital returned comes from the exit sale, so the headline IRR is highly sensitive to the ${inp.exitCapRate}% exit cap assumption. Review the sensitivity table before relying on it.`);
    else if(saleShare>0)notes.push(`Returns are reasonably balanced between operating cash flow (${f.pct(1-saleShare,0)}) and exit proceeds (${f.pct(saleShare,0)}), which reduces dependence on the exit cap assumption.`);
  }
  const occCushion=1-sum.beOcc-(inp.vacancyRate||0)/100;
  if(sum.beOcc>0){
    if(occCushion<0.05)notes.push(`Break-even occupancy of ${f.pct(sum.beOcc,1)} leaves very little margin versus the ${inp.vacancyRate}% vacancy assumption. Small leasing setbacks would turn cash flow negative.`);
    else notes.push(`Break-even occupancy of ${f.pct(sum.beOcc,1)} leaves a comfortable cushion against the underwritten ${inp.vacancyRate}% vacancy.`);
  }
  const y1=rows[0];
  if(y1&&y1.expR>0.55)notes.push(`A ${f.pct(y1.expR,0)} expense ratio is high for this profile. Verify the tax, insurance, and maintenance inputs reflect actuals rather than placeholders.`);
  return notes;
}

// ─── RESULTS DASHBOARD ────────────────────────────────────────────────────
function DevCreditsPanel({D}){
  if(!D)return null;
  const PUR='#7a5195';
  const su=(label,val,bold)=>(
    <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #ececec',fontSize:13.5}}>
      <span style={{color:bold?'var(--text)':'var(--muted)',fontWeight:bold?700:400}}>{label}</span>
      <span className="mono" style={{fontWeight:bold?800:600}}>{val}</span>
    </div>
  );
  return(
    <div className="glass" style={{padding:'22px 24px',marginBottom:22,borderTop:'3px solid '+PUR}}>
      <div className="sect-lbl" style={{color:PUR}}>Tax Credit Equity</div>
      <div style={{overflow:'hidden',borderRadius:8,border:'1px solid var(--border)',marginBottom:16}}>
        <table className="tbl">
          <thead><tr><th style={{textAlign:'left'}}>Credit</th><th>Eligible Basis</th><th>Rate</th><th>Price</th><th>Credit</th><th>Equity</th></tr></thead>
          <tbody>
            {D.rows.map((r,i)=>(
              <tr key={i}>
                <td style={{fontWeight:600,color:'var(--text)'}}>{r.type}</td>
                <td>{f.$(r.basis)}</td><td>{r.ratePct.toFixed(0)}%</td><td>{'$'+r.price.toFixed(2)}</td>
                <td>{f.$(r.credit)}</td><td style={{fontWeight:700,color:PUR}}>{f.$(r.equity)}</td>
              </tr>
            ))}
            <tr className="sub"><td>Total credit equity</td><td colSpan={4}></td><td style={{fontWeight:800,color:PUR}}>{f.$(D.totalEquity)}</td></tr>
          </tbody>
        </table>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}} className="g2">
        <div>
          <div style={{fontSize:11,fontWeight:700,color:PUR,letterSpacing:'.5px',marginBottom:6}}>SOURCES &amp; USES</div>
          {su('Total development cost',f.$(D.uses),true)}
          {su('Permanent loan',f.$(D.loan))}
          {D.isAff&&su('LIHTC equity',f.$(D.lihtcEq))}
          {D.isAff&&D.softSources>0&&su('Soft sources',f.$(D.softSources))}
          {D.isAff&&D.deferredFee>0&&su('Deferred developer fee',f.$(D.deferredFee))}
          {su('Tax credit equity (these)',f.$(D.totalEquity))}
          {su('Sponsor equity required',f.$(D.sponsorEquityAfter),true)}
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:PUR,letterSpacing:'.5px',marginBottom:6}}>IMPACT</div>
          {su('Sponsor equity before credits',f.$(D.sponsorEquityBefore))}
          {su('Covered by credit equity',f.$(Math.min(D.totalEquity,D.sponsorEquityBefore)))}
          {su('Credit equity as % of cost',D.uses>0?(D.totalEquity/D.uses*100).toFixed(1)+'%':'0%')}
          {!D.isAff&&D.sponsorIRR!=null&&su('Sponsor IRR with credits',f.pct(D.sponsorIRR,1),true)}
          {!D.isAff&&D.baseIRR!=null&&su('Levered IRR before credits',f.pct(D.baseIRR,1))}
        </div>
      </div>
      <p style={{fontSize:12,color:'var(--muted)',marginTop:14,lineHeight:1.5}}>Each credit is computed on its own basis, rate, and syndication price, then stacked as a source against development cost. {D.isAff?'These stack on top of the LIHTC equity from the affordable module.':'The sponsor IRR with credits assumes the sponsor retains operating cash flow while credit investors take the credits; it is indicative.'}</p>
    </div>
  );
}

function ScenarioPanel({S}){
  if(!S||!S.base)return null;
  const cols=[['Downside',S.downside,'#b42318'],['Base',S.base,'var(--accent)'],['Upside',S.upside,'#0e7c5a']];
  const row=(label,fn)=>(
    <tr>
      <td style={{fontWeight:600,color:'var(--muted)'}}>{label}</td>
      {cols.map((c,i)=><td key={i} style={{textAlign:'right',fontWeight:700}}>{c[1]?fn(c[1]):'n/a'}</td>)}
    </tr>
  );
  return(
    <div className="glass" style={{padding:'22px 24px',marginBottom:22,borderTop:'3px solid var(--accent)'}}>
      <div className="sect-lbl">Scenario Analysis</div>
      <div style={{overflow:'hidden',borderRadius:8,border:'1px solid var(--border)'}}>
        <table className="tbl">
          <thead><tr>
            <th style={{textAlign:'left'}}>Metric</th>
            {cols.map((c,i)=><th key={i} style={{textAlign:'right',color:c[2]}}>{c[0]}</th>)}
          </tr></thead>
          <tbody>
            {row('Levered IRR',d=>f.pct(d.irr,1))}
            {row('Equity Multiple',d=>f.x(d.em))}
            {row('Year 1 DSCR',d=>d.dscr?d.dscr.toFixed(2)+'x':'n/a')}
            {row('Year 1 Cash-on-Cash',d=>f.pct(d.coc,1))}
            {row('Net Sale Proceeds',d=>f.$(d.proceeds))}
            <tr className="sec"><td colSpan={4}>assumptions</td></tr>
            {row('Revenue Growth',d=>d.g.toFixed(1)+'%')}
            {row('Exit Cap Rate',d=>d.c.toFixed(2)+'%')}
            {row('Vacancy',d=>d.v.toFixed(1)+'%')}
          </tbody>
        </table>
      </div>
      <p style={{fontSize:12,color:'var(--muted)',marginTop:12,lineHeight:1.5}}>Downside and upside flex rent growth by &plusmn;{S.deltas.g}pt, exit cap by &plusmn;{S.deltas.c}pt, and vacancy by &plusmn;{S.deltas.v}pt around your base case, recomputed end to end.</p>
    </div>
  );
}

function RefinancePanel({R}){
  if(!R)return null;
  const C='#0e7c5a';
  const lift=R.refiIRR-R.baseIRR;
  return(
    <div className="glass" style={{padding:'22px 24px',marginBottom:22,borderTop:'3px solid '+C}}>
      <div className="sect-lbl" style={{color:C}}>Refinance &amp; Cash-Out (Year {R.refiYear})</div>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:16}}>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>Cash Out to Equity</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:R.cashOut>=0?C:'var(--neg)'}}>{f.$(R.cashOut)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>year {R.refiYear} distribution</div>
        </div>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>IRR with Refi</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:C}}>{f.pct(R.refiIRR,1)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>base {f.pct(R.baseIRR,1)}</div>
        </div>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>IRR Impact</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:lift>=0?C:'var(--warn)'}}>{lift>=0?'+':''}{f.pct(lift,1)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>multiple {f.x(R.refiEM)} vs {f.x(R.baseEM)}</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}} className="g2">
        <div>
          {[['Refinanced value',f.$(R.value)],['New loan',f.$(R.newLoan)],['Old loan retired',f.$(R.oldBal)]].map((r,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #ececec',fontSize:13}}>
              <span style={{color:'var(--muted)'}}>{r[0]}</span><span className="mono" style={{fontWeight:600}}>{r[1]}</span>
            </div>
          ))}
        </div>
        <div>
          {[['Refi costs',f.$(R.refiCosts)],['New debt service',f.$(R.newDS)],['DSCR at refi',R.refiDSCR?R.refiDSCR.toFixed(2)+'x':'n/a']].map((r,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #ececec',fontSize:13}}>
              <span style={{color:'var(--muted)'}}>{r[0]}</span><span className="mono" style={{fontWeight:600}}>{r[1]}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{fontSize:12,color:'var(--muted)',marginTop:14,lineHeight:1.5}}>The property is valued at a {((R.newLoan/(R.value||1))*100).toFixed(0)}% LTV refinance in year {R.refiYear}, returning {f.$(R.cashOut)} of tax-free proceeds to equity. The remaining hold runs on the new loan, and exit proceeds reflect its payoff.</p>
    </div>
  );
}

function ProjectTimelinePanel({P}){
  if(!P)return null;
  const C='#b54708';
  const drag=P.stabilizedIRR-P.projectIRR;
  return(
    <div className="glass" style={{padding:'22px 24px',marginBottom:22,borderTop:'3px solid '+C}}>
      <div className="sect-lbl" style={{color:C}}>Construction &amp; Lease-Up Timeline</div>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:16}}>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>Project IRR</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:C}}>{f.pct(P.projectIRR,1)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>includes build + lease-up</div>
        </div>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>Stabilized IRR</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:'var(--muted)'}}>{f.pct(P.stabilizedIRR,1)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>operations only</div>
        </div>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>Timing Drag</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:'var(--warn)'}}>{f.pct(drag,1)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>cost of the build</div>
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <div style={{flex:P.constructionMonths||1,padding:'8px 10px',background:'#fbeee0',borderRadius:'6px 0 0 6px',textAlign:'center'}}>
          <div className="mono" style={{fontSize:13,fontWeight:700,color:C}}>{P.constructionMonths}mo</div>
          <div style={{fontSize:10,color:'var(--muted)'}}>Construction</div>
        </div>
        <div style={{flex:P.leaseUpMonths||1,padding:'8px 10px',background:'#fdf6e3',textAlign:'center'}}>
          <div className="mono" style={{fontSize:13,fontWeight:700,color:'#9a6700'}}>{P.leaseUpMonths}mo</div>
          <div style={{fontSize:10,color:'var(--muted)'}}>Lease-Up</div>
        </div>
        <div style={{flex:6,padding:'8px 10px',background:'#e6f4ea',borderRadius:'0 6px 6px 0',textAlign:'center'}}>
          <div className="mono" style={{fontSize:13,fontWeight:700,color:'#1a7f37'}}>Stabilized Hold &rarr; Exit</div>
          <div style={{fontSize:10,color:'var(--muted)'}}>{Math.round(P.totalMonths/12*10)/10} yrs total</div>
        </div>
      </div>
      {P.constructionLoan>0&&<div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:12}}>
        <div style={{flex:1,minWidth:140,padding:'11px 14px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>Capitalized Interest</div>
          <div className="mono" style={{fontSize:15,fontWeight:700,color:C}}>{f.$(P.capInterest)}</div>
          <div style={{fontSize:10,color:'var(--muted2)',marginTop:1}}>{P.drawPattern==='scurve'?'S-curve':'straight-line'} draws, exact monthly accrual</div>
        </div>
        <div style={{flex:1,minWidth:140,padding:'11px 14px',background:'var(--surface2)',borderRadius:8,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>Peak Loan Draw</div>
          <div className="mono" style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{f.$(P.peakDrawBalance)}</div>
          <div style={{fontSize:10,color:'var(--muted2)',marginTop:1}}>on a {f.$(P.constructionLoan)} construction loan</div>
        </div>
      </div>}
      <p style={{fontSize:12,color:'var(--muted)',lineHeight:1.5}}>The project IRR holds equity through {P.constructionMonths} months of construction with no income, ramps revenue over a {P.leaseUpMonths}-month lease-up, and capitalizes {f.$(P.capInterest)} of construction-period interest{P.constructionLoan>0?' computed month-by-month on the actual outstanding draw balance':''}. This is the honest return; the stabilized IRR above assumes operations begin on day one.</p>
    </div>
  );
}

function AfterTaxPanel({A}){
  if(!A)return null;
  const G='#0e7c5a';
  const drop=A.preTaxIRR-A.atIRR;
  return(
    <div className="glass" style={{padding:'22px 24px',marginBottom:22,borderTop:'3px solid '+G}}>
      <div className="sect-lbl" style={{color:G}}>After-Tax Returns</div>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:16}}>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>After-Tax IRR</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:G}}>{f.pct(A.atIRR,1)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>pre-tax {f.pct(A.preTaxIRR,1)}</div>
        </div>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>After-Tax Multiple</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:'var(--text)'}}>{f.x(A.atEM)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>pre-tax {f.x(A.preTaxEM)}</div>
        </div>
        <div style={{flex:1,minWidth:140,padding:'13px 16px',background:'var(--surface2)',borderRadius:9,border:'1px solid var(--border)'}}>
          <div style={{fontSize:11,color:'var(--muted)'}}>Tax Drag on IRR</div>
          <div className="mono" style={{fontSize:21,fontWeight:800,color:'var(--warn)'}}>{f.pct(drop,1)}</div>
          <div style={{fontSize:10.5,color:'var(--muted2)',marginTop:2}}>{(A.depYears).toFixed(1)}-yr depreciation</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}} className="g2">
        <div>
          <div style={{fontSize:11,fontWeight:700,color:G,letterSpacing:'.5px',marginBottom:6}}>SALE TAX</div>
          {[['Adjusted basis at sale',f.$(A.adjBasis)],['Total gain',f.$(A.saleGain)],['Depreciation recapture tax',f.$(A.recaptureTax)],['Capital gains tax',f.$(A.capGainTax)],['Total tax on sale',f.$(A.saleTax)],['After-tax sale proceeds',f.$(A.atProceeds)]].map((r,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #ececec',fontSize:13}}>
              <span style={{color:'var(--muted)'}}>{r[0]}</span><span className="mono" style={{fontWeight:600}}>{r[1]}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:G,letterSpacing:'.5px',marginBottom:6}}>ANNUAL DEPRECIATION SHIELD</div>
          {[['Depreciable basis',f.$(A.deprBasis)],['Annual depreciation',f.$(A.annualDep)],['Accumulated at exit',f.$(A.accumDep)],['Ordinary tax rate',(A.taxRate*100).toFixed(0)+'%']].map((r,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #ececec',fontSize:13}}>
              <span style={{color:'var(--muted)'}}>{r[0]}</span><span className="mono" style={{fontWeight:600}}>{r[1]}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{fontSize:12,color:'var(--muted)',marginTop:14,lineHeight:1.5}}>Depreciation shelters operating income each year; at sale, that depreciation is recaptured at {(A.recRate*100).toFixed(0)}% and remaining gain taxed at {(A.capRate*100).toFixed(0)}%. Passive-loss limitations are simplified.</p>
    </div>
  );
}

function WaterfallPanel({W}){
  if(!W)return null;
  const GP='#3a5bf0', LPc='#56687a';
  const f0=f.$;
  const box=(label,lp,gp)=>(
    <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #ececec',fontSize:13.5}}>
      <span style={{color:'#5f5f5f'}}>{label}</span>
      <span style={{display:'flex',gap:24}}>
        <span style={{width:92,textAlign:'right',color:'#3f3f3f',fontWeight:600}}>{lp}</span>
        <span style={{width:92,textAlign:'right',color:'#3f3f3f',fontWeight:600}}>{gp}</span>
      </span>
    </div>
  );
  return(
    <div className="glass" style={{padding:'22px 24px',marginBottom:22,borderTop:'3px solid '+GP}}>
      <div className="sect-lbl" style={{color:GP}}>Equity Waterfall &mdash; LP / GP Returns</div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:24,fontSize:11,fontWeight:700,letterSpacing:'.5px',color:'#8c8c8c',marginBottom:4,marginTop:2}}>
        <span style={{width:92,textAlign:'right'}}>LIMITED PARTNER</span>
        <span style={{width:92,textAlign:'right'}}>SPONSOR (GP)</span>
      </div>
      {box('Equity contributed',f0(W.lpEq),f0(W.gpEq))}
      {box('Total distributions',f0(W.lpTot),f0(W.gpTot))}
      {box('Net profit',f0(W.lpProfit),f0(W.gpProfit))}
      {box('IRR',f.pct(W.lpIRR,1),f.pct(W.gpIRR,1))}
      {box('Equity multiple',f.x(W.lpEM),f.x(W.gpEM))}
      <div style={{display:'flex',gap:14,marginTop:16,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:150,padding:'12px 16px',background:'#eef1fe',borderRadius:4,border:'1px solid #d6e3f0'}}>
          <div style={{fontSize:11,color:'#8c8c8c',marginBottom:3}}>GP Promote (above pro-rata)</div>
          <div style={{fontSize:18,fontWeight:800,color:GP}}>{f0(W.gpPromote)}</div>
        </div>
        <div style={{flex:1,minWidth:150,padding:'12px 16px',background:'#eef1fe',borderRadius:4,border:'1px solid #d6e3f0'}}>
          <div style={{fontSize:11,color:'#8c8c8c',marginBottom:3}}>Structure</div>
          <div style={{fontSize:14,fontWeight:700,color:'#191919'}}>{(W.lpShare*100).toFixed(0)}/{(W.gpShare*100).toFixed(0)} equity &middot; {(W.pref*100).toFixed(0)}% pref</div>
        </div>
      </div>
      <div style={{marginTop:14}}>
        <div style={{fontSize:11,fontWeight:700,color:GP,letterSpacing:'.5px',marginBottom:6}}>PROMOTE TIERS (LP SHARE OF CASH)</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {W.tiers.map((t,i)=>(
            <div key={i} style={{flex:1,minWidth:120,padding:'8px 10px',background:'#f7f7f7',borderRadius:4,textAlign:'center'}}>
              <div style={{fontSize:11,color:'#8c8c8c'}}>{t.label}</div>
              <div style={{fontSize:14,fontWeight:700,color:'#191919'}}>{(t.sL*100).toFixed(0)} / {(100-t.sL*100).toFixed(0)}</div>
            </div>
          ))}
        </div>
      </div>
      <p style={{fontSize:12,color:'#737373',marginTop:14,lineHeight:1.5}}>Return of capital and the preferred return are paid first; the sponsor earns its promote on cash flow above each LP IRR hurdle. LP and GP figures are computed from the deal's levered cash flows.</p>
    </div>
  );
}

function LihtcPanel({L,res}){
  const PUR='#7a5195';
  const row=(label,val,opts={})=>(
    <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #ececec',fontSize:13.5}}>
      <span style={{color:opts.bold?'#191919':'#5f5f5f',fontWeight:opts.bold?700:400,paddingLeft:opts.indent?14:0}}>{label}</span>
      <span style={{color:opts.color||(opts.bold?'#191919':'#3f3f3f'),fontWeight:opts.bold?700:600}}>{val}</span>
    </div>
  );
  const gap=L.fundingGap;
  const gapColor=Math.abs(gap)<1?'#1a7f37':(gap>0?'#b42318':'#9a6700');
  const gapLabel=Math.abs(gap)<1?'Balanced':(gap>0?'Funding shortfall':'Surplus');
  return(
    <div className="glass" style={{padding:'22px 24px',marginBottom:22,borderTop:'3px solid '+PUR}}>
      <div className="sect-lbl" style={{color:PUR}}>LIHTC &amp; Syndication Analysis</div>
      <div className="g2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:28,marginTop:4}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:PUR,letterSpacing:'.5px',marginBottom:6}}>TAX CREDIT CALCULATION</div>
          {row('Eligible basis ('+(L.ebPct*100).toFixed(0)+'%)',f.$(L.eligibleBasis))}
          {row('Basis boost',L.boostPct+'%')}
          {row('Boosted eligible basis',f.$(L.boostedBasis))}
          {row('Applicable fraction',(L.applicableFraction*100).toFixed(0)+'%')}
          {row('Qualified basis',f.$(L.qualifiedBasis),{bold:true})}
          {row('Credit rate',(L.creditRate*100).toFixed(2)+'%')}
          {row('Annual credit',f.$(L.annualCredit))}
          {row('10-year credits',f.$(L.tenYearCredits))}
          {row('Credit price','$'+L.creditPrice.toFixed(3))}
          {row('LIHTC equity',f.$(L.lihtcEquity),{bold:true,color:PUR})}
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:PUR,letterSpacing:'.5px',marginBottom:6}}>SOURCES &amp; USES</div>
          {row('Permanent loan (DSCR-sized)',f.$(L.permLoan))}
          {row('LIHTC equity',f.$(L.lihtcEquity))}
          {row('Soft sources / subsidy',f.$(L.softSources))}
          {row('Deferred developer fee',f.$(L.deferredFee))}
          {row('Total sources',f.$(L.totalSources),{bold:true})}
          <div style={{height:8}}/>
          {row('Land',f.$(L.land))}
          {row('Hard costs',f.$(L.hard))}
          {row('Soft costs',f.$(L.soft))}
          {row('Developer fee',f.$(L.devFee))}
          {row('Total uses',f.$(L.totalUses),{bold:true})}
        </div>
      </div>
      <div style={{display:'flex',gap:14,marginTop:16,flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:160,padding:'12px 16px',background:'#f4f0f8',borderRadius:4,border:'1px solid #e0d8ec'}}>
          <div style={{fontSize:11,color:'#8c8c8c',marginBottom:3}}>Financing Gap</div>
          <div style={{fontSize:18,fontWeight:800,color:gapColor}}>{f.$(Math.abs(gap))} <span style={{fontSize:12,fontWeight:600}}>{gapLabel}</span></div>
        </div>
        <div style={{flex:1,minWidth:160,padding:'12px 16px',background:'#f4f0f8',borderRadius:4,border:'1px solid #e0d8ec'}}>
          <div style={{fontSize:11,color:'#8c8c8c',marginBottom:3}}>Developer Fee Paid in Cash</div>
          <div style={{fontSize:18,fontWeight:800,color:'#191919'}}>{f.$(L.cashDevFee)}</div>
        </div>
        <div style={{flex:1,minWidth:160,padding:'12px 16px',background:'#f4f0f8',borderRadius:4,border:'1px solid #e0d8ec'}}>
          <div style={{fontSize:11,color:'#8c8c8c',marginBottom:3}}>Equity as % of Total Uses</div>
          <div style={{fontSize:18,fontWeight:800,color:PUR}}>{L.totalUses>0?(L.lihtcEquity/L.totalUses*100).toFixed(1):0}%</div>
        </div>
      </div>
      <p style={{fontSize:12,color:'#7a5195',marginTop:14,lineHeight:1.5}}>The permanent loan is sized to your minimum DSCR on stabilized NOI. This analysis covers the credit calculation and capital stack; the operating metrics below reflect stabilized cash flow. Full LP and GP partnership returns with credit delivery are a separate analysis.</p>
    </div>
  );
}

function Dashboard({res,inp,onExport,onBack,onSave}){
  const [tab,setTab]=useState('charts');
  const hp=inp.holdingPeriod||7;
  const {rows,ret,sum,exit,equity,totalCost,acqC,LF}=res;
  const t=inp.assetType.toLowerCase();
  const y1=rows[0];
  const irrC=ret.irr>0.18?'#1a7f37':ret.irr>0.12?'#9a6700':'#b42318';
  const cocC=sum.coc>0.08?'#1a7f37':sum.coc>0.05?'#9a6700':'#b42318';
  const dscrC=!sum.dscr?'#666666':sum.dscr>1.4?'#1a7f37':sum.dscr>1.2?'#9a6700':'#b42318';
  const capC=sum.capR>0.07?'#1a7f37':sum.capR>0.05?'#9a6700':'#b42318';
  const npvC=ret.npv>0?'#1a7f37':'#b42318';
  const chartData=rows.slice(0,hp).map(r=>({yr:`Yr ${r.yr}`,NOI:Math.round(r.noi),'Cash Flow':Math.round(r.cfbt)}));
  const ratesData=rows.slice(0,hp).map(r=>({yr:`Yr ${r.yr}`,'Cap Rate':+(r.capR*100).toFixed(2),'CoC Return':+(r.coc*100).toFixed(2)}));
  const balData=rows.slice(0,hp).map(r=>({yr:`Yr ${r.yr}`,'Loan Balance':Math.round(r.bal/1000)*1000,'NOI':Math.round(r.noi)}));
  const KPIS=[
    {l:'IRR',v:f.pct(ret.irr,1),sub:`${hp}-yr hold`,c:irrC,tt:'Internal Rate of Return on invested equity'},
    {l:'Equity Multiple',v:f.x(ret.em),sub:f.$(ret.profit)+' profit',c:'#56687a',tt:'Total equity returned ÷ equity invested'},
    {l:'Year 1 Cap Rate',v:f.pct(sum.capR,2),sub:t==='development'?'NOI / Total Dev Cost':'NOI / Purchase Price',c:capC,tt:'Unlevered return based on Year 1 NOI'},
    {l:'Cash-on-Cash Yr 1',v:f.pct(sum.coc,2),sub:f.$(sum.cf)+' cash flow',c:cocC,tt:'Yr 1 cash flow ÷ equity invested'},
    {l:'DSCR Yr 1',v:sum.dscr?`${sum.dscr.toFixed(2)}x`:'N/A',sub:'NOI / Debt Service',c:dscrC,tt:'Lenders typically require > 1.25x'},
    {l:'NPV',v:f.$(ret.npv),sub:`@ ${inp.discountRate}% discount`,c:npvC,tt:'Net present value at your target return'},
    {l:'Break-Even Occ.',v:f.pct(sum.beOcc,1),sub:'Min occupancy for +CF',c:'#9a6700',tt:'Occupancy needed to cover all cash outflows'},
    {l:'Net Sale Proceeds',v:f.$(exit.proceeds),sub:`Exit at ${inp.exitCapRate}% cap`,c:'#3a5bf0',tt:'Net proceeds after selling costs & loan payoff'},
    ...(t==='development'?[{l:'Return on Cost',v:f.pct(y1.noi/(sum.devCost||1),2),sub:'Stabilized NOI / TDC',c:'#b54708',tt:'Stabilized NOI over total development cost (development yield)'}]:[]),
  ];
  return(
    <div className="fu">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
            <button onClick={onBack} style={{background:'#efeeec',border:'none',borderRadius:8,padding:'5px 13px',color:'#5f5f5f',cursor:'pointer',fontSize:12}}>← Edit</button>
            <Chip color='#3a5bf0'>{inp.assetType}</Chip>
            <Chip color='#56687a'>{hp}-Year Hold</Chip>
            {inp.address&&<Chip color='#737373'>{inp.address}</Chip>}
          </div>
          <h2 style={{fontSize:22,fontWeight:800}}>{inp.propertyName||'Pro Forma Analysis'}</h2>
        </div>
        <div style={{display:'flex',gap:10,flexShrink:0}}>
          <button className="btn-s" onClick={onSave}>Save deal</button>
          <button className="btn-s" onClick={()=>openMemo(res,inp)}>Deal Memo</button>
          <button className="btn-s" onClick={()=>downloadMemo(res,inp)}>Memo .md</button>
          <button className="btn-p" onClick={onExport}>Export Excel</button>
        </div>
      </div>

      <div className="glass g4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',marginBottom:24,overflow:'hidden'}}>
        {KPIS.map(k=>(
          <div key={k.l} className="kpi tooltip-w">
            <div className="tt">{k.tt}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.c}}>{k.v}</div>
            <div style={{fontSize:11.5,color:'#666666',marginTop:4,fontWeight:600}}>{k.l}</div>
            {k.sub&&<div style={{fontSize:10.5,color:'#8c8c8c',marginTop:2}}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {res.lihtc&&<LihtcPanel L={res.lihtc} res={res}/>}
      {calcProjectTimeline(res,inp)&&<ProjectTimelinePanel P={calcProjectTimeline(res,inp)}/>}
      {!res.lihtc&&<ScenarioPanel S={calcScenarios(res,inp)}/>}
      {calcDevCredits(res,inp)&&<DevCreditsPanel D={calcDevCredits(res,inp)}/>}
      {!res.lihtc&&inp.refiEnabled&&<RefinancePanel R={calcRefinance(res,inp)}/>}
      {res.debtSizing&&<div className="glass" style={{padding:'16px 22px',marginBottom:22,borderTop:'3px solid var(--accent)'}}>
        <div className="sect-lbl">Debt Sizing &mdash; Lesser-of Test</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {res.debtSizing.constraints.map((c,i)=>(
            <div key={i} style={{flex:1,minWidth:130,padding:'12px 14px',borderRadius:9,background:c.binds?'var(--ink)':'var(--surface2)',border:'1px solid '+(c.binds?'var(--ink)':'var(--border)')}}>
              <div style={{fontSize:11,color:c.binds?'#aab3c9':'var(--muted)'}}>{c.name} <span style={{opacity:.7}}>({c.basis})</span></div>
              <div className="mono" style={{fontSize:16,fontWeight:700,color:c.binds?'#fff':'var(--text)',marginTop:3}}>{f.$(c.loan)}</div>
              {c.binds&&<div style={{fontSize:9.5,color:'#7d93ff',fontWeight:700,letterSpacing:'.5px',marginTop:3}}>BINDING CONSTRAINT</div>}
            </div>
          ))}
        </div>
        <p style={{fontSize:12.5,color:'var(--muted)',marginTop:12,lineHeight:1.5}}>The loan is sized to <span style={{fontWeight:700,color:'var(--text)'}}>{f.$(res.debtSizing.sizedLoan)}</span>, set by the {res.debtSizing.binding} constraint &mdash; the most restrictive of the three. Lowering it would loosen leverage; this is the maximum supportable loan under your limits.</p>
      </div>}
      {!res.lihtc&&<WaterfallPanel W={calcWaterfall(res,inp)}/>}
      {!res.lihtc&&inp.afterTax&&<AfterTaxPanel A={calcAfterTax(res,inp)}/>}

      <div className="glass" style={{padding:'20px 24px',marginBottom:22}}>
        <div className="sect-lbl">Analyst Notes<span style={{fontWeight:400,letterSpacing:0,textTransform:'none',fontSize:10.5,color:'#737373'}}>auto-generated from your inputs</span></div>
        {analystNotes(res,inp).map((n,i)=>(
          <p key={i} style={{fontSize:13.5,color:'#3f3f3f',lineHeight:1.65,marginBottom:i===analystNotes(res,inp).length-1?0:9}}>{n}</p>
        ))}
        {t==='development'&&<p style={{fontSize:12,color:'#9a6700',marginTop:10,lineHeight:1.5}}>Note: the headline IRR is the stabilized-operations return. See the Construction &amp; Lease-Up panel for the project-level IRR that accounts for the build period, lease-up ramp, and capitalized interest.</p>}
      </div>

      <div style={{display:'flex',gap:7,marginBottom:22,flexWrap:'wrap'}}>
        {[{id:'charts',l:'Charts'},{id:'proforma',l:'Pro Forma Table'},{id:'returns',l:'Returns'},{id:'sensitivity',l:'Sensitivity'}].map(tb=>(
          <button key={tb.id} className={`tab ${tab===tb.id?'on':'off'}`} onClick={()=>setTab(tb.id)}>{tb.l}</button>
        ))}
      </div>

      {tab==='charts'&&(
        <div className="fu g2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,alignItems:'start'}}>
          <div className="glass" style={{padding:22}}>
            <div className="sect-lbl">Annual NOI & Cash Flow: {hp}-Year Projection</div>
            {ResponsiveContainer?<ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={chartData} margin={{top:4,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1"/>
                <XAxis dataKey="yr" tick={{fill:'#666666',fontSize:12}}/>
                <YAxis tick={{fill:'#666666',fontSize:11}} tickFormatter={v=>f.$(v)}/>
                <Tooltip content={<ChartTip/>}/>
                <Legend wrapperStyle={{fontSize:13,color:'#5f5f5f'}}/>
                <Bar dataKey="NOI" fill="#3a5bf0" opacity={0.85} radius={[4,4,0,0]}/>
                <Bar dataKey="Cash Flow" fill="#1a7f37" opacity={0.85} radius={[4,4,0,0]}/>
              </ComposedChart>
            </ResponsiveContainer>:<p style={{color:'#b42318',fontSize:13}}>Chart library failed to load. Refresh the page to retry.</p>}
          </div>
          <div className="glass" style={{padding:22}}>
            <div className="sect-lbl">Cap Rate & Cash-on-Cash Trend</div>
            {ResponsiveContainer&&<ResponsiveContainer width="100%" height={210}>
              <LineChart data={ratesData} margin={{top:4,right:10,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1"/>
                <XAxis dataKey="yr" tick={{fill:'#666666',fontSize:12}}/>
                <YAxis tick={{fill:'#666666',fontSize:11}} tickFormatter={v=>`${v}%`}/>
                <Tooltip content={<ChartTip/>}/>
                <Legend wrapperStyle={{fontSize:13,color:'#5f5f5f'}}/>
                <Line type="monotone" dataKey="Cap Rate" stroke="#56687a" strokeWidth={2.5} dot={{fill:'#56687a',r:3.5}}/>
                <Line type="monotone" dataKey="CoC Return" stroke="#1a7f37" strokeWidth={2.5} dot={{fill:'#1a7f37',r:3.5}}/>
              </LineChart>
            </ResponsiveContainer>}
          </div>
        </div>
      )}

      {tab==='proforma'&&(
        <div className="fu glass" style={{padding:22}}>
          <div className="sect-lbl">{hp}-Year Pro Forma</div>
          <PFTable rows={rows} hp={hp}/>
        </div>
      )}

      {tab==='returns'&&(
        <div className="fu">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}} className="g2">
            <div className="glass" style={{padding:22}}>
              <div className="sect-lbl">Capital Stack</div>
              {[
                {l:'Purchase Price',v:inp.purchasePrice},
                {l:'Acquisition Costs',v:acqC},
                ...(LF>0?[{l:'Loan Fees',v:LF}]:[]),
                {l:'Total All-In Cost',v:totalCost,bold:true},
                {l:'  Debt (Loan)',v:inp.loanAmount,c:'#b42318'},
                {l:'  Equity',v:equity,c:'#1a7f37',bold:true},
              ].map((r,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #ececec',fontSize:13.5}}>
                  <span style={{color:r.bold?'#191919':'#666666',fontWeight:r.bold?700:400}}>{r.l}</span>
                  <span style={{color:r.c||(r.bold?'#191919':'#3f3f3f'),fontWeight:r.bold?700:400}}>{f.$f(r.v)}</span>
                </div>
              ))}
            </div>
            <div className="glass" style={{padding:22}}>
              <div className="sect-lbl">Exit Analysis (Year {hp})</div>
              {[
                {l:`Forward NOI (Year ${hp+1})`,v:f.$f(rows[hp]?.noi)},
                {l:'÷ Exit Cap Rate',v:`${inp.exitCapRate}%`},
                {l:'= Gross Sale Price',v:f.$f(exit.grossSale),bold:true},
                {l:'  Less: Selling Costs',v:`(${f.$f(exit.sellAmt)})`},
                {l:'Net Sale Price',v:f.$f(exit.netSale)},
                {l:'  Less: Loan Payoff',v:`(${f.$f(exit.payoff)})`},
                {l:'Net Proceeds to Equity',v:f.$f(exit.proceeds),bold:true,c:'#1a7f37'},
              ].map((r,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid #ececec',fontSize:13.5}}>
                  <span style={{color:r.bold?'#191919':'#666666',fontWeight:r.bold?700:400}}>{r.l}</span>
                  <span style={{color:r.c||(r.bold?'#191919':'#3f3f3f'),fontWeight:r.bold?700:400}}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass" style={{padding:22}}>
            <div className="sect-lbl">Total Returns Summary</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}} className="g3">
              {[
                {l:'Equity Invested',v:f.$f(equity),c:'#3a5bf0'},
                {l:'Total Cash Distributions',v:f.$f(ret.totalCF),c:'#56687a'},
                {l:'Net Sale Proceeds',v:f.$f(exit.proceeds),c:'#1a7f37'},
                {l:'Total Capital Returned',v:f.$f(ret.totalCF+exit.proceeds),c:'#9a6700'},
                {l:'Net Profit',v:f.$f(ret.profit),c:ret.profit>0?'#1a7f37':'#b42318'},
                {l:'Equity Multiple',v:f.x(ret.em),c:'#56687a'},
              ].map((i,k)=>(
                <div key={k} style={{textAlign:'center',padding:'16px 12px',background:'#f9f9f8',borderRadius:3}}>
                  <div style={{fontSize:19,fontWeight:800,color:i.c}}>{i.v}</div>
                  <div style={{fontSize:11.5,color:'#737373',marginTop:4}}>{i.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==='sensitivity'&&(
        <div className="fu glass" style={{padding:22}}>
          <SensTable inp={inp}/>
        </div>
      )}
    </div>
  );
}

export{Dashboard};
