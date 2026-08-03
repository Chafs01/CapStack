import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';

// GitHub Pages serves static files and knows nothing about client-side routes,
// so a reload of /analysis or a link straight to /account would 404. Pages does
// serve 404.html for any path it cannot find, so shipping a copy of index.html
// under that name turns its not-found page into the app, which then reads the
// path and renders the right screen. Without this, every address this app now
// hands out is broken the moment someone reloads it.
// Copied after the write rather than emitted into the bundle: Vite's own HTML
// plugin produces index.html late, so a generateBundle hook here runs before
// there is anything to copy.
function pagesSpaFallback(){
  let outDir='dist';
  return{
    name:'pages-spa-fallback',
    apply:'build',
    configResolved(cfg){outDir=cfg.build.outDir;},
    closeBundle(){
      const from=path.resolve(outDir,'index.html');
      const to=path.resolve(outDir,'404.html');
      if(fs.existsSync(from))fs.copyFileSync(from,to);
    },
  };
}

export default defineConfig({
  plugins: [react(),pagesSpaFallback()],
  server: { port: 8420 },
});
