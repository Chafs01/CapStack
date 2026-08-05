import{f}from'../engine/format.js';
import{buildPF}from'../engine/buildPF.js';
import{DEFS}from'../engine/defaults.js';
// ─── LANDING PAGE ─────────────────────────────────────────────────────────
// Editorial layout: a narrow heading column on the left, ruled label/description
// rows on the right. Typographic lists rather than card grids throughout.
const WRAP={maxWidth:1140,margin:'0 auto',padding:'0 24px'};

function Sec({eyebrow,title,intro,children,foot}){
  return(
    <div style={{borderTop:'1px solid var(--text)'}}>
      <div style={{...WRAP,padding:'54px 24px 58px'}}>
        <div className="g2" style={{display:'grid',gridTemplateColumns:'1fr 1.55fr',gap:56,alignItems:'start'}}>
          <div>
            {eyebrow&&<div className="eyebrow" style={{marginBottom:16}}>{eyebrow}</div>}
            <h2 style={{fontSize:'clamp(22px,2.7vw,30px)',fontWeight:600,lineHeight:1.18,letterSpacing:'-.022em'}}>{title}</h2>
            {foot&&<div style={{marginTop:24}}>{foot}</div>}
          </div>
          <div>
            {intro&&<p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.65,marginBottom:8}}>{intro}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({label,text}){
  return(
    <div style={{display:'grid',gridTemplateColumns:'168px 1fr',gap:24,padding:'15px 0',borderTop:'1px solid var(--border)'}} className="g2">
      <div style={{fontSize:'var(--fs-4)',fontWeight:600,letterSpacing:'-.01em'}}>{label}</div>
      <div style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.6}}>{text}</div>
    </div>
  );
}

function Landing({onStart,onSample,onDemo}){
  const r=buildPF(DEFS.multifamily);
  const link={padding:'5px 0',fontSize:'var(--fs-4)',background:'none',color:'var(--text)',border:'none',
    borderBottom:'1px solid var(--text)',borderRadius:0,fontWeight:500,cursor:'pointer',fontFamily:"'Inter',sans-serif"};
  return(
    <div className="fu">
      {/* ── HERO ── */}
      <div style={{...WRAP,padding:'64px 24px 72px'}}>
        <div className="g2" style={{display:'grid',gridTemplateColumns:'1.05fr .95fr',gap:56,alignItems:'start'}}>
          <div>
            <div className="eyebrow" style={{marginBottom:22}}>SmartCapStack &mdash; Real Estate Pro Forma</div>
            <h1 style={{fontSize:'clamp(34px,5.4vw,60px)',fontWeight:600,lineHeight:1.06,letterSpacing:'-.03em',marginBottom:22,maxWidth:520,textWrap:'balance'}}>Underwrite any deal like an institution.</h1>
            <p style={{fontSize:'var(--fs-6)',color:'var(--muted)',lineHeight:1.6,marginBottom:32,maxWidth:480}}>SmartCapStack turns your assumptions into a discounted cash flow, levered returns, an equity waterfall, and a sensitivity matrix &mdash; then exports a live Excel workbook.</p>
            <div style={{display:'flex',gap:26,flexWrap:'wrap',alignItems:'baseline',marginBottom:34}}>
              <button style={{...link,fontWeight:600}} onClick={onStart}>Run a deal &rarr;</button>
              <button style={{...link}} onClick={onDemo}>See a finished analysis</button>
              <button style={{...link,color:'var(--muted)',borderBottomColor:'transparent'}} onClick={onSample}>Download sample model</button>
            </div>
            <div className="eyebrow">Multifamily&nbsp; / &nbsp;Commercial&nbsp; / &nbsp;Mixed-Use&nbsp; / &nbsp;Development&nbsp; / &nbsp;LIHTC</div>
          </div>

          <div style={{border:'1px solid var(--border2)',background:'var(--surface)',padding:'22px 24px 20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
              <span className="eyebrow">40-Unit Multifamily</span>
              <span className="eyebrow">7-Yr Hold</span>
            </div>
            {[{l:'Levered IRR',v:f.pct(r.ret.irr,1)},{l:'Equity Multiple',v:f.x(r.ret.em)},{l:'Yr-1 DSCR',v:r.sum.dscr.toFixed(2)+'x'}].map(k=>(
              <div key={k.l} style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:20,padding:'20px 0'}}>
                <span className="eyebrow">{k.l}</span>
                <span style={{fontSize:'clamp(26px,3vw,34px)',fontWeight:600,letterSpacing:'-.035em',fontVariantNumeric:'tabular-nums'}}>{k.v}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:16,borderTop:'1px solid var(--border)',fontSize:'var(--fs-3)',color:'var(--muted)'}}>
              <span>Exit at {DEFS.multifamily.exitCapRate}% cap</span>
              <span style={{fontVariantNumeric:'tabular-nums',color:'var(--text)'}}>{f.$(r.exit.proceeds)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <Sec eyebrow="Method" title={<>Four clear steps to a<br/>full pro forma.</>}
        intro="No spreadsheet wrangling, no template licences. Work through the property, operations, financing, and exit assumptions, then the model builds instantly.">
        <Row label="Asset type" text="Multifamily, commercial, mixed-use, ground-up development, or LIHTC. Inputs and outputs adapt to the deal structure."/>
        <Row label="Assumptions" text="Unit mix, operating expenses, debt terms, and exit. Drop in a rent roll and the unit mix fills itself in."/>
        <Row label="Analysis" text="Cash flows over a hold of up to 20 years, levered returns, sensitivity, waterfall, and an investment memo. Then export to Excel."/>
      </Sec>

      {/* ── FEATURES ── */}
      <Sec eyebrow="Everything in the model" title={<>Institutional outputs,<br/>without the analyst.</>}>
        <Row label="Multi-Year DCF Engine" text="Income, expense, and debt-service projection over a 3- to 20-year hold, with growth rates, vacancy, and interest-only periods."/>
        <Row label="Returns & Exit" text="Levered IRR, equity multiple, NPV, cash-on-cash, break-even occupancy, and a full exit breakdown."/>
        <Row label="IRR Sensitivity" text="Returns across revenue-growth and exit-cap scenarios, so you see exactly where the deal breaks."/>
        <Row label="Equity Waterfall" text="LP/GP promote with a preferred return and tiered IRR hurdles, computed year by year."/>
        <Row label="LIHTC & Tax Credits" text="Qualified basis, credit pricing, DSCR-sized debt, and deferred developer fee."/>
        <Row label="Lender-Ready Excel" text="Every output exports as a live formula. Change an input cell and the whole model recalculates."/>
        <div className="g2" style={{marginTop:30,display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 32px'}}>
          {['Scenario analysis (downside / base / upside)','Refinance & cash-out modelling',
            'After-tax IRR with depreciation & recapture','Construction draw schedules & capitalised interest',
            'Automated debt sizing (DSCR, LTV, debt yield)','Investment memo generator',
            'Rent-roll file import (CSV / Excel)','Deal comparison & portfolio roll-up'].map(x=>(
            <div key={x} style={{display:'flex',gap:10,alignItems:'baseline',fontSize:'var(--fs-4)',color:'var(--muted)'}}>
              <span style={{color:'var(--text)'}}>&mdash;</span>{x}
            </div>
          ))}
        </div>
      </Sec>

      {/* ── EXCEL EXPORT ── */}
      <Sec eyebrow="Excel export" title={<>The export isn't a report.<br/>It's the model.</>}
        foot={<button style={{...link,fontWeight:600}} onClick={onSample}>Download sample model &rarr;</button>}>
        <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.7,marginBottom:10}}>Most tools hand you a PDF or a wall of hardcoded numbers. SmartCapStack writes a real workbook: every output is a live Excel formula wired to the input cells, including the IRR sensitivity grid.</p>
        <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.7,marginBottom:26}}>Blue cells are inputs; every other figure is a live formula. Change an assumption in Excel and the whole model &mdash; pro forma, returns, sensitivity &mdash; recalculates. Send it straight to a lender or LP.</p>
        <div style={{border:'1px solid var(--border2)',background:'var(--surface)'}}>
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'11px 16px',borderBottom:'1px solid var(--border)'}}>
            <span className="eyebrow">SmartCapStack_Model.xlsx</span>
          </div>
          <div style={{display:'flex',gap:10,padding:'8px 16px',borderBottom:'1px solid var(--border)',fontSize:'var(--fs-3)',color:'var(--muted)'}}>
            <span style={{fontStyle:'italic',fontWeight:600}}>fx</span>
            <span style={{fontVariantNumeric:'tabular-nums'}}>=IRR($C$45:$J$45)</span>
          </div>
          {[['Purchase Price','$7,750,000',1],['Exit Cap Rate','5.75%',1],['Vacancy & Credit Loss','5.0%',1],
            ['Net Operating Income','=C12+C16',0],['Levered IRR',f.pct(r.ret.irr,1),0],['Equity Multiple',f.x(r.ret.em),0]].map((row,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'10px 16px',borderBottom:i<5?'1px solid var(--border)':'none',fontSize:'var(--fs-3)'}}>
              <span style={{color:'var(--muted)'}}>{row[0]}</span>
              <span style={{fontVariantNumeric:'tabular-nums',color:row[2]?'#0070c0':'var(--text)',fontWeight:row[2]?600:400}}>{row[1]}</span>
            </div>
          ))}
        </div>
      </Sec>

      {/* ── PIPELINE ── */}
      <Sec eyebrow="Your pipeline" title={<>Save deals. Compare them.<br/>Roll up the book.</>}
        foot={<button style={{...link,fontWeight:600}} onClick={onStart}>Run a deal &rarr;</button>}>
        <Row label="Save to the cloud" text="Create a free account to build analyses and keep every saved deal synced across devices."/>
        <Row label="Compare side by side" text="Line up any two saved deals metric for metric to see which one actually pencils."/>
        <Row label="Portfolio roll-up" text="Aggregate every saved deal into pooled IRR, equity-weighted returns, and allocation by asset type."/>
      </Sec>

      {/* ── CLOSE ── */}
      <div style={{borderTop:'1px solid var(--text)'}}>
        <div style={{...WRAP,padding:'64px 24px 80px'}}>
          <h2 style={{fontSize:'clamp(24px,3.4vw,36px)',fontWeight:600,letterSpacing:'-.028em',lineHeight:1.15,marginBottom:14,maxWidth:620}}>Underwrite your next deal in minutes.</h2>
          <p style={{color:'var(--muted)',fontSize:'var(--fs-5)',marginBottom:28,maxWidth:560,lineHeight:1.6}}>Free while in early access. Runs entirely in your browser &mdash; nothing to install.</p>
          <div style={{display:'flex',gap:26,flexWrap:'wrap',alignItems:'baseline'}}>
            <button style={{...link,fontWeight:600,fontSize:'var(--fs-5)'}} onClick={onStart}>Run a deal &rarr;</button>
            <button style={{...link,fontSize:'var(--fs-5)'}} onClick={onDemo}>See a finished analysis</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export{Landing};
