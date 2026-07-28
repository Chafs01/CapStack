import{Component}from'react';
// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────
// Without one of these, a single throw anywhere in the results tree unmounts
// the whole app: the dashboard disappears, the user lands back on the landing
// page, and nothing says why. Their inputs are still in state, so the useful
// thing is to say so and offer the way back to them.
class ErrorBoundary extends Component{
  constructor(props){super(props);this.state={err:null};}
  static getDerivedStateFromError(err){return{err};}
  componentDidCatch(err,info){
    // eslint-disable-next-line no-console
    console.error('Results failed to render:',err,info&&info.componentStack);
  }
  componentDidUpdate(prev){
    // a new deal deserves a fresh attempt rather than a stuck error screen
    if(prev.resetKey!==this.props.resetKey&&this.state.err)this.setState({err:null});
  }
  render(){
    if(!this.state.err)return this.props.children;
    return(
      <div className="card" style={{padding:'26px 24px'}}>
        <div style={{fontSize:'var(--fs-6)',fontWeight:600,marginBottom:8}}>This analysis could not be displayed</div>
        <p style={{fontSize:'var(--fs-4)',color:'var(--muted)',lineHeight:1.6,marginBottom:18}}>
          Something in this combination of assumptions broke the results view. Your inputs are safe &mdash;
          go back and adjust them, and if it keeps happening, the combination that caused it is worth reporting.
        </p>
        <div style={{display:'flex',gap:20,flexWrap:'wrap',alignItems:'baseline'}}>
          {this.props.onBack&&<button className="btn-p" onClick={this.props.onBack}>&larr; Back to inputs</button>}
        </div>
        <details style={{marginTop:18}}>
          <summary style={{cursor:'pointer',fontSize:'var(--fs-3)',color:'var(--muted2)'}}>Technical detail</summary>
          <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:'var(--fs-2)',color:'var(--muted)',marginTop:8}}>
            {String(this.state.err&&(this.state.err.stack||this.state.err.message||this.state.err))}
          </pre>
        </details>
      </div>
    );
  }
}
export{ErrorBoundary};
