// ─── URL ↔ VIEW ───────────────────────────────────────────────────────────
// The app was one address. Every screen — the wizard, the results, the account
// page, the legal text — lived at smartcapstack.com, so the browser's Back
// button had nothing of ours to go back to and left the site entirely. Anyone
// pressing Back after looking at a saved deal ended up wherever they came
// from, which for most people is a search results page.
//
// So each screen gets a path. This module is only the mapping, kept free of
// React and of the DOM so both directions can be tested directly: a path in,
// a view out, and back again without a browser.
//
// Steps are named rather than numbered. /new/income says what it is, survives
// a reordering of the wizard, and reads like something a person could type.
const STEP_SLUGS=['','property','income','financing'];

// The wizard's fifth "step" is the finished analysis, which is a destination
// rather than a step and gets its own address.
const RESULTS_STEP=4;

// /deals is deliberately separate from /account. The account page carries an
// email address and a plan; the deals list carries none of that, so it can be
// opened in front of an audience without showing anyone's personal details.
const STATIC={
  '/':{view:'landing'},
  '/signin':{view:'signin'},
  '/deals':{view:'deals'},
  '/account':{view:'profile'},
  '/contact':{view:'contact'},
  '/pricing':{view:'pricing'},
  '/privacy':{view:'legal',legalTab:'privacy'},
  '/terms':{view:'legal',legalTab:'terms'},
  '/analysis':{view:'app',step:RESULTS_STEP},
};

// Trailing slashes and casing are the two ways a hand-typed or link-shortened
// URL differs from the one we wrote, and neither should be a dead end.
function normalise(pathname){
  if(typeof pathname!=='string'||!pathname)return'/';
  let p=pathname.toLowerCase();
  if(p.length>1&&p.endsWith('/'))p=p.replace(/\/+$/,'');
  return p||'/';
}

// A view the router does not recognise resolves to null, and the caller sends
// it to the landing page rather than rendering a blank screen.
function routeFor(pathname){
  const p=normalise(pathname);
  if(Object.prototype.hasOwnProperty.call(STATIC,p))return{...STATIC[p]};
  if(p==='/new')return{view:'app',step:0};
  if(p.startsWith('/new/')){
    const slug=p.slice(5);
    const i=STEP_SLUGS.indexOf(slug);
    // index 0 is the empty slug, which /new already covers — "/new/" would
    // otherwise resolve here by accident
    if(i>0)return{view:'app',step:i};
  }
  return null;
}

function pathFor(state){
  const view=state&&state.view;
  if(view==='signin')return'/signin';
  if(view==='deals')return'/deals';
  if(view==='profile')return'/account';
  if(view==='contact')return'/contact';
  if(view==='pricing')return'/pricing';
  if(view==='legal')return (state.legalTab==='terms')?'/terms':'/privacy';
  if(view==='app'){
    const step=Math.max(0,Math.min(+state.step||0,RESULTS_STEP));
    if(step===RESULTS_STEP)return'/analysis';
    return step===0?'/new':`/new/${STEP_SLUGS[step]}`;
  }
  return'/';
}

// Two states are the same screen when they resolve to the same address —
// used to decide whether a state change is worth a history entry.
function sameRoute(a,b){return pathFor(a)===pathFor(b);}

export{routeFor,pathFor,sameRoute,normalise,STEP_SLUGS,RESULTS_STEP};
