import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import{ErrorBoundary}from './components/ErrorBoundary.jsx';
import './index.css';

// Last line of defence. The inner boundaries keep a bad results view or a bad
// deal list from taking the rest of the app with them; this one exists so that
// nothing at all can leave the user staring at a blank white page.
// the app is alive, so the stale-cache guard in index.html can stand down
try{sessionStorage.removeItem('scs_stale_reload');}catch(e){}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
