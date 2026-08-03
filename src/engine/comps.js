// ─── SALES COMPARABLES ────────────────────────────────────────────────────
// A comp-priced exit was a single number typed into a box: "$133,000 a unit".
// That is the *conclusion* of a comparable-sales analysis, not the analysis —
// and a lender or a partner asking "where did that come from" got no answer
// from the model, because the working-out lived in the user's head.
//
// So the comps themselves are recorded: what sold, for how much, how many
// units. The per-unit figure is derived from them, and the range is reported
// alongside, because three comps spanning $95K to $180K a unit is a different
// piece of evidence from three clustered at $130K even when the average
// matches.
//
// Deliberately NOT wired into the engine. The UI writes the derived figure
// into `exitPPU`, which stays the single source of truth every other module
// already reads. That keeps the sensitivity grid working — it overrides
// exitPPU directly to sweep scenarios — and means no existing calculation
// changes at all.

// A simple average of the per-unit prices, not total price over total units.
// Each comparable is one piece of evidence and gets one vote; weighting by
// size would let the largest building quietly set the number, which is not how
// anyone reads a comp set.
function compPPU(row){
  if(!row||typeof row!=='object')return null;
  const price=+row.price, units=+row.units;
  if(!isFinite(price)||!isFinite(units)||units<=0||price<=0)return null;
  return price/units;
}

function compsSummary(rows){
  const list=Array.isArray(rows)?rows:[];
  const vals=[];
  for(const r of list){const v=compPPU(r);if(v!=null)vals.push(v);}
  if(!vals.length)return{ppu:0,used:0,total:list.length,low:0,high:0,spread:0};
  const sum=vals.reduce((a,b)=>a+b,0);
  const ppu=sum/vals.length;
  const low=Math.min(...vals), high=Math.max(...vals);
  return{
    ppu,
    used:vals.length,          // comps with enough entered to price
    total:list.length,         // rows on screen, including blank ones
    low,high,
    // dispersion as a share of the average — a wide set is weak evidence
    spread:ppu>0?(high-low)/ppu:0,
  };
}

export{compPPU,compsSummary};
