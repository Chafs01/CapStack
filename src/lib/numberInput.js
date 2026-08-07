// Formatting for controlled numeric inputs while the user is still typing.
// Keep the editable pieces people need — a leading minus and a trailing decimal
// point — while grouping only the integer digits. Calculations receive the same
// text without commas, so formatting never changes the value being modelled.

function formatNumberInput(value){
  let s=String(value==null?'':value).replace(/,/g,'').trim();
  if(!s)return'';
  const neg=s.startsWith('-');
  s=s.replace(/-/g,'');
  const decimal=s.includes('.');
  const parts=s.split('.');
  const whole=(parts.shift()||'').replace(/\D/g,'');
  const fraction=parts.join('').replace(/\D/g,'');
  const grouped=whole.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  if(!grouped&&!decimal)return neg?'-':'';
  return(neg?'-':'')+grouped+(decimal?'.'+fraction:'');
}

const rawNumberInput=value=>String(value==null?'':value).replace(/,/g,'');

export{formatNumberInput,rawNumberInput};
