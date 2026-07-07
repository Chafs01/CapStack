import{useState,useEffect}from'react';
import{f}from'../engine/format.js';
import{calcIRR}from'../engine/finance.js';
import{buildPF}from'../engine/buildPF.js';
import{ASSETS}from'./Step1.jsx';
import{loadDeals,loadDealsLocal,renameDeal,deleteDeal,migrateLocalDeals,updateDealNotes}from'../lib/deals.js';
function DealNotes({id,initial,user}){
  const [val,setVal]=useState(initial);
  const [open,setOpen]=useState(!!initial);
  if(!open)return(
    <button onClick={()=>setOpen(true)} style={{marginTop:10,marginLeft:33,background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12.5,padding:0,fontFamily:"'Sora',sans-serif"}}>+ Add notes</button>
  );
  return(
    <textarea value={val} placeholder="Notes: address, broker, thesis, next steps..."
      onChange={e=>{setVal(e.target.value);updateDealNotes(id,e.target.value,user);}}
      style={{marginTop:10,marginLeft:33,width:'calc(100% - 33px)',minHeight:54,padding:'9px 12px',border:'1px solid var(--border2)',borderRadius:8,fontSize:13,fontFamily:"'Sora',sans-serif",color:'var(--text)',resize:'vertical',outline:'none',background:'var(--surface2)'}}/>
  );
}

function calcPortfolio(deals){
  let stdEquity=0,affEquity=0,totalProceeds=0,totalNOI=0,wIRRnum=0,wEMnum=0,stdCount=0,affCount=0,affUses=0;
  const byType={}; const pooled=[];
  deals.forEach(d=>{
    let res; try{res=buildPF(d.inp);}catch(e){return;}
    const at=(d.inp.assetType||'').toLowerCase();
    byType[at]=byType[at]||{count:0,equity:0,label:(ASSETS.find(a=>a.id===at)||{}).label||at};
    byType[at].count++;
    if(at==='affordable'){
      affCount++; const eq=res.lihtc?res.lihtc.lihtcEquity:0; affEquity+=eq; affUses+=res.lihtc?res.lihtc.totalUses:0; byType[at].equity+=eq;
    } else {
      stdCount++; const eq=res.equity||0; stdEquity+=eq;
      totalProceeds+=res.exit.proceeds||0; totalNOI+=res.sum.noi||0;
      wIRRnum+=(res.ret.irr||0)*eq; wEMnum+=(res.ret.em||0)*eq; byType[at].equity+=eq;
      const hp=Math.min(Math.max(d.inp.holdingPeriod||7,1),10);
      pooled[0]=(pooled[0]||0)-eq;
      for(let y=1;y<=hp;y++){let c=res.rows[y-1].cfbt; if(y===hp)c+=res.exit.proceeds; pooled[y]=(pooled[y]||0)+c;}
    }
  });
  return{
    stdCount,affCount,total:stdCount+affCount,
    stdEquity,affEquity,totalEquity:stdEquity+affEquity,
    totalProceeds,totalNOI,affUses,
    wIRR:stdEquity>0?wIRRnum/stdEquity:0, wEM:stdEquity>0?wEMnum/stdEquity:0,
    pooledIRR:pooled.length>1?calcIRR(pooled):NaN,
    byType:Object.values(byType)
  };
}

function PortfolioView({onBack,user}){
  const [deals,setDeals]=useState([]);
  useEffect(()=>{loadDeals(user).then(setDeals);},[user]);
  const P=calcPortfolio(deals);
  const kpi=(label,val,sub)=>(
    <div className="glass" style={{padding:'18px 20px',flex:1,minWidth:150}}>
      <div style={{fontSize:11.5,color:'var(--muted)',marginBottom:5}}>{label}</div>
      <div className="mono" style={{fontSize:24,fontWeight:800,color:'var(--text)'}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:'var(--muted2)',marginTop:3}}>{sub}</div>}
    </div>
  );
  return(
    <div className="fu" style={{maxWidth:1080,margin:'0 auto',padding:'32px 24px 60px'}}>
      <button className="btn-s" onClick={onBack} style={{marginBottom:18}}>&larr; Back to saved deals</button>
      <h2 style={{fontSize:24,fontWeight:800,marginBottom:6}}>Portfolio Roll-Up</h2>
      <p style={{fontSize:12.5,color:'var(--muted)',marginBottom:20}}>Aggregated across {P.total} saved {P.total===1?'deal':'deals'}, recomputed live. The pooled IRR assumes deals begin at the same time.</p>
      {P.total===0?(
        <div className="glass" style={{padding:'48px 24px',textAlign:'center',color:'var(--muted)'}}>No saved deals to roll up yet.</div>
      ):(<>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14}}>
          {kpi('Total Equity',f.$(P.totalEquity),P.affEquity>0?f.$(P.stdEquity)+' std + '+f.$(P.affEquity)+' LIHTC':null)}
          {P.stdCount>0&&kpi('Pooled IRR',f.pct(P.pooledIRR,1),'across '+P.stdCount+' market-rate')}
          {P.stdCount>0&&kpi('Equity-Wtd IRR',f.pct(P.wIRR,1),'weighted average')}
          {P.stdCount>0&&kpi('Equity-Wtd Multiple',f.x(P.wEM),null)}
        </div>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:24}}>
          {P.stdCount>0&&kpi('Total Exit Proceeds',f.$(P.totalProceeds),null)}
          {P.stdCount>0&&kpi('Aggregate Yr-1 NOI',f.$(P.totalNOI),null)}
          {P.affCount>0&&kpi('LIHTC Equity',f.$(P.affEquity),P.affCount+' affordable')}
          {P.affCount>0&&kpi('Affordable Dev Cost',f.$(P.affUses),null)}
        </div>
        <div className="glass" style={{overflow:'hidden'}}>
          <table className="tbl">
            <thead><tr><th style={{textAlign:'left'}}>Asset Type</th><th>Deals</th><th>Equity</th><th>% of Book</th></tr></thead>
            <tbody>
              {P.byType.map((b,i)=>(
                <tr key={i}>
                  <td style={{fontWeight:600,color:'var(--text)'}}>{b.label}</td>
                  <td>{b.count}</td>
                  <td>{f.$(b.equity)}</td>
                  <td>{P.totalEquity>0?(b.equity/P.totalEquity*100).toFixed(1)+'%':'0%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );
}

function SavedDeals({onLoad,onClose,user,onSignIn,notify}){
  const [portfolio,setPortfolio]=useState(false);
  const [deals,setDeals]=useState([]);
  const [loadingDeals,setLoadingDeals]=useState(true);
  const [sel,setSel]=useState([]);
  const [compare,setCompare]=useState(false);
  const [localCount,setLocalCount]=useState(0);

  useEffect(()=>{
    setLoadingDeals(true);
    loadDeals(user).then(d=>{setDeals(d);setLoadingDeals(false);});
    setLocalCount(user?loadDealsLocal().length:0);
  },[user]);

  const migrate=async()=>{
    try{
      const n=await migrateLocalDeals(user);
      setLocalCount(0);
      const d=await loadDeals(user);
      setDeals(d);
      notify&&notify(n+' deal'+(n!==1?'s':'')+' uploaded to your account');
    }catch(e){alert('Upload failed: '+e.message);}
  };

  const del=async id=>{
    await deleteDeal(id,user);
    setDeals(d=>d.filter(x=>x.id!==id));
    setSel(s=>s.filter(x=>x!==id));
  };
  const [editingId,setEditingId]=useState(null);
  const [editName,setEditName]=useState('');
  const commitRename=async()=>{
    const id=editingId,name=editName.trim();
    setEditingId(null);
    if(!id||!name)return;
    try{
      await renameDeal(id,name,user);
      setDeals(ds=>ds.map(x=>x.id===id?{...x,name}:x));
      notify&&notify('Deal renamed');
    }catch(e){alert('Rename failed: '+e.message);}
  };
  const toggle=id=>setSel(sel.includes(id)?sel.filter(s=>s!==id):(sel.length<2?[...sel,id]:[sel[1],id]));
  const fmtDate=iso=>{try{return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch(e){return '';}};

  if(portfolio)return <PortfolioView onBack={()=>setPortfolio(false)} user={user}/>;
  if(compare&&sel.length===2){
    const a=deals.find(d=>d.id===sel[0]),b=deals.find(d=>d.id===sel[1]);
    if(a&&b)return <CompareView a={a} b={b} onBack={()=>setCompare(false)}/>;
  }
  return(
    <div className="fu" style={{maxWidth:1080,margin:'0 auto',padding:'32px 24px 60px'}}>
      {!user&&<div style={{background:'var(--accent-tint)',border:'1px solid var(--accent)',borderRadius:8,padding:'10px 16px',marginBottom:18,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <span style={{fontSize:13,color:'var(--accent)',fontWeight:500}}>Sign in to save deals to the cloud and access them from any device.</span>
        <button className="btn-p" style={{padding:'6px 14px',fontSize:12.5,flexShrink:0}} onClick={onSignIn}>Sign In</button>
      </div>}
      {user&&localCount>0&&<div style={{background:'var(--accent-tint)',border:'1px solid var(--accent)',borderRadius:8,padding:'10px 16px',marginBottom:18,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <span style={{fontSize:13,color:'var(--accent)',fontWeight:500}}>{localCount} deal{localCount!==1?'s':''} saved in this browser {localCount!==1?'are':'is'} not in your account yet.</span>
        <button className="btn-p" style={{padding:'6px 14px',fontSize:12.5,flexShrink:0}} onClick={migrate}>Upload to account</button>
      </div>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <h2 style={{fontSize:24,fontWeight:800}}>Saved Deals</h2>
        <div style={{display:'flex',gap:10}}>
          {sel.length===2&&<button className="btn-p" onClick={()=>setCompare(true)}>Compare selected</button>}
          {deals.length>0&&<button className="btn-s" onClick={()=>setPortfolio(true)}>Portfolio roll-up</button>}
          <button className="btn-s" onClick={onClose}>+ New analysis</button>
        </div>
      </div>
      {loadingDeals?(
        <div style={{padding:'48px 24px',textAlign:'center',color:'#8c8c8c',fontSize:14}}>Loading deals...</div>
      ):deals.length===0?(
        <div className="glass" style={{padding:'48px 24px',textAlign:'center',color:'#8c8c8c'}}>
          <div style={{fontSize:15,marginBottom:6}}>No saved deals yet.</div>
          <div style={{fontSize:13}}>Run an analysis and click Save to keep it here. {user?'Deals sync across devices.':'Deals stay in this browser.'}</div>
        </div>
      ):(
        <>
          <p style={{fontSize:12.5,color:'#8c8c8c',marginBottom:14}}>Select two deals to compare them side by side. {user?'Deals are synced to your account.':'Saved deals are stored in this browser only.'}</p>
          <div style={{display:'grid',gap:10}}>
            {deals.map(d=>{
              const s=d.summary||{}; const picked=sel.includes(d.id);
              return(
                <div key={d.id} className="glass" style={{padding:'16px 18px',borderColor:picked?'#3a5bf0':'#e2e6f0',borderWidth:picked?2:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                    <input type="checkbox" checked={picked} onChange={()=>toggle(d.id)} style={{width:17,height:17,accentColor:'#3a5bf0',flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      {editingId===d.id?(
                        <input className="input-f" autoFocus value={editName}
                          onChange={e=>setEditName(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={e=>{if(e.key==='Enter')commitRename();if(e.key==='Escape')setEditingId(null);}}
                          style={{fontWeight:700,fontSize:15,padding:'6px 10px',maxWidth:320}}/>
                      ):(
                        <div style={{fontWeight:700,fontSize:15,color:'#191919',display:'flex',alignItems:'center',gap:8}}>
                          {d.name}
                          <button onClick={()=>{setEditingId(d.id);setEditName(d.name);}} title="Rename"
                            style={{background:'none',border:'none',cursor:'pointer',color:'#8c8c8c',fontSize:13,padding:0,lineHeight:1}}>✎</button>
                        </div>
                      )}
                      <div style={{fontSize:12,color:'#8c8c8c'}}>{d.assetType} &middot; saved {fmtDate(d.savedAt)}</div>
                    </div>
                    <div style={{display:'flex',gap:20,fontSize:13,flexShrink:0}}>
                      {s.type==='affordable'?(
                        <><Metric l="LIHTC Equity" v={f.$(s.equity)}/><Metric l="DSCR" v={s.dscr?s.dscr.toFixed(2):'n/a'}/><Metric l="Gap" v={f.$(Math.abs(s.gap||0))}/></>
                      ):(
                        <><Metric l="IRR" v={f.pct(s.irr,1)}/><Metric l="Multiple" v={f.x(s.em)}/><Metric l="DSCR" v={s.dscr?s.dscr.toFixed(2):'n/a'}/></>
                      )}
                    </div>
                    <div style={{display:'flex',gap:8,flexShrink:0}}>
                      <button className="btn-s" style={{padding:'6px 14px',fontSize:13}} onClick={()=>onLoad(d)}>Open</button>
                      <button onClick={()=>del(d.id)} title="Delete" style={{background:'none',border:'1px solid #e2e6f0',borderRadius:3,color:'#b42318',cursor:'pointer',width:32,height:32,fontSize:16}}>&times;</button>
                    </div>
                  </div>
                  <DealNotes id={d.id} initial={d.notes||''} user={user}/>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
function Metric({l,v}){return(<div style={{textAlign:'right'}}><div style={{fontWeight:700,color:'#3a5bf0'}}>{v}</div><div style={{fontSize:10.5,color:'#8c8c8c'}}>{l}</div></div>);}

function CompareView({a,b,onBack}){
  const rA=buildPF(a.inp), rB=buildPF(b.inp);
  const isAff=x=>(x.inp.assetType||'').toLowerCase()==='affordable';
  const bothAff=isAff(a)&&isAff(b);
  const rows=bothAff?[
    ['Total Uses',d=>f.$(d.lihtc.totalUses)],
    ['LIHTC Equity',d=>f.$(d.lihtc.lihtcEquity)],
    ['Annual Credit',d=>f.$(d.lihtc.annualCredit)],
    ['Permanent Loan',d=>f.$(d.lihtc.permLoan)],
    ['Deferred Dev Fee',d=>f.$(d.lihtc.deferredFee)],
    ['Funding Gap',d=>f.$(d.lihtc.fundingGap)],
    ['Year 1 NOI',d=>f.$(d.sum.noi)],
    ['Year 1 DSCR',d=>d.sum.dscr?d.sum.dscr.toFixed(2)+'x':'n/a'],
  ]:[
    ['Levered IRR',d=>f.pct(d.ret.irr,1)],
    ['Equity Multiple',d=>f.x(d.ret.em)],
    ['Equity Required',d=>f.$(d.equity)],
    ['Year 1 Cap Rate',d=>f.pct(d.sum.capR,2)],
    ['Year 1 Cash-on-Cash',d=>f.pct(d.sum.coc,1)],
    ['Year 1 DSCR',d=>d.sum.dscr?d.sum.dscr.toFixed(2)+'x':'n/a'],
    ['Year 1 NOI',d=>f.$(d.sum.noi)],
    ['Net Sale Proceeds',d=>f.$(d.exit.proceeds)],
  ];
  return(
    <div className="fu" style={{maxWidth:1080,margin:'0 auto',padding:'32px 24px 60px'}}>
      <button className="btn-s" onClick={onBack} style={{marginBottom:18}}>← Back to saved deals</button>
      <h2 style={{fontSize:24,fontWeight:800,marginBottom:18}}>Deal Comparison</h2>
      <div className="glass" style={{overflow:'hidden'}}>
        <table className="tbl">
          <thead><tr>
            <th style={{textAlign:'left'}}>Metric</th>
            <th style={{textAlign:'right'}}>{a.name}</th>
            <th style={{textAlign:'right'}}>{b.name}</th>
          </tr></thead>
          <tbody>
            <tr className="sec"><td colSpan={3}>{a.assetType} vs. {b.assetType}</td></tr>
            {rows.map((r,i)=>(
              <tr key={i}>
                <td style={{fontWeight:600,color:'#5f5f5f'}}>{r[0]}</td>
                <td style={{textAlign:'right',fontWeight:700}}>{r[1](rA)}</td>
                <td style={{textAlign:'right',fontWeight:700}}>{r[1](rB)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{fontSize:12,color:'#8c8c8c',marginTop:12}}>Figures recalculated live from each saved deal's inputs.</p>
    </div>
  );
}

export{SavedDeals};
