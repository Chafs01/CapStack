// Privacy Policy + Terms of Service. Plain-language, reflects what the app
// actually does. Not a substitute for legal review before scaling.
const UPDATED='July 7, 2026';
const CONTACT='support@smartcapstack.com';

function Section({title,children}){
  return(
    <div style={{marginBottom:26}}>
      <h3 style={{fontSize:16,fontWeight:700,marginBottom:8,fontFamily:"'Space Grotesk',sans-serif"}}>{title}</h3>
      <div style={{fontSize:14,color:'var(--muted)',lineHeight:1.65}}>{children}</div>
    </div>
  );
}

function Legal({tab='privacy',onTab,onBack}){
  return(
    <div className="fu" style={{maxWidth:760,margin:'0 auto',padding:'32px 24px 60px'}}>
      <button className="btn-s" onClick={onBack} style={{marginBottom:20}}>← Back</button>
      <div style={{display:'flex',gap:8,marginBottom:24}}>
        <button className={tab==='privacy'?'tab on':'tab off'} onClick={()=>onTab('privacy')}>Privacy Policy</button>
        <button className={tab==='terms'?'tab on':'tab off'} onClick={()=>onTab('terms')}>Terms of Service</button>
      </div>

      {tab==='privacy'?(
        <div>
          <h2 style={{fontSize:26,fontWeight:700,marginBottom:4}}>Privacy Policy</h2>
          <p style={{fontSize:12.5,color:'var(--muted2)',marginBottom:24}}>Last updated {UPDATED}</p>
          <Section title="Who we are">
            SmartCapStack is a web-based real estate underwriting tool that runs pro forma
            financial analyses in your browser. This policy explains what information we
            collect and how we use it.
          </Section>
          <Section title="What we collect">
            <b>If you use the calculator without an account,</b> your deal inputs stay in your
            own browser (local storage). We don't receive them.<br/><br/>
            <b>If you create an account,</b> we collect your email address, and — if you sign in
            with Google — your name and profile photo, through our authentication provider
            (Supabase). Deals you choose to save are stored in our database and tied to your account.<br/><br/>
            <b>Usage data.</b> We record basic, non-identifying events such as page views and
            technical error reports to keep the site working and understand overall usage. This
            does not include your deal figures.
          </Section>
          <Section title="How we use it">
            To provide the service — authenticate you, store and load your saved deals, keep the
            product reliable, and improve it. We do not sell your personal information, and we do
            not use it for advertising.
          </Section>
          <Section title="Who we share it with">
            We use trusted infrastructure providers to run the service: Supabase (authentication
            and database) and Google (only if you choose Google sign-in). Your data is processed
            by these providers solely to operate SmartCapStack. We don't share your information
            with anyone else except where required by law.
          </Section>
          <Section title="Your choices">
            You can use the calculator without an account. You can delete any saved deal at any
            time, and you can request deletion of your account and associated data by emailing
            us at {CONTACT}.
          </Section>
          <Section title="Data security">
            Saved deals are protected by row-level security so that each account can only access
            its own data. No method of storage or transmission is perfectly secure, but we take
            reasonable measures to protect your information.
          </Section>
          <Section title="Contact">
            Questions about this policy? Email {CONTACT}.
          </Section>
        </div>
      ):(
        <div>
          <h2 style={{fontSize:26,fontWeight:700,marginBottom:4}}>Terms of Service</h2>
          <p style={{fontSize:12.5,color:'var(--muted2)',marginBottom:24}}>Last updated {UPDATED}</p>
          <Section title="Acceptance">
            By using SmartCapStack, you agree to these terms. If you don't agree, please don't
            use the service.
          </Section>
          <Section title="Not financial advice">
            SmartCapStack is an informational tool. All outputs — including IRR, cash flows,
            returns, valuations, and Excel exports — are estimates based on assumptions you
            provide. They are <b>not</b> investment, financial, tax, or legal advice, and are not
            a recommendation to buy, sell, or finance any property. Always do your own diligence
            and consult qualified professionals before making decisions.
          </Section>
          <Section title="No warranty">
            The service is provided "as is," without warranties of any kind. We don't guarantee
            that calculations are accurate, complete, or suitable for your purposes, or that the
            service will be uninterrupted or error-free.
          </Section>
          <Section title="Limitation of liability">
            To the fullest extent permitted by law, SmartCapStack and its operators are not liable
            for any losses or damages arising from your use of — or reliance on — the service or
            its outputs.
          </Section>
          <Section title="Your account">
            You're responsible for keeping your login credentials secure and for activity under
            your account. Don't misuse the service, attempt to disrupt it, or use it unlawfully.
          </Section>
          <Section title="Changes">
            We may update these terms or the service over time. Continued use after changes means
            you accept the updated terms.
          </Section>
          <Section title="Contact">
            Questions? Email {CONTACT}.
          </Section>
        </div>
      )}
    </div>
  );
}

export{Legal};
