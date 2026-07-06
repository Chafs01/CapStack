import{calcIRR}from'./finance.js';
// ─── EQUITY WATERFALL (LP / GP promote) ───────────────────────────────────
// Standard real estate PE waterfall: return of capital + preferred return,
// then tiered promote splits at LP IRR hurdles. Tiers are LP IRR bands; the
// partnership cash in each band is split by the stated LP/GP share.
function calcWaterfall(res,inp){
  const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
  const E=res.equity||0;
  if(E<=0)return null;
  const lpShare=(inp.lpSharePct!=null?inp.lpSharePct:90)/100;
  const gpShare=1-lpShare;
  const pref=(inp.prefRate!=null?inp.prefRate:8)/100;
  // tiers: ascending LP IRR hurdles with LP share of cash in each band.
  // Tier 1 = pref (pro-rata). Then promote tiers. Final tier = residual split.
  const h2=(inp.hurdle2!=null?inp.hurdle2:12)/100;
  const h3=(inp.hurdle3!=null?inp.hurdle3:15)/100;
  const s1=lpShare;                                   // through pref: pro-rata
  const s2=(inp.lpTier2!=null?inp.lpTier2:80)/100;    // pref -> h2
  const s3=(inp.lpTier3!=null?inp.lpTier3:70)/100;    // h2 -> h3
  const s4=(inp.lpTier4!=null?inp.lpTier4:60)/100;    // above h3
  const tiers=[{h:pref,sL:s1},{h:h2,sL:s2},{h:h3,sL:s3}];
  // partnership distributable cash each year (levered equity CF, positives only)
  const cash=[];
  for(let y=1;y<=hp;y++){
    const r=res.rows[y-1];
    let c=r?r.cfbt:0;
    if(y===hp)c+=res.exit?res.exit.proceeds:0;
    cash.push(Math.max(0,c));
  }
  // LP hurdle balances: amount LP must still receive to hit each hurdle.
  const lpBal=tiers.map(()=>lpShare*E);   // LP contributed lpShare*E at t0
  const lpDist=[], gpDist=[];
  for(let y=0;y<hp;y++){
    // accrue hurdle balances one year
    for(let i=0;i<tiers.length;i++)lpBal[i]*=(1+tiers[i].h);
    let avail=cash[y], lpY=0, gpY=0;
    for(let i=0;i<tiers.length&&avail>1e-9;i++){
      const room=Math.max(0,lpBal[i]);           // LP $ still needed to hit hurdle i
      if(room<=1e-9)continue;
      const tierCash=Math.min(avail, room/tiers[i].sL); // partnership cash; LP gets sL of it
      const lpCut=tierCash*tiers[i].sL, gpCut=tierCash-lpCut;
      lpY+=lpCut; gpY+=gpCut; avail-=tierCash;
      for(let j=0;j<tiers.length;j++)lpBal[j]-=lpCut; // LP cash counts toward all hurdles
    }
    if(avail>1e-9){ // residual above top hurdle
      lpY+=avail*s4; gpY+=avail*(1-s4);
      for(let j=0;j<tiers.length;j++)lpBal[j]-=avail*s4;
      avail=0;
    }
    lpDist.push(lpY); gpDist.push(gpY);
  }
  const lpEq=lpShare*E, gpEq=gpShare*E;
  const lpFlows=[-lpEq,...lpDist], gpFlows=[-gpEq,...gpDist];
  const lpTot=lpDist.reduce((a,b)=>a+b,0), gpTot=gpDist.reduce((a,b)=>a+b,0);
  const lpIRR=calcIRR(lpFlows), gpIRR=calcIRR(gpFlows);
  const gpPromote=gpTot-gpEq-(gpShare*(lpTot+gpTot)-gpEq); // GP take above its pro-rata share
  return{
    lpShare,gpShare,pref,tiers:[{label:'Preferred ('+(pref*100).toFixed(0)+'%)',sL:s1},
      {label:(pref*100).toFixed(0)+'% to '+(h2*100).toFixed(0)+'%',sL:s2},
      {label:(h2*100).toFixed(0)+'% to '+(h3*100).toFixed(0)+'%',sL:s3},
      {label:'Above '+(h3*100).toFixed(0)+'%',sL:s4}],
    lpEq,gpEq,lpTot,gpTot,lpDist,gpDist,
    lpIRR,gpIRR,
    lpEM:lpEq>0?lpTot/lpEq:0, gpEM:gpEq>0?gpTot/gpEq:0,
    lpProfit:lpTot-lpEq, gpProfit:gpTot-gpEq,
    gpPromote:Math.max(0,gpTot-gpShare*(lpTot+gpTot))
  };
}

export{calcWaterfall};
