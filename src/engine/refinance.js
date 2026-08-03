import{monthlyPmt,loanBal,calcIRR,holdPeriod}from'./finance.js';
// ─── REFINANCE / CASH-OUT EVENT ───────────────────────────────────────────
// Mid-hold refinance: a new loan is sized on the property's value at refi,
// the old loan is retired, net proceeds are returned to equity, and the
// remaining hold runs on the new debt. A pure overlay on the base result.
function calcRefinance(res,inp){
  const t=(inp.assetType||'').toLowerCase();
  if(!inp.refiEnabled||t==='affordable')return null;
  const hp=holdPeriod(inp);
  // A mid-hold refinance needs a hold to be in the middle of. With a one-year
  // hold the refi year clamps to 0 and the balance lookup runs off the front
  // of the schedule, which threw and took the whole dashboard down with it.
  if(hp<2)return null;
  const ry=Math.min(Math.max(Math.round(inp.refiYear||3),1),hp-1);
  const refiCap=(inp.refiCapRate!=null?inp.refiCapRate:(inp.exitCapRate||5.5))/100;
  // mid-hold value follows the same appraisal method as the exit
  const value=(inp.exitMethod==='ppu')
    ? (inp.exitPPU||0)*(inp.numUnits||0)*Math.pow(1+((inp.apprRate!=null?inp.apprRate:3)/100),ry)
    : (refiCap>0?res.rows[ry].noi/refiCap:0);
  const refiLTV=(inp.refiLTV!=null?inp.refiLTV:70)/100;
  const newLoan=Math.max(0,value*refiLTV);
  const oldBal=res.rows[ry-1].bal;
  const refiCosts=newLoan*((inp.refiCostPct!=null?inp.refiCostPct:1)/100);
  const cashOut=newLoan-oldBal-refiCosts;
  const newRate=(inp.refiRate!=null?inp.refiRate:(inp.interestRate||6))/100;
  const amort=inp.amortYears||30;
  const newDS=newLoan>0?monthlyPmt(newLoan,newRate,amort)*12:0;
  const newBalExit=loanBal(newLoan,newRate,amort,(hp-ry)*12);
  const equity=res.equity;
  const cf=[-equity];
  for(let y=1;y<=hp;y++){
    const ds=y<=ry?res.rows[y-1].ds:newDS;
    let c=res.rows[y-1].noi-ds;
    if(y===ry)c+=cashOut;
    if(y===hp)c+=(res.exit.netSale-newBalExit);
    cf.push(c);
  }
  const irr=calcIRR(cf);
  const dist=cf.slice(1).reduce((a,b)=>a+b,0);
  return{
    refiYear:ry,value,newLoan,oldBal,refiCosts,cashOut,newDS,newRate,amort,newBalExit,
    refiDSCR:newDS>0?res.rows[ry].noi/newDS:null,
    refiIRR:irr,baseIRR:res.ret.irr,refiEM:equity>0?dist/equity:0,baseEM:res.ret.em
  };
}

export{calcRefinance};
