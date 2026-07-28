// ─── DERIVED-FIGURE DISPLAY STATE ─────────────────────────────────────────
// A derived figure on a half-filled form has three states, not two, and
// collapsing them misleads:
//
//   idle — nothing has been entered that this figure depends on. The value is
//          unknown, not zero. "0.00%" is a false statement here, and colouring
//          it red accuses the user of a problem before they have typed a
//          character.
//   neg  — real inputs produce a non-positive result. That is a genuine
//          finding worth flagging.
//   ok   — a positive result.
//
// Kept free of React so the truth table can be tested directly.

// The income/expense figures depend on the operating inputs; until one of them
// is present there is nothing to derive.
function operatingStarted({gpi=0,egi=0,opex=0}={}){
  return gpi>0||egi>0||opex>0;
}

function toneFor(value,ready){
  if(!ready)return'idle';
  return value>0?'ok':'neg';
}

// Display decisions for the two headline figures on the income step.
// `capBasis` is the purchase price (or total development cost); a cap rate
// cannot be stated at all until it is known, independently of the NOI.
function summaryFigures({gpi=0,egi=0,opex=0,noi=0,capBasis=0,capR=0}={}){
  const started=operatingStarted({gpi,egi,opex});
  const capReady=started&&capBasis>0;
  return{
    started,
    noi:{ready:started,tone:toneFor(noi,started)},
    capR:{ready:capReady,tone:toneFor(capR,capReady)},
  };
}

export{operatingStarted,toneFor,summaryFigures};
