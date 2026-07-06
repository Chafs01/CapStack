// Income & cost assembly from deal inputs.
function umGPI(m){return(m||[]).reduce((s,r)=>s+(+r.count||0)*(+r.rent||0)*12,0);}
function rtGPI(r){return(r||[]).reduce((s,x)=>s+(+x.sf||0)*(+x.rentPerSF||0),0);}
function getGPI(inp){
  const t=(inp.assetType||'').toLowerCase();
  const hasUM=inp.unitMix&&inp.unitMix.length;
  const hasRT=inp.retailIncome&&inp.retailIncome.length;
  const resGPI=hasUM?umGPI(inp.unitMix):(inp.numUnits||0)*(inp.avgRent||0)*12;
  if(t==='multifamily'||t==='affordable')return resGPI;
  if(t==='commercial')return(hasRT?rtGPI(inp.retailIncome):(inp.totalSF||0)*(inp.avgRentPerSF||0))+(inp.camIncome||0);
  if(t==='mixed-use')return resGPI+(hasRT?rtGPI(inp.retailIncome):(inp.commercialSF||0)*(inp.commercialRentPerSF||0));
  if(t==='development'){
    if(hasUM)return resGPI;
    if(inp.numUnits&&inp.avgRent)return(inp.numUnits||0)*(inp.avgRent||0)*12;
    return(inp.stabilizedNOI||0)/0.52;
  }
  return 0;
}
function getOpEx(inp){
  const gpi=getGPI(inp);
  const vac=inp.vacancyRate||0;
  const egi=gpi*(1-vac/100)+(inp.otherIncome||0);
  return(inp.propertyTax||0)+(inp.insurance||0)+egi*(inp.managementFeePct||0)/100+(inp.maintenance||0)+(inp.utilities||0)+(inp.reserves||0)+(inp.administrative||0);
}
function getDevCost(inp){
  const hard=(inp.grossBuildableSF||0)*(inp.hardCostPerSF||0);
  const soft=hard*(inp.softCostsPct||0)/100;
  const devFee=inp.developerFee||0;
  return(inp.landCost||inp.purchasePrice||0)+hard+soft+devFee;
}

export{umGPI,rtGPI,getGPI,getOpEx,getDevCost};
