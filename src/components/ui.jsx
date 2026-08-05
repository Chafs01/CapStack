import{useState,useEffect,useRef,useId}from'react';
// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────

// Money/number fields get thousands separators when idle and right-aligned
// tabular numerals, so figures read like a statement instead of a serial number.
// Text fields (strings) are untouched and stay left-aligned.
function Fld({label,hint,value,onChange,prefix,suffix,disabled,type='text',align}){
  const id=useId();
  const [txt,setTxt]=useState(value==null?'':String(value));
  const [foc,setFoc]=useState(false);
  useEffect(()=>{if(!foc)setTxt(value==null?'':String(value))},[value,foc]);
  const numeric=typeof value==='number';
  // An unfilled numeric field shows nothing, not a 0 you have to select and
  // delete before typing. A greyed 0 placeholder keeps it obvious the field
  // takes a number, and a blank entry still reads back as 0.
  const empty=value==null||(numeric&&value===0);
  const idle=empty?'':(numeric&&Math.abs(value)>=1000?value.toLocaleString('en-US'):String(value));
  const right=align==='right'||(align===undefined&&numeric);
  return(
    <div style={{marginBottom:16}}>
      <label className="fld-l" htmlFor={id}>
        {label}{hint&&<span className="fld-h"> ({hint})</span>}
      </label>
      <div style={{position:'relative',display:'flex',alignItems:'center'}}>
        {prefix&&<span className="fld-fix" style={{left:12}}>{prefix}</span>}
        <input id={id} type={type} className="input-f" data-num={right?'1':'0'} disabled={disabled}
          placeholder={numeric?'0':undefined}
          value={foc?txt:idle}
          onFocus={()=>{setFoc(true);setTxt(empty?'':String(value))}}
          onChange={e=>{setTxt(e.target.value);onChange(e.target.value)}}
          onBlur={()=>setFoc(false)}
          style={{paddingLeft:prefix?26:13,paddingRight:suffix?36:13}}/>
        {suffix&&<span className="fld-fix" style={{right:12}}>{suffix}</span>}
      </div>
    </div>
  );
}

// The bare input the row editors use. Same idle-formatting rule as Fld — a
// figure carries thousands separators when you aren't typing in it — but with
// no label or wrapper, since the editors lay out their own grid and supply
// their own $ / % prefix. Commas only ever appear when the field is blurred,
// so they never fight the cursor, and pn() strips them on the way back in.
function NumIn({value,onChange,placeholder='0',style,...rest}){
  const[txt,setTxt]=useState('');
  const[foc,setFoc]=useState(false);
  const n=+value||0;
  const raw=value==null||value===''?'':String(value);
  const idle=n===0?'':(Math.abs(n)>=1000?n.toLocaleString('en-US'):raw);
  return(
    <input className="input-f" inputMode="decimal" placeholder={placeholder}
      value={foc?txt:idle}
      onFocus={()=>{setFoc(true);setTxt(n===0?'':raw)}}
      onChange={e=>{setTxt(e.target.value);onChange(e.target.value)}}
      onBlur={()=>setFoc(false)}
      style={style} {...rest}/>
  );
}

function Slider({label,min,max,step,value,onChange,fmt2}){
  const id=useId();
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:7}}>
        <label className="fld-l" htmlFor={id} style={{marginBottom:0}}>{label}</label>
        <span className="mono" style={{fontSize:'var(--fs-4)',color:'var(--accent)',fontWeight:700}}>{fmt2?fmt2(value):value}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))}/>
      <div className="mono" style={{display:'flex',justifyContent:'space-between',fontSize:'var(--fs-1)',color:'var(--muted2)',marginTop:4}}>
        <span>{fmt2?fmt2(min):min}</span><span>{fmt2?fmt2(max):max}</span>
      </div>
    </div>
  );
}

// The (i) beside a section heading. Opens on hover for anyone with a mouse and
// on click for everyone else — the existing .tt tooltip is hover-only and
// hidden outright on touch, which is exactly the reader who most needs the
// explanation. Click also pins it open, so a long note can be read without
// keeping the pointer perfectly still.
function InfoDot({label,children}){
  const [pin,setPin]=useState(false);
  const [hov,setHov]=useState(false);
  const [kbd,setKbd]=useState(false);
  const wrap=useRef(null), btn=useRef(null);
  const open=pin||hov||kbd;
  useEffect(()=>{
    if(!pin)return;
    const away=e=>{if(wrap.current&&!wrap.current.contains(e.target))setPin(false)};
    const esc=e=>{if(e.key==='Escape'){setPin(false);setKbd(false);if(btn.current)btn.current.blur();}};
    document.addEventListener('mousedown',away);
    document.addEventListener('keydown',esc);
    return()=>{document.removeEventListener('mousedown',away);document.removeEventListener('keydown',esc)};
  },[pin]);
  return(
    <span className="info-w" ref={wrap}>
      <button type="button" className={'info-b'+(open?' on':'')} ref={btn}
        aria-label={label?`What is ${label}?`:'More information'} aria-expanded={open}
        onClick={()=>setPin(p=>!p)}
        onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        // Only keyboard focus opens it. A click focuses the button too, and
        // treating that as hover left the popover stuck open — Escape cleared
        // the pin while focus silently held it up.
        onFocus={e=>{try{if(e.target.matches(':focus-visible'))setKbd(true)}catch(_){}}}
        onBlur={()=>setKbd(false)}>i</button>
      {open&&<span className="info-p" role="tooltip">{children}</span>}
    </span>
  );
}

// A control that exists but is not yours yet. Shown rather than hidden, on
// purpose: a free user who never sees the button does not know the feature
// exists, so hiding it makes the product quietly smaller instead of making the
// upgrade wanted.
//
// Not a `disabled` button — disabled elements swallow mouse events in some
// browsers, which would make the explanation unreachable in exactly the place
// it is needed. aria-disabled says the same thing to assistive tech while
// leaving hover and tap working.
function LockedBtn({label,why,className='btn-s',style,onUpgrade}){
  const [pin,setPin]=useState(false);
  const [hov,setHov]=useState(false);
  const wrap=useRef(null);
  const open=pin||hov;
  useEffect(()=>{
    if(!pin)return;
    const away=e=>{if(wrap.current&&!wrap.current.contains(e.target))setPin(false)};
    const esc=e=>{if(e.key==='Escape')setPin(false)};
    document.addEventListener('mousedown',away);
    document.addEventListener('keydown',esc);
    return()=>{document.removeEventListener('mousedown',away);document.removeEventListener('keydown',esc)};
  },[pin]);
  return(
    <span className="info-w" ref={wrap} style={{marginLeft:0}}>
      <button type="button" className={className} aria-disabled="true"
        onClick={()=>setPin(p=>!p)}
        onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{...style,opacity:.42,cursor:'not-allowed'}}>
        {label} <span aria-hidden="true" style={{fontSize:'.85em'}}>&#128274;</span>
      </button>
      {open&&(
        <span className="info-p" role="tooltip" style={{textAlign:'center',maxWidth:260}}>
          {why}
          {onUpgrade&&(
            <button type="button" className="btn-p"
              onClick={e=>{e.stopPropagation();onUpgrade();}}
              style={{display:'block',width:'100%',marginTop:10,padding:'7px 12px',fontSize:'var(--fs-3)'}}>
              See plans
            </button>
          )}
        </span>
      )}
    </span>
  );
}

// Section card — replaces the single giant white slab the wizard used to be.
function Card({title,sub,right,info,children,pad=true,style}){
  return(
    <div className="card" style={style}>
      {(title||right)&&(
        <div className="card-hd">
          <div style={{minWidth:0}}>
            {title&&<div className="card-t">{title}{info&&<InfoDot label={title}>{info}</InfoDot>}</div>}
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

export{Fld,NumIn,Slider,Card,Metric,InfoDot,LockedBtn,fillCells,SecHdr,Chip};
