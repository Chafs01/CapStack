// Core financial math: payment, amortization, IRR (Newton + bisection fallback), NPV.
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

export{monthlyPmt,loanBal,calcIRR,calcNPV};
