import{useState,useEffect}from'react';
// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────
function Fld({label,hint,value,onChange,prefix,suffix,disabled,type='text'}){
  const [txt,setTxt]=useState(value==null?'':String(value));
  const [foc,setFoc]=useState(false);
  useEffect(()=>{if(!foc)setTxt(value==null?'':String(value))},[value,foc]);
  return(
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:12.5,color:'#5f5f5f',marginBottom:5,fontWeight:600}}>
        {label}{hint&&<span style={{fontWeight:400,color:'#737373',fontSize:11}}> ({hint})</span>}
      </label>
      <div style={{position:'relative',display:'flex',alignItems:'center'}}>
        {prefix&&<span style={{position:'absolute',left:11,color:'#666666',fontSize:13,pointerEvents:'none'}}>{prefix}</span>}
        <input type={type} className="input-f" value={foc?txt:(value==null?'':String(value))} disabled={disabled}
          onFocus={()=>{setFoc(true);setTxt(value==null?'':String(value))}}
          onChange={e=>{setTxt(e.target.value);onChange(e.target.value)}}
          onBlur={()=>setFoc(false)}
          style={{paddingLeft:prefix?27:13,paddingRight:suffix?34:13}}/>
        {suffix&&<span style={{position:'absolute',right:11,color:'#666666',fontSize:13,pointerEvents:'none'}}>{suffix}</span>}
      </div>
    </div>
  );
}

function Slider({label,min,max,step,value,onChange,fmt2}){
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <label style={{fontSize:12.5,color:'#5f5f5f',fontWeight:600}}>{label}</label>
        <span style={{fontSize:13,color:'#3a5bf0',fontWeight:700}}>{fmt2?fmt2(value):value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))}/>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10.5,color:'#8c8c8c',marginTop:3}}>
        <span>{fmt2?fmt2(min):min}</span><span>{fmt2?fmt2(max):max}</span>
      </div>
    </div>
  );
}

function SecHdr({icon,children}){
  return(
    <div className="sect-lbl" style={{marginTop:20}}>
      {icon&&<span>{icon}</span>}{children}
    </div>
  );
}

function Chip({color,children}){
  return<span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:`${color}22`,color,fontWeight:700,letterSpacing:.3}}>{children}</span>;
}

export{Fld,Slider,SecHdr,Chip};
