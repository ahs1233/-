// Loads one Pine file into the (unsaved, Untitled) Pine Editor and clicks "Add to chart".
// Refuses if autosave is on or if the editor shows a saved script name. Never saves.
//   node load_and_add.mjs <file.pine>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/alk/tradingview-mcp-jackson/package.json');
const CDP = require('chrome-remote-interface');
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const t = targets.find((x) => x.type === 'page' && /tradingview\.com\/chart/i.test(x.url));
const c = await CDP({ host: '127.0.0.1', port: 9222, target: t.id });
const ev = async (expr) => { const r = await c.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const FIND = `(function(){var container=document.querySelector('.monaco-editor.pine-editor-monaco');if(!container)return null;var el=container,fk;for(var i=0;i<20;i++){if(!el)break;fk=Object.keys(el).find(function(k){return k.startsWith('__reactFiber$')});if(fk)break;el=el.parentElement}if(!fk)return null;var cur=el[fk];for(var d=0;d<15;d++){if(!cur)break;if(cur.memoizedProps&&cur.memoizedProps.value&&cur.memoizedProps.value.monacoEnv){var env=cur.memoizedProps.value.monacoEnv;if(env.editor&&typeof env.editor.getEditors==='function'){var eds=env.editor.getEditors();if(eds.length>0)return{editor:eds[0],env:env}}}cur=cur.return}return null})()`;
const src = readFileSync(process.argv[2], 'utf8').replace(/\r\n/g, '\n');
const pre = await ev(`(() => { const s = window.TradingViewApi._saveChartService; const title = [...document.querySelectorAll('button,div,span')].map(e => e.textContent.trim()).find(x => /^Untitled/.test(x)) || null; return { autoSave: s.autoSaveEnabled().value(), untitled: !!title, studies: window.TradingViewApi._activeChartWidgetWV.value().getAllStudies().length }; })()`);
if (pre.autoSave) throw new Error('autosave ON: stop');
if (!pre.untitled) throw new Error('editor is not on an Untitled script: stop');
await ev(`(() => { const m = ${FIND}; if (!m) throw new Error('no monaco'); m.editor.setValue(${JSON.stringify(src)}); return true; })()`);
const back = await ev(`(() => { const m = ${FIND}; return m.editor.getValue().length; })()`);
const clicked = await ev(`(() => { const btns = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null);
  const add = btns.find(b => /^(Add to chart|Update on chart)$/i.test((b.getAttribute('aria-label') || b.title || b.textContent || '').trim()));
  if (!add) return { clicked: null, labels: btns.map(b => (b.getAttribute('aria-label') || b.title || '').trim()).filter(Boolean).slice(-25) };
  add.click(); return { clicked: (add.getAttribute('aria-label') || add.title || add.textContent).trim() }; })()`);
await new Promise((r) => setTimeout(r, 8000));
const post = await ev(`(() => { const m = ${FIND}; const model = m.editor.getModel(); const marks = m.env.editor.getModelMarkers({ resource: model.uri }).map(k => ({ line: k.startLineNumber, msg: k.message, sev: k.severity }));
  const ch = window.TradingViewApi._activeChartWidgetWV.value(); return { markers: marks.slice(0, 20), studies: ch.getAllStudies().map(x => x.name), autoSave: window.TradingViewApi._saveChartService.autoSaveEnabled().value(),
  dialogs: [...document.querySelectorAll('[role=dialog]')].filter(d => d.offsetParent !== null).map(d => d.textContent.trim().slice(0, 200)) }; })()`);
console.log(JSON.stringify({ file: process.argv[2], srcLen: src.length, editorLen: back, pre, clicked, post }, null, 1));
await c.close();
