import{formatNumberInput,rawNumberInput}from'../src/lib/numberInput.js';

let failures=0;
const check=(label,actual,want)=>{
  const ok=actual===want;
  if(ok)console.log('  PASS',label);
  else{failures++;console.log('  FAIL',label,JSON.stringify(actual),'!==',JSON.stringify(want));}
};

console.log('commas appear as the number grows:');
check('three digits',formatNumberInput('999'),'999');
check('four digits',formatNumberInput('1000'),'1,000');
check('seven digits',formatNumberInput('1000000'),'1,000,000');
check('already-formatted input is stable',formatNumberInput('1,000,000'),'1,000,000');
check('pasted currency is cleaned',formatNumberInput('$12,345,678'),'12,345,678');

console.log('\ndecimal editing remains natural:');
check('decimal value',formatNumberInput('1234.56'),'1,234.56');
check('trailing decimal survives',formatNumberInput('1234.'),'1,234.');
check('leading decimal survives',formatNumberInput('.75'),'.75');
check('negative value',formatNumberInput('-1234567.89'),'-1,234,567.89');
check('a minus can be the first keystroke',formatNumberInput('-'),'-');

console.log('\ncalculations receive unformatted text:');
check('commas are removed',rawNumberInput('1,234,567.89'),'1234567.89');
check('blank stays blank',rawNumberInput(''),'');

if(failures){console.log(`\n${failures} FAILURE(S) — live number formatting regressed.`);process.exit(1);}
console.log('\nLarge numbers stay readable while typing without changing their numeric value.');
