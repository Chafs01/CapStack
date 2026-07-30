// Renders a memo to a file so the document can be reviewed outside the app.
import fs from 'fs';
import {DEFS} from '../src/engine/defaults.js';
import {buildPF} from '../src/engine/buildPF.js';
import {memoHTML} from '../src/engine/memo.js';
// Deliberately unreal. A sample document should never carry a name or address
// that could be traced to an actual building, let alone somebody's home, with
// invented financials attached to it.
const inp={...DEFS.multifamily,propertyName:'Sample — Maple Court Apartments',address:'100 Example Way, Sampleton'};
const html=memoHTML(buildPF(inp),inp);
fs.writeFileSync(process.argv[2],html);
console.log('wrote',html.length,'bytes');
