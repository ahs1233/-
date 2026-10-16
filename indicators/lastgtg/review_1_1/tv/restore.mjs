// Runbook E-24/E-28 restore: put the editor's untitled draft back (the lab measure copy it held),
// reload the page without saving (accepting "leave without saving"), wait until the saved layout's
// studies are back with no changes, then turn autosave on. node restore.mjs <draft.pine>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/alk/tradingview-mcp-jackson/package.json');
const CDP = require('chrome-remote-interface');
const pick = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).find((x) => x.type === 'page' && /tradingview\.com\/chart/i.test(x.url));
let t = await pick();
let c = await CDP({ host: '127.0.0.1', port: 9222, target: t.id });
const ev = async (expr) => { const r = await c.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const FIND = `(function(){var container=document.querySelector('.monaco-editor.pine-editor-monaco');if(!container)return null;var el=container,fk;for(var i=0;i<20;i++){if(!el)break;fk=Object.keys(el).find(function(k){return k.startsWith('__reactFiber$')});if(fk)break;el=el.parentElement}if(!fk)return null;var cur=el[fk];for(var d=0;d<15;d++){if(!cur)break;if(cur.memoizedProps&&cur.memoizedProps.value&&cur.memoizedProps.value.monacoEnv){var env=cur.memoizedProps.value.monacoEnv;if(env.editor&&typeof env.editor.getEditors==='function'){var eds=env.editor.getEditors();if(eds.length>0)return{editor:eds[0],env:env}}}cur=cur.return}return null})()`;
if (await ev(`window.TradingViewApi._saveChartService.autoSaveEnabled().value()`)) throw new Error('autosave already ON: stop, nothing to restore safely');
const draft = readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const setDraft = await ev(`(() => { const m = ${FIND}; if (!m) return false; m.editor.setValue(${JSON.stringify(draft)}); return true; })()`);
await c.Page.enable();
c.Page.javascriptDialogOpening(async (p) => { await c.Page.handleJavaScriptDialog({ accept: true }); console.log('dialog accepted:', p.type, p.message?.slice(0, 80)); });
await c.Page.reload({ ignoreCache: false });
await new Promise((r) => setTimeout(r, 15000));
await c.close().catch(() => {});
t = await pick();
c = await CDP({ host: '127.0.0.1', port: 9222, target: t.id });
let st = null;
for (let k = 0; k < 60; k++) {
  await new Promise((r) => setTimeout(r, 3000));
  try {
    st = await ev(`(() => { const api = window.TradingViewApi; const ch = api._activeChartWidgetWV.value(); const s = api._saveChartService;
      return { studies: ch.getAllStudies().map(x => x.name), res: ch.resolution(), symbol: ch.symbol(), hasChanges: s.hasChanges(), autoSave: s.autoSaveEnabled().value() }; })()`);
    if (st.studies.length === 3 && !st.hasChanges) break;
  } catch (e) { st = { error: String(e) }; }
}
console.log('after reload', JSON.stringify(st));
if (st && st.studies && st.studies.length === 3 && !st.hasChanges) {
  await ev(`window.TradingViewApi._saveChartService.setAutoSaveEnabled(true)`);
  await new Promise((r) => setTimeout(r, 1000));
  console.log('final', JSON.stringify(await ev(`(() => { const s = window.TradingViewApi._saveChartService; return { autoSave: s.autoSaveEnabled().value(), hasChanges: s.hasChanges() }; })()`)), 'draftRestored', setDraft);
} else console.log('NOT restored: autosave left OFF; check manually');
await c.close();
