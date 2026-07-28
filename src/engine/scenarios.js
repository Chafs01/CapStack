import{buildPF}from'./buildPF.js';
// ─── SCENARIO ANALYSIS (downside / base / upside) ─────────────────────────
// Flexes the two biggest value drivers (rent growth, exit cap) plus vacancy
// to bracket the base case. Pure overlay: each case is a fresh buildPF.
function calcScenarios(res,inp){
  if((inp.assetType||'').toLowerCase()==='affordable')return null;
  const gD=inp.scenGrowthDelta!=null?inp.scenGrowthDelta:1;
  const cD=inp.scenCapDelta!=null?inp.scenCapDelta:0.5;
  const vD=inp.scenVacDelta!=null?inp.scenVacDelta:2;
  const isPPU=inp.exitMethod==='ppu';
  // a comp-priced deal has no exit cap to flex; move the $/unit instead
  const ppuDelta=inp.scenPpuDeltaPct!=null?inp.scenPpuDeltaPct:6;
  const baseG=inp.revenueGrowth||0, baseV=inp.vacancyRate||0;
  const baseC=isPPU?(inp.exitPPU||0):(inp.exitCapRate||0);
  const run=(g,c,v)=>{
    try{const r=buildPF({...inp,revenueGrowth:g,vacancyRate:Math.max(0,v),
      ...(isPPU?{exitPPU:Math.max(0,c)}:{exitCapRate:c})});
      return{irr:r.ret.irr,em:r.ret.em,dscr:r.sum.dscr,coc:r.sum.coc,proceeds:r.exit.proceeds,g,c,v:Math.max(0,v)};}
    catch(e){return null;}
  };
  return{
    downside:run(baseG-gD,isPPU?baseC*(1-ppuDelta/100):baseC+cD,baseV+vD),
    base:run(baseG,baseC,baseV),
    upside:run(baseG+gD,isPPU?baseC*(1+ppuDelta/100):baseC-cD,baseV-vD),
    deltas:{g:gD,c:cD,v:vD,ppuPct:ppuDelta,isPPU}
  };
}

export{calcScenarios};
