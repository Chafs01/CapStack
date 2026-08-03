// Core financial math: payment, amortization, IRR (Newton + bisection fallback), NPV.
//
// The hold period, clamped, lives here too — it was the same expression copied
// into ten engine and component files, so the ceiling could only be raised by
// finding all ten, and any one missed would quietly disagree with the rest
// about how long the deal runs.
//
// 20 years, not 10. Ten is a fund convention: an institution's hold is bounded
// by the life of its fund. Someone buying a fourplex to keep is on a 30-year
// amortisation and wants to watch the loan actually amortise, which the old
// ceiling made impossible to model. Past about ten years the compounding
// growth assumptions dominate everything else, so the later years are a
// projection rather than an underwrite — the wizard says so where it is set.
const MAX_HOLD=20;
// The pro forma always runs one year past the longest hold, because pricing an
// exit off a cap rate needs the following year's NOI.
const PF_YEARS=MAX_HOLD+1;
function holdPeriod(inp){
  return Math.min(Math.max((inp&&inp.holdingPeriod)||7,1),MAX_HOLD);
}
function monthlyPmt(P,r_annual,yrs){
  if(!P||P<=0)return 0;
  if(!r_annual||r_annual<=0)return P/(yrs*12);
  const r=r_annual/12,n=yrs*12;
  return P*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
}
function loanBal(P,r_annual,yrs,months){
  if(!P||P<=0)return 0;
  if(!r_annual||r_annual<=0)return Math.max(0,P-(P/(yrs*12))*months);
  const r=r_annual/12,n=yrs*12;
  const pmt=monthlyPmt(P,r_annual,yrs);
  return Math.max(0,P*Math.pow(1+r,months)-pmt*(Math.pow(1+r,months)-1)/r);
}
function calcIRR(cfs){
  if(!cfs||cfs.length<2)return NaN;
  const npvAt=r=>cfs.reduce((s,c,t)=>s+c/Math.pow(1+r,t),0);
  let r=0.12,ok=false;
  for(let i=0;i<600;i++){
    let npv=0,d=0;
    for(let t=0;t<cfs.length;t++){
      const disc=Math.pow(1+r,t);
      npv+=cfs[t]/disc;
      d-=t*cfs[t]/(disc*(1+r));
    }
    if(Math.abs(d)<1e-12)break;
    const nr=r-npv/d;
    if(Math.abs(nr-r)<1e-8){r=nr;ok=true;break;}
    r=Math.max(-0.99,Math.min(50,nr));
  }
  if(ok&&isFinite(r)&&Math.abs(npvAt(r))<1)return r;
  let lo=-0.95,hi=10;
  let fLo=npvAt(lo),fHi=npvAt(hi);
  if(fLo*fHi>0)return isFinite(r)?r:NaN;
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2,fM=npvAt(mid);
    if(Math.abs(fM)<1e-7)return mid;
    if(fLo*fM<0){hi=mid;fHi=fM}else{lo=mid;fLo=fM}
  }
  return (lo+hi)/2;
}
function calcNPV(cfs,rate){
  return cfs.reduce((s,c,t)=>s+c/Math.pow(1+rate,t),0);
}

export{monthlyPmt,loanBal,calcIRR,calcNPV,holdPeriod,MAX_HOLD,PF_YEARS};
