// ─── FORMATTERS ───────────────────────────────────────────────────────────
const f={
  $:(n,compact=true)=>{if(n==null||isNaN(n))return'$—';const s=n<0;const a=Math.abs(n);if(compact){if(a>=1e9)return`${s?'-':''}$${(a/1e9).toFixed(2)}B`;if(a>=1e6)return`${s?'-':''}$${(a/1e6).toFixed(2)}M`;if(a>=1e3)return`${s?'-':''}$${(a/1e3).toFixed(0)}K`;}return`${s?'-$':'$'}${a.toLocaleString('en-US',{maximumFractionDigits:0})}`},
  $f:(n)=>{if(n==null||isNaN(n))return'$—';return`${n<0?'-$':'$'}${Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0})}`},
  pct:(n,d=1)=>{if(n==null||isNaN(n))return'—%';return`${(n*100).toFixed(d)}%`},
  x:(n)=>{if(n==null||isNaN(n))return'—x';return`${n.toFixed(2)}x`},
  n:(n,d=2)=>{if(n==null||isNaN(n))return'—';return n.toFixed(d)},
};
const pn=(v,fb=0)=>{const n=parseFloat(String(v||'').replace(/[$,%]/g,''));return isNaN(n)?fb:n};

export{f,pn};
