import{useState,useEffect}from'react';
// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────

// Money/number fields get thousands separators when idle and right-aligned
// tabular numerals, so figures read like a statement instead of a serial number.
// Text fields (strings) are untouched and stay left-aligned.
function Fld({label,hint,value,onChange,prefix,suffix,disabled,type='text',align}){
  const [txt,setTxt]=useState(value==null?'':String(value));
  const [foc,setFoc]=useState(false);
  useEffect(()=>{if(!foc)setTxt(value==null?'':String(value))},[value,foc]);
  const numeric=typeof value==='number';
  const idle=value==null?'':(numeric&&Math.abs(value)>=1000?value.toLocaleString('en-US'):String(value));
  const right=align==='right'||(align===undefined&&numeric);
  return(
    <div style={{marginBottom:16}}>
      <label className="fld-l">
        {label}{hint&&<span className="fld-h"> ({hint})</span>}
      </label>
      <div style={{position:'relative',display:'flex',alignItems:'center'}}>
        {prefix&&<span className="fld-fix" style={{left:12}}>{prefix}</span>}
        <input type={type} className="input-f" data-num={right?'1':'0'} disabled={disabled}
          value={foc?txt:idle}
          onFocus={()=>{setFoc(true);setTxt(value==null?'':String(value))}}
          onChange={e=>{setTxt(e.target.value);onChange(e.target.value)}}
          onBlur={()=>setFoc(false)}
          style={{paddingLeft:prefix?26:13,paddingRight:suffix?36:13}}/>
        {suffix&&<span className="fld-fix" style={{right:12}}>{suffix}</span>}
      </div>
    </div>
  );
}

function Slider({label,min,max,step,value,onChange,fmt2}){
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:7}}>
        <label className="fld-l" style={{marginBottom:0}}>{label}</label>
        <span className="mono" style={{fontSize:'var(--fs-4)',color:'var(--accent)',fontWeight:700}}>{fmt2?fmt2(value):value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))}/>
      <div className="mono" style={{display:'flex',justifyContent:'space-between',fontSize:'var(--fs-1)',color:'var(--muted2)',marginTop:4}}>
        <span>{fmt2?fmt2(min):min}</span><span>{fmt2?fmt2(max):max}</span>
      </div>
    </div>
  );
}

// Section card — replaces the single giant white slab the wizard used to be.
function Card({title,sub,right,children,pad=true,style}){
  return(
    <div className="card" style={style}>
      {(title||right)&&(
        <div className="card-hd">
          <div style={{minWidth:0}}>
            {title&&<div className="card-t">{title}</div>}
            {sub&&<div className="card-s" style={{marginTop:3}}>{sub}</div>}
          </div>
          {right}
        </div>
      )}
      <div className={pad?'card-bd':undefined}>{children}</div>
    </div>
  );
}

// One metric cell, for use inside a .hair grid.
function Metric({label,value,sub,tone,tip}){
  return(
    <div className={'metric'+(tip?' tooltip-w':'')}>
      {tip&&<div className="tt">{tip}</div>}
      <div className="metric-l">{label}</div>
      <div className="metric-v" style={tone?{color:`var(--${tone})`}:undefined}>{value}</div>
      {sub&&<div className="metric-s">{sub}</div>}
    </div>
  );
}

// Pads a metric list so the hairline grid never leaves a half-drawn row.
function fillCells(n,cols){
  const r=n%cols;
  return r===0?[]:Array.from({length:cols-r},(_,i)=>i);
}

function SecHdr({icon,children}){
  return(
    <div className="sect-lbl" style={{marginTop:4}}>
      {icon&&<span>{icon}</span>}{children}
    </div>
  );
}

const CHIP_TONES={
  accent:['var(--accent-tint)','var(--accent)'],
  neutral:['var(--bg2)','var(--muted)'],
  pos:['var(--pos-tint)','var(--pos)'],
  warn:['var(--warn-tint)','var(--warn)'],
  neg:['var(--neg-tint)','var(--neg)'],
  purple:['var(--purple-tint)','var(--purple)'],
};
function Chip({tone='neutral',children}){
  const[bg,fg]=CHIP_TONES[tone]||CHIP_TONES.neutral;
  return<span style={{fontSize:'var(--fs-2)',padding:'4px 10px',borderRadius:20,background:bg,color:fg,fontWeight:700,letterSpacing:.2,whiteSpace:'nowrap'}}>{children}</span>;
}

export{Fld,Slider,Card,Metric,fillCells,SecHdr,Chip};
