// Share links carry a whole deal in a URL, which makes two things load-bearing:
//
//  1. Round-trip fidelity. The recipient must recompute the sender's numbers
//     exactly — a link that renders a different IRR than the one the sender saw
//     is worse than no link at all.
//  2. Escaping. A deal used to be something you typed about your own property.
//     It can now arrive from a stranger, so any user string that reaches the
//     memo's HTML has to be inert.
import { encodeDeal, decodeDeal, shareURL } from '../src/lib/share.js';
import { openMemo } from '../src/engine/memo.js';
import { buildPF } from '../src/engine/buildPF.js';
import { DEFS } from '../src/engine/defaults.js';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log('  PASS', label);
  else { failures++; console.log('  FAIL', label, detail); }
};

// share.js and memo.js both reach for browser globals
globalThis.window = { location: { origin: 'https://smartcapstack.com', pathname: '/' } };
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

console.log('round-trip fidelity:');
for (const name of Object.keys(DEFS)) {
  const inp = DEFS[name];
  const payload = await encodeDeal(inp);
  const back = await decodeDeal(payload);
  check(`${name}: inputs survive the link`, JSON.stringify(back) === JSON.stringify(inp));
  check(`${name}: engine output identical for the recipient`,
    JSON.stringify(buildPF(back)) === JSON.stringify(buildPF(inp)));
  const url = shareURL(payload);
  check(`${name}: link is a usable length (${url.length} chars)`, url.length < 2000, url.length + ' chars');
}

console.log('malformed and hostile payloads:');
const b64url = (o) => 'r' + Buffer.from(JSON.stringify(o)).toString('base64url');
const rejected = {
  'random garbage': 'cZZZZnot-valid!!!',
  'truncated deflate stream': 'cbVLbbtswDP0Vg89a4Tp1',
  'empty payload': '',
  'marker only': 'c',
  'array instead of object': b64url([1, 2, 3]),
  'bare string': b64url('hello'),
  'null': b64url(null),
  'number': b64url(42),
};
for (const [label, payload] of Object.entries(rejected)) {
  let out;
  try { out = await decodeDeal(payload); } catch (e) { out = 'THREW: ' + e.message; }
  check(`rejects ${label}`, out === null, String(out));
}

console.log('the workbook carries a way back to the app:');
{
  const { buildWorkbook } = await import('../src/engine/excel.js');
  const inp = { ...DEFS.residential, propertyName: 'Link Back' };
  const res = buildPF(inp);
  const url = shareURL(await encodeDeal(inp));

  const withLink = await buildWorkbook(res, inp, true, url);
  const ws = withLink.getWorksheet('Summary');
  const cell = ws.getCell(4, 2).value;
  check('the link cell is a real hyperlink', !!(cell && cell.hyperlink), JSON.stringify(cell));
  check('it points at this deal, not a bare homepage', /[#&]d=/.test((cell && cell.hyperlink) || ''));
  const payload = /[#&]d=([A-Za-z0-9\-_]+)/.exec((cell && cell.hyperlink) || '')?.[1];
  const back = await decodeDeal(payload);
  check('the embedded link reopens the identical deal', JSON.stringify(back) === JSON.stringify(inp));
  check('the link fits comfortably in a cell and a mail client',
    (cell.hyperlink || '').length < 2000, String((cell.hyperlink || '').length));
  // the link occupies a row, so the blocks beneath it must move rather than collide
  check('the summary blocks shift down instead of being overwritten',
    ws.getCell(6, 2).value === 'PROPERTY & DEAL', String(ws.getCell(6, 2).value));

  // omitting the url must leave the workbook exactly as it was before
  const noLink = await buildWorkbook(res, inp, true);
  check('no link cell when no url is supplied', !noLink.getWorksheet('Summary').getCell(4, 2).value);
  check('and the original layout is untouched',
    noLink.getWorksheet('Summary').getCell(5, 2).value === 'PROPERTY & DEAL',
    String(noLink.getWorksheet('Summary').getCell(5, 2).value));
}

console.log('\nmemo escaping (a shared deal is untrusted input):');
const evil = {
  ...DEFS.multifamily,
  propertyName: '<img src=x onerror="window.__PWNED=1">',
  address: '</div><script>window.__PWNED2=1</script>',
};
let html = null;
globalThis.window.open = () => ({ document: { write: (h) => { html = h; }, close() {} } });
check('memo reports that its window opened',openMemo(buildPF(evil), evil)===true);
check('memo was generated', !!html);
check('no executable <script> reaches the memo', !/<script/i.test(html), (html.match(/<script[^>]*>/i) || [])[0]);
check('no <img> tag reaches the memo', !/<img/i.test(html), (html.match(/<img[^>]*>/i) || [])[0]);
check('the payload survives as inert visible text', html.includes('&lt;img src=x'));
const evilHtml = html;

// ...without mangling ordinary punctuation
const clean = { ...DEFS.multifamily, propertyName: 'Oak & Vine — "The Yard"', address: '12 Main St' };
html = null;
openMemo(buildPF(clean), clean);

// The decisive check: a hostile deal must produce the same tag inventory as an
// ordinary one. Scanning for `onerror=` would false-positive on the escaped
// text — what actually matters is that no new element was created at all.
const tags = (h) => (h.match(/<[a-z][a-z0-9]*/gi) || []).map((t) => t.toLowerCase()).sort().join(',');
check('a hostile deal creates no elements an ordinary deal does not',
  tags(evilHtml) === tags(html));
check('ampersands and quotes are escaped exactly once',
  html.includes('Oak &amp; Vine — &quot;The Yard&quot;') && !/&amp;(amp|quot|lt|gt);/.test(html));

// the memo must not render as dark-on-dark for a reader in dark mode
check('memo pins itself to a light background', /background:#fff/.test(html) && /color-scheme:light/.test(html));
let alerted=false;
globalThis.alert=()=>{alerted=true};
globalThis.window.open=()=>null;
check('blocked memo reports failure',openMemo(buildPF(clean),clean)===false);
check('blocked memo tells the user about pop-ups',alerted);

// and it should carry the cash flows, not just the narrative
check('memo includes the annual cash flow table', /ANNUAL CASH FLOW/.test(html) && /<table class="cf">/.test(html));
check('memo includes an exit breakdown', /Net Proceeds to Equity/.test(html));

if (failures) { console.log(`\n${failures} FAILURE(S) — share links or memo escaping regressed.`); process.exit(1); }
console.log('\nShare links round-trip exactly and the memo escapes untrusted input.');
