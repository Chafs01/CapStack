// LIHTC credit calculation and sources & uses.
function calcLIHTC(inp,permLoan){
  const land=inp.landCost||inp.purchasePrice||0;
  const hard=(inp.grossBuildableSF||0)*(inp.hardCostPerSF||0);
  const soft=hard*(inp.softCostsPct||0)/100;
  const devFee=inp.developerFee||0;
  const totalUses=land+hard+soft+devFee;
  const ebPct=(inp.eligibleBasisPct!=null?inp.eligibleBasisPct:95)/100;
  const eligibleBasis=(hard+soft+devFee)*ebPct;
  const boostPct=inp.qctDda?130:100;
  const boostedBasis=eligibleBasis*boostPct/100;
  const af=(inp.affordablePct!=null?inp.affordablePct:100)/100;
  const qualifiedBasis=boostedBasis*af;
  const creditRate=(inp.creditRate!=null?inp.creditRate:(String(inp.creditType)==='4'?4:9))/100;
  const annualCredit=qualifiedBasis*creditRate;
  const tenYearCredits=annualCredit*10;
  const creditPrice=inp.creditPrice!=null?inp.creditPrice:0.90;
  const lihtcEquity=tenYearCredits*creditPrice;
  const softSources=inp.softSources||0;
  const beforeDefer=permLoan+lihtcEquity+softSources;
  const gapBeforeDefer=totalUses-beforeDefer;
  const maxDeferrable=devFee*((inp.maxDeferPct!=null?inp.maxDeferPct:100)/100);
  const deferredFee=Math.max(0,Math.min(gapBeforeDefer,maxDeferrable));
  const totalSources=beforeDefer+deferredFee;
  const fundingGap=totalUses-totalSources;
  const cashDevFee=devFee-deferredFee;
  return{land,hard,soft,devFee,cashDevFee,totalUses,ebPct,eligibleBasis,boostPct,boostedBasis,
    applicableFraction:af,qualifiedBasis,creditRate,annualCredit,tenYearCredits,creditPrice,
    lihtcEquity,softSources,permLoan,gapBeforeDefer,deferredFee,maxDeferrable,totalSources,fundingGap};
}

export{calcLIHTC};
