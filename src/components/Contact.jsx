import{CONTACT}from'./Legal.jsx';
// ─── CONTACT ──────────────────────────────────────────────────────────────
// A page rather than a mailto in the footer. A link that opens a mail client
// tells a visitor nothing before they click, and on a phone with no mail app
// configured it does nothing at all. This shows the address, so it can be read,
// copied, or written down.
//
// LINKEDIN is the company page, not a personal profile — this page is a way to
// reach SmartCapStack, and a founder's own profile does not belong on it. Left
// empty the section simply does not render, so a future change of address is a
// one-line edit rather than a broken link.
const LINKEDIN='https://www.linkedin.com/company/smart-cap-stack';

function Line({label,children,note}){
  return(
    <div style={{padding:'18px 0',borderTop:'1px solid var(--border)'}}>
      <div className="eyebrow" style={{marginBottom:6}}>{label}</div>
      <div style={{fontSize:'var(--fs-6)',color:'var(--text)',lineHeight:1.5,wordBreak:'break-word'}}>{children}</div>
      {note&&<div style={{fontSize:'var(--fs-3)',color:'var(--muted)',marginTop:5,lineHeight:1.55}}>{note}</div>}
    </div>
  );
}

function Contact({onBack}){
  const link={color:'var(--accent)',textDecoration:'none',borderBottom:'1px solid var(--border2)'};
  return(
    <div className="fu" style={{maxWidth:760,margin:'0 auto',padding:'32px 24px 60px'}}>
      <button className="btn-s" onClick={onBack} style={{marginBottom:20}}>← Back</button>
      <h2 style={{fontSize:'var(--fs-9)',fontWeight:700,marginBottom:6}}>Contact</h2>
      <p style={{fontSize:'var(--fs-5)',color:'var(--muted)',lineHeight:1.6,marginBottom:8}}>
        Questions about a deal the model got wrong, a feature you need, or anything
        else — email is read and answered by a person.
      </p>

      <Line label="Email" note="Bug reports, feature requests, and questions about how a figure is calculated.">
        <a href={`mailto:${CONTACT}?subject=${encodeURIComponent('SmartCapStack')}`} style={link}>{CONTACT}</a>
      </Line>

      {LINKEDIN&&(
        <Line label="LinkedIn" note="Product updates and announcements. Also fine for partnership or press enquiries.">
          <a href={LINKEDIN} target="_blank" rel="noopener noreferrer" style={link}>
            {LINKEDIN.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')}
          </a>
        </Line>
      )}

      <div style={{padding:'18px 0',borderTop:'1px solid var(--border)',fontSize:'var(--fs-3)',color:'var(--muted2)',lineHeight:1.6}}>
        SmartCapStack is a modelling tool, not a licensed advisor. Everything it
        produces is an estimate for informational purposes and is not financial,
        investment, tax, or legal advice.
      </div>
    </div>
  );
}

export{Contact,LINKEDIN};
