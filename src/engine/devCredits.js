import{calcIRR}from'./finance.js';
// ─── DEVELOPMENT TAX CREDITS (historic / brownfield / stacked) ────────────
// Each credit computed on its own basis x rate x syndication price. Credit
// equity stacks into development sources & uses as an additive overlay; the
// LIHTC module and base engine are untouched.
function calcDevCredits(res,inp){
  const src=inp.devCredits||[];
  if(!src.length)return null;
  const rows=src.map(r=>{
    const basis=+r.basis||0, ratePct=+r.rate||0, price=r.price!=null?+r.price:0.9;
    const credit=basis*(ratePct/100);
    return{type:r.type||'Other',basis,ratePct,price,credit,equity:credit*price};
  });
  const totalCredit=rows.reduce((a,b)=>a+b.credit,0);
  const totalEquity=rows.reduce((a,b)=>a+b.equity,0);
  const isAff=(inp.assetType||'').toLowerCase()==='affordable';
  const uses=res.totalCost||0;
  const loan=Math.max(0,(res.totalCost||0)-(res.equity||0));
  const lihtcEq=isAff&&res.lihtc?res.lihtc.lihtcEquity:0;
  const deferredFee=isAff&&res.lihtc?res.lihtc.deferredFee:0;
  const softSources=isAff&&res.lihtc?res.lihtc.softSources:0;
  const sponsorEquityBefore=isAff?Math.max(0,uses-loan-lihtcEq-deferredFee-softSources):(res.equity||0);
  const sponsorEquityAfter=Math.max(0,sponsorEquityBefore-totalEquity);
  let sponsorIRR=null, baseIRR=null;
  if(!isAff){
    baseIRR=res.ret.irr;
    const newEq=Math.max(1,(res.equity||0)-totalEquity);
    const hp=Math.min(Math.max(inp.holdingPeriod||7,1),10);
    const cf=[-newEq];
    for(let y=1;y<=hp;y++){let c=res.rows[y-1].cfbt;if(y===hp)c+=res.exit.proceeds;cf.push(c);}
    sponsorIRR=calcIRR(cf);
  }
  return{rows,totalCredit,totalEquity,uses,loan,lihtcEq,deferredFee,softSources,sponsorEquityBefore,sponsorEquityAfter,sponsorIRR,baseIRR,isAff};
}

export{calcDevCredits};
