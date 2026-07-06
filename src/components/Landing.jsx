import{f}from'../engine/format.js';
import{buildPF}from'../engine/buildPF.js';
import{DEFS}from'../engine/defaults.js';
// ─── LANDING PAGE ─────────────────────────────────────────────────────────
function Landing({onStart,onSample}){
  const r=buildPF(DEFS.multifamily);
  const yrs=r.rows.slice(0,5);
  const maxNOI=Math.max(...yrs.map(x=>x.noi));
  return(
    <div className="fu">
      <div className="dark-surface grid-bg" style={{position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'-30%',right:'-10%',width:560,height:560,background:'radial-gradient(circle,rgba(58,91,240,.28),transparent 70%)',pointerEvents:'none'}}/>
        <div className="g2" style={{position:'relative',maxWidth:1140,margin:'0 auto',padding:'72px 24px 64px',display:'grid',gridTemplateColumns:'1.05fr .95fr',gap:56,alignItems:'center'}}>
          <div>
            <div className="mono" style={{fontSize:11.5,fontWeight:600,letterSpacing:'3px',color:'#7d93ff',marginBottom:20,display:'flex',alignItems:'center',gap:10}}>
              <span style={{width:7,height:7,borderRadius:2,background:'#3a5bf0',boxShadow:'0 0 10px #3a5bf0'}}/>SMARTCAPSTACK.COM
            </div>
            <h1 style={{fontSize:'clamp(32px,5vw,48px)',fontWeight:600,lineHeight:1.1,color:'#fff',marginBottom:20}}>Underwrite any deal like an institution.</h1>
            <p style={{fontSize:17,color:'#aab3c9',lineHeight:1.6,marginBottom:30,maxWidth:520}}>Enter your assumptions. Get a full ten-year discounted cash flow, levered returns, an equity waterfall, sensitivity analysis, and a lender-ready Excel model in under two minutes.</p>
            <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}>
              <button className="btn-p" style={{padding:'13px 30px',fontSize:15}} onClick={onStart}>Start an analysis</button>
              <button style={{padding:'12px 26px',fontSize:15,background:'rgba(255,255,255,.06)',color:'#fff',border:'1px solid rgba(255,255,255,.18)',borderRadius:8,fontWeight:600,cursor:'pointer',fontFamily:"'Sora',sans-serif"}} onClick={onSample}>Download sample model</button>
            </div>
            <div className="mono" style={{fontSize:11.5,color:'#6b7593',letterSpacing:'.5px'}}>MULTIFAMILY / COMMERCIAL / MIXED-USE / DEVELOPMENT / LIHTC</div>
          </div>
          <div style={{borderRadius:14,overflow:'hidden',border:'1px solid rgba(255,255,255,.12)',background:'rgba(18,26,46,.7)',backdropFilter:'blur(8px)',boxShadow:'0 24px 60px rgba(0,0,0,.45)'}}>
            <div style={{borderBottom:'1px solid rgba(255,255,255,.08)',padding:'13px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:13,fontWeight:700,color:'#fff'}}>40-Unit Multifamily Acquisition</span>
              <span className="mono" style={{fontSize:11,color:'#6b7593'}}>7-YR HOLD</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
              {[{l:'LEVERED IRR',v:f.pct(r.ret.irr,1)},{l:'EQUITY MULT.',v:f.x(r.ret.em)},{l:'YR-1 DSCR',v:r.sum.dscr.toFixed(2)+'x'}].map((k,i)=>(
                <div key={k.l} style={{padding:'16px 12px',textAlign:'center',borderRight:i<2?'1px solid rgba(255,255,255,.08)':'none'}}>
                  <div className="mono" style={{fontSize:21,fontWeight:700,color:'#7d93ff'}}>{k.v}</div>
                  <div className="mono" style={{fontSize:9.5,color:'#6b7593',marginTop:4,letterSpacing:'.5px'}}>{k.l}</div>
                </div>
              ))}
            </div>
            <div style={{padding:'17px 18px'}}>
              <div className="mono" style={{fontSize:10,fontWeight:600,color:'#6b7593',marginBottom:12,letterSpacing:'1px'}}>NET OPERATING INCOME</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:8,height:84}}>
                {yrs.map(x=>(
                  <div key={x.yr} style={{flex:1,textAlign:'center'}}>
                    <div style={{background:'linear-gradient(180deg,#5a76f6,#3a5bf0)',borderRadius:'3px 3px 0 0',height:`${Math.round(x.noi/maxNOI*64)}px`,boxShadow:'0 0 12px rgba(58,91,240,.4)'}}/>
                    <div className="mono" style={{fontSize:9.5,color:'#6b7593',marginTop:6}}>Y{x.yr}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:14,paddingTop:13,borderTop:'1px solid rgba(255,255,255,.08)',fontSize:12.5}}>
                <span style={{color:'#aab3c9'}}>Exit at {DEFS.multifamily.exitCapRate}% cap</span>
                <span className="mono" style={{fontWeight:700,color:'#3ddc97'}}>{f.$(r.exit.proceeds)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* HOW IT WORKS */}
      <div style={{maxWidth:1140,margin:'0 auto',padding:'64px 24px 8px'}}>
        <div className="mono" style={{fontSize:11,fontWeight:600,letterSpacing:'3px',color:'var(--accent)',marginBottom:14}}>HOW IT WORKS</div>
        <h2 style={{fontSize:'clamp(24px,3.4vw,32px)',fontWeight:600,marginBottom:8}}>From assumptions to pro forma in three steps.</h2>
        <p style={{color:'var(--muted)',fontSize:14.5,maxWidth:560,lineHeight:1.6}}>No spreadsheet wrangling, no template licenses. The model is built the moment you finish typing.</p>
        <div className="g3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginTop:28}}>
          {[
            {n:'01',t:'Pick the asset type',d:'Multifamily, commercial, mixed-use, ground-up development, or LIHTC affordable. The inputs and outputs adapt to the deal.'},
            {n:'02',t:'Enter your assumptions',d:'Unit mix, operating expenses, debt terms, and exit. Or drop in a rent roll file and the unit mix fills itself in.'},
            {n:'03',t:'Get the full analysis',d:'Ten-year cash flows, levered returns, sensitivity, waterfall, and an investment memo. Then export the model to Excel.'},
          ].map(s=>(
            <div key={s.n} className="glass" style={{padding:'24px 22px'}}>
              <div className="mono" style={{fontSize:12,fontWeight:700,color:'var(--accent)',marginBottom:12}}>{s.n}</div>
              <div style={{fontSize:15.5,fontWeight:700,marginBottom:8,fontFamily:"'Space Grotesk',sans-serif"}}>{s.t}</div>
              <div style={{fontSize:13.5,color:'var(--muted)',lineHeight:1.6}}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div style={{maxWidth:1140,margin:'0 auto',padding:'64px 24px 8px'}}>
        <div className="mono" style={{fontSize:11,fontWeight:600,letterSpacing:'3px',color:'var(--accent)',marginBottom:14}}>EVERYTHING IN THE MODEL</div>
        <h2 style={{fontSize:'clamp(24px,3.4vw,32px)',fontWeight:600,marginBottom:8}}>Institutional outputs, without the analyst.</h2>
        <div className="g3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginTop:28}}>
          {[
            {t:'10-Year DCF Engine',d:'Full income, expense, and debt-service projection with growth rates, vacancy, and interest-only periods.'},
            {t:'Returns & Exit Analysis',d:'Levered IRR, equity multiple, NPV, cash-on-cash, break-even occupancy, and a complete exit breakdown.'},
            {t:'IRR Sensitivity Matrix',d:'Returns across revenue-growth and exit-cap scenarios, so you can see exactly where the deal breaks.'},
            {t:'Equity Waterfall',d:'LP/GP promote structures with a preferred return and tiered IRR hurdles, computed year by year.'},
            {t:'LIHTC & Tax Credits',d:'Full tax-credit syndication: qualified basis, credit pricing, DSCR-sized debt, and deferred developer fee.'},
            {t:'Lender-Ready Excel',d:'Every output exports as a live Excel formula. Change a blue input cell and the entire model recalculates.'},
          ].map(x=>(
            <div key={x.t} className="glass" style={{padding:'22px 20px'}}>
              <div style={{width:34,height:4,background:'var(--accent)',borderRadius:2,marginBottom:14}}/>
              <div style={{fontSize:15,fontWeight:700,marginBottom:7,fontFamily:"'Space Grotesk',sans-serif"}}>{x.t}</div>
              <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.55}}>{x.d}</div>
            </div>
          ))}
        </div>
        <div className="g2" style={{marginTop:24,display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'8px 24px'}}>
          {[
            'Scenario analysis (downside / base / upside)',
            'Refinance & cash-out modeling',
            'After-tax IRR with depreciation & recapture',
            'Construction draw schedules & capitalized interest',
            'Automated debt sizing (DSCR, LTV, debt yield)',
            'Investment memo generator',
            'Rent-roll file import (CSV / Excel)',
            'Deal comparison & portfolio roll-up',
          ].map(x=>(
            <div key={x} style={{display:'flex',gap:9,alignItems:'baseline',fontSize:13.5,color:'var(--muted)'}}>
              <span style={{color:'var(--pos)',fontWeight:700}}>✓</span>{x}
            </div>
          ))}
        </div>
      </div>

      {/* EXCEL SPOTLIGHT */}
      <div className="dark-surface grid-bg" style={{marginTop:64,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',bottom:'-40%',left:'-8%',width:480,height:480,background:'radial-gradient(circle,rgba(58,91,240,.22),transparent 70%)',pointerEvents:'none'}}/>
        <div className="g2" style={{position:'relative',maxWidth:1140,margin:'0 auto',padding:'64px 24px',display:'grid',gridTemplateColumns:'1fr .9fr',gap:56,alignItems:'center'}}>
          <div>
            <div className="mono" style={{fontSize:11,fontWeight:600,letterSpacing:'3px',color:'#7d93ff',marginBottom:14}}>EXCEL EXPORT</div>
            <h2 style={{fontSize:'clamp(24px,3.4vw,32px)',fontWeight:600,color:'#fff',marginBottom:14}}>The export isn't a report. It's the model.</h2>
            <p style={{fontSize:15,color:'#aab3c9',lineHeight:1.65,marginBottom:18}}>Most tools hand you a PDF or a wall of hardcoded numbers. SmartCapStack writes a real workbook: every output is a live Excel formula wired to the input cells, including the IRR sensitivity grid.</p>
            <p style={{fontSize:14,color:'#8a93a6',lineHeight:1.6,marginBottom:26}}><span style={{color:'#7db4e8',fontWeight:700}}>Blue cells</span> are inputs. Black cells are formulas. Change an assumption in Excel and the whole model — pro forma, returns, sensitivity — recalculates. Send it straight to a lender or LP.</p>
            <button style={{padding:'12px 26px',fontSize:15,background:'rgba(255,255,255,.06)',color:'#fff',border:'1px solid rgba(255,255,255,.18)',borderRadius:8,fontWeight:600,cursor:'pointer',fontFamily:"'Sora',sans-serif"}} onClick={onSample}>Download sample model</button>
          </div>
          <div style={{borderRadius:12,overflow:'hidden',border:'1px solid rgba(255,255,255,.12)',boxShadow:'0 24px 60px rgba(0,0,0,.45)'}}>
            <div style={{background:'#1f3864',padding:'10px 16px',display:'flex',alignItems:'center',gap:9}}>
              <span style={{width:9,height:9,borderRadius:'50%',background:'#3ddc97'}}/>
              <span className="mono" style={{fontSize:11.5,color:'#fff',fontWeight:600}}>SmartCapStack_Model.xlsx</span>
            </div>
            <div className="mono" style={{padding:'8px 14px',borderBottom:'1px solid #d3d9e8',fontSize:11.5,color:'#5a6478',display:'flex',gap:10,background:'#fff'}}>
              <span style={{fontStyle:'italic',fontWeight:700}}>fx</span>
              <span>=IRR($C$45:$J$45)</span>
            </div>
            {[
              ['Purchase Price','$7,750,000',true],
              ['Exit Cap Rate','5.75%',true],
              ['Vacancy & Credit Loss','5.0%',true],
              ['Net Operating Income','=C12+C16',false],
              ['Levered IRR',f.pct(r.ret.irr,1),false],
              ['Equity Multiple',f.x(r.ret.em),false],
            ].map((row,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'9px 16px',borderBottom:'1px solid #e2e6f0',fontSize:12.5,background:i%2?'#f7f9fd':'#fff'}}>
                <span style={{color:'#5a6478'}}>{row[0]}</span>
                <span className="mono" style={{fontWeight:700,color:row[2]?'#0070c0':'#0c1322'}}>{row[1]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PIPELINE */}
      <div style={{maxWidth:1140,margin:'0 auto',padding:'64px 24px 8px'}}>
        <div className="mono" style={{fontSize:11,fontWeight:600,letterSpacing:'3px',color:'var(--accent)',marginBottom:14}}>YOUR PIPELINE</div>
        <h2 style={{fontSize:'clamp(24px,3.4vw,32px)',fontWeight:600,marginBottom:8}}>Save deals, compare them, roll up the book.</h2>
        <div className="g3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginTop:28}}>
          {[
            {t:'Save to the cloud',d:'Create a free account and your deals sync across devices. No account? They stay in your browser.'},
            {t:'Compare side by side',d:'Line up any two saved deals metric for metric to see which one actually pencils.'},
            {t:'Portfolio roll-up',d:'Aggregate every saved deal into pooled IRR, equity-weighted returns, and allocation by asset type.'},
          ].map(x=>(
            <div key={x.t} className="glass" style={{padding:'22px 20px'}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:7,fontFamily:"'Space Grotesk',sans-serif"}}>{x.t}</div>
              <div style={{fontSize:13,color:'var(--muted)',lineHeight:1.55}}>{x.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FINAL CTA */}
      <div style={{maxWidth:1140,margin:'0 auto',padding:'56px 24px 72px'}}>
        <div className="dark-surface" style={{borderRadius:16,padding:'56px 32px',textAlign:'center',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:'-60%',left:'30%',width:520,height:520,background:'radial-gradient(circle,rgba(58,91,240,.3),transparent 70%)',pointerEvents:'none'}}/>
          <h2 style={{fontSize:'clamp(24px,3.6vw,34px)',fontWeight:600,color:'#fff',marginBottom:12,position:'relative'}}>Underwrite your next deal in minutes.</h2>
          <p style={{color:'#aab3c9',fontSize:15,marginBottom:26,position:'relative'}}>Free while in early access. Runs entirely in your browser — nothing to install.</p>
          <button className="btn-p" style={{padding:'13px 34px',fontSize:15,position:'relative'}} onClick={onStart}>Start an analysis</button>
        </div>
      </div>
    </div>
  );
}

export{Landing};
