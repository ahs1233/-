// The 3000-bar check (reviewer, 2026-10-16): on one chart and in ONE page load (same data), the
// original and the gate 4 copy (calc_bars_count = 3000) of a version, read side by side; the
// comparison is ../js/check3000.mjs. Same runbook as gate4_run.mjs (backup, autosave off, page
// reloaded without saving before each pair, nothing saved, layout restored by restore.mjs).
//   node check3000_run.mjs <review_1_1 dir> <outDir> [15,60,240] [A,B,C]
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/alk/tradingview-mcp-jackson/package.json');
const CDP = require('chrome-remote-interface');

const [, , repoDir, outDir, tfArg = '15,60,240', vArg = 'A,B,C'] = process.argv;
mkdirSync(outDir, { recursive: true });
const log = (m) => { const s = `${new Date().toISOString()} ${m}`; console.log(s); appendFileSync(join(outDir, 'capture.log'), s + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIND = `(function(){var container=document.querySelector('.monaco-editor.pine-editor-monaco');if(!container)return null;var el=container,fk;for(var i=0;i<20;i++){if(!el)break;fk=Object.keys(el).find(function(k){return k.startsWith('__reactFiber$')});if(fk)break;el=el.parentElement}if(!fk)return null;var cur=el[fk];for(var d=0;d<15;d++){if(!cur)break;if(cur.memoizedProps&&cur.memoizedProps.value&&cur.memoizedProps.value.monacoEnv){var env=cur.memoizedProps.value.monacoEnv;if(env.editor&&typeof env.editor.getEditors==='function'){var eds=env.editor.getEditors();if(eds.length>0)return{editor:eds[0],env:env}}}cur=cur.return}return null})()`;
const CH = `window.TradingViewApi._activeChartWidgetWV.value()`;
const MS = `${CH}._chartWidget.model().model().mainSeries()`;

let c = null;
const pick = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).find((x) => x.type === 'page' && /tradingview\.com\/chart/i.test(x.url));
async function connect() { c = await CDP({ host: '127.0.0.1', port: 9222, target: (await pick()).id }); }
const ev = async (expr) => { const r = await c.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

async function guard() {
  const g = await ev(`(() => { const s = window.TradingViewApi._saveChartService; return { autoSave: s.autoSaveEnabled().value(), symbol: ${CH}.symbol() }; })()`);
  if (g.autoSave) throw new Error('autosave ON: stop');
  if (g.symbol !== 'OANDA:XAUUSD') throw new Error(`symbol ${g.symbol}: stop`);
}
const barsInfo = () => ev(`(() => { const b = ${MS}.bars(); return { res: ${CH}.resolution(), size: b.size(), first: b.size() ? b.valueAt(b.firstIndex())[0] : null, last: b.size() ? b.valueAt(b.lastIndex())[0] : null, loading: !!${MS}.isLoading() }; })()`);

// Reload without saving ("leave without saving" accepted), wait for the chart, then remove the
// layout's studies (they come back on the final reload) and open the Pine editor.
async function freshPage() {
  await guard();
  await c.Page.enable();
  c.Page.javascriptDialogOpening(async () => { await c.Page.handleJavaScriptDialog({ accept: true }); });
  await c.Page.reload({ ignoreCache: false });
  await sleep(12000);
  await c.close().catch(() => {});
  let ok = false;
  for (let k = 0; k < 40 && !ok; k++) {
    await sleep(2000);
    try { await connect(); const b = await barsInfo(); ok = b.size > 0 && !b.loading; if (!ok) await c.close(); } catch (e) { try { await c.close(); } catch {} }
  }
  if (!ok) throw new Error('chart did not come back after reload');
  await guard();
  await ev(`(() => { const ch = ${CH}; for (const x of ch.getAllStudies()) ch.removeEntity(x.id); return true; })()`);
  await sleep(800);
  await ev(`(async () => { if (!document.querySelector('.monaco-editor.pine-editor-monaco')) { const b = document.querySelector('[data-name="pine-dialog-button"]'); if (b) b.click(); }
    for (let i = 0; i < 50 && !document.querySelector('.monaco-editor.pine-editor-monaco'); i++) await new Promise((r) => setTimeout(r, 200)); return true; })()`);
  await sleep(1500);
}

async function loadRes(res) {
  await guard();
  await ev(`(${CH}.setResolution(${JSON.stringify(res)}), true)`); // not awaited: its promise can stay pending
  let b = null;
  for (let k = 0; k < 60; k++) { await sleep(1000); b = await barsInfo(); if (b.res === res && b.size > 0 && !b.loading) break; }
  if (!(b.res === res && b.size > 0 && !b.loading)) throw new Error(`res ${res} did not load ${JSON.stringify(b)}`);
  await sleep(1500);
  b = await barsInfo();
  log(`res ${res}: ${b.size} chart bars ${new Date(b.first * 1000).toISOString()} → ${new Date(b.last * 1000).toISOString()}`);
}
async function dumpBars(res, name = `bars_${res}.json`) {
  const s = await ev(`(() => { const b = ${MS}.bars(); const out = []; for (let i = b.firstIndex(); i <= b.lastIndex(); i++) { const v = b.valueAt(i); if (v) out.push(v.slice(0, 6)); }
    return JSON.stringify({ symbol: ${CH}.symbol(), resolution: ${CH}.resolution(), capturedAt: new Date().toISOString(), bars: out }); })()`);
  writeFileSync(join(outDir, name), s);
  log(`${name} ${JSON.parse(s).bars.length} bars sha256 ${createHash('sha256').update(s).digest('hex').slice(0, 16)}`);
}

// The pair of each version: the original first (frozen B / C; for A the export-only copy without
// calc_bars_count, A's frozen file exports no lamp), then the gate 4 copy with calc_bars_count = 3000.
const PAIRS = {
  A: [['orig', 'diag/lastgtg_A_diag_full.pine', 'lastgtg A diag full — export only'], ['diag', 'diag/lastgtg_A_diag.pine', 'lastgtg A diag gate4 — export only']],
  B: [['orig', 'build/lastgtg_B_1_1.pine', 'lastgtg B 1.1 — Structural Zone Engine'], ['diag', 'diag/lastgtg_B_diag.pine', 'lastgtg B diag gate4 — export only']],
  C: [['orig', 'build/lastgtg_C_1_1.pine', 'lastgtg C 1.1 — Structural Zone Engine'], ['diag', 'diag/lastgtg_C_diag.pine', 'lastgtg C diag gate4 — export only']],
};
const findSrc = (desc) => `${CH}._chartWidget.model().model().dataSources().find(d => d.metaInfo && d.metaInfo() && (d.metaInfo().description || '') === ${JSON.stringify(desc)})`;

async function addStudy(file, desc, nExpected) {
  await guard();
  const src = readFileSync(join(repoDir, file), 'utf8').replace(/\r\n/g, '\n');
  await ev(`(() => { const m = ${FIND}; if (!m) throw new Error('no monaco'); m.editor.setValue(${JSON.stringify(src)}); return true; })()`);
  const back = await ev(`(() => ${FIND}.editor.getValue())()`);
  if (back !== src) throw new Error('editor text differs from the file');
  const labels = await ev(`(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => (b.getAttribute('aria-label') || b.title || '').trim()).filter(x => /chart/i.test(x)))()`);
  const clicked = await ev(`(() => { const add = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).find(b => /^Add to chart$/i.test((b.getAttribute('aria-label') || b.title || b.textContent || '').trim())); if (!add) return false; add.click(); return true; })()`);
  if (!clicked) throw new Error(`no "Add to chart" button (visible: ${labels})`);
  const t0 = Date.now();
  let st = null, lastSize = -1, same = 0;
  for (let k = 0; k < 150; k++) {
    await sleep(2000);
    st = await ev(`(() => { const src = ${findSrc(desc)}; const n = ${CH}.getAllStudies().length;
      if (!src) return { found: false, n }; let s = null; try { const x = src.status(); s = x && (x.value ? x.value() : x); } catch (e) {}
      return { found: true, n, type: s ? s.type : null, err: s && s.errorDescription ? JSON.stringify(s.errorDescription).slice(0, 400) : null, size: src.data().size() }; })()`);
    if (st.err) throw new Error(`${desc}: study error ${st.err}`);
    if (st.found && st.type === 2 && st.size > 0) { same = st.size === lastSize ? same + 1 : 0; lastSize = st.size; if (same >= 2) break; }
  }
  if (!(st.found && st.type === 2 && st.size > 0)) throw new Error(`${desc}: not loaded ${JSON.stringify(st)}`);
  if (st.n !== nExpected) throw new Error(`${desc}: chart holds ${st.n} studies, expected ${nExpected} (the second add replaced the first?)`);
  log(`${desc}: loaded in ${Math.round((Date.now() - t0) / 1000)} s, ${st.size} rows, chart studies ${st.n}`);
}
async function readStudy(desc, file) {
  const s = await ev(`(() => { const src = ${findSrc(desc)};
    const mi = src.metaInfo(), d = src.data(), b = ${MS}.bars();
    const titles = mi.plots.map(p => (mi.styles && mi.styles[p.id] && mi.styles[p.id].title) || p.id);
    const rows = []; for (let i = d.firstIndex(); i <= d.lastIndex(); i++) { const r = d.valueAt(i); if (r) rows.push([i].concat(Array.from(r, x => (x === undefined ? null : x)))); }
    return JSON.stringify({ desc: mi.description, resolution: ${CH}.resolution(), symbol: ${CH}.symbol(), capturedAt: new Date().toISOString(), liveBarTime: b.valueAt(b.lastIndex())[0], chartBars: b.size(), titles, rows }); })()`);
  writeFileSync(join(outDir, file), s);
  log(`${file} ${JSON.parse(s).rows.length} rows sha256 ${createHash('sha256').update(s).digest('hex').slice(0, 16)}`);
}

await connect();
for (const res of tfArg.split(',').filter(Boolean)) for (const v of vArg.split(',').filter(Boolean)) {
  await freshPage();
  await loadRes(res);
  const pre = await ev(`(() => { const title = [...document.querySelectorAll('button,div,span')].map(e => e.textContent.trim()).find(x => /^Untitled/.test(x)) || null; return { untitled: !!title, studies: ${CH}.getAllStudies().map(x => x.name) }; })()`);
  if (!pre.untitled) throw new Error('editor is not on an Untitled script: stop');
  if (pre.studies.length) throw new Error(`chart has studies ${pre.studies}: stop`);
  const [o, d] = PAIRS[v];
  await addStudy(o[1], o[2], 1);
  await addStudy(d[1], d[2], 2);
  await readStudy(o[2], `pair_${res}_${v}_orig.json`);
  await readStudy(d[2], `pair_${res}_${v}_diag.json`);
  await dumpBars(res, `bars_${res}_pair_${v}.json`);
  await ev(`(() => { const ch = ${CH}; for (const x of ch.getAllStudies()) ch.removeEntity(x.id); return true; })()`);
}
log('done');
await c.close();
