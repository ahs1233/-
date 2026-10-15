// Gate 4 capture (../TEST_PREREGISTRATION.md v1.1): on TradingView Desktop over CDP, for each
// chart timeframe, load the most history the chart gives, dump its bars, then add each
// export-only copy (../diag/lastgtg_<v>_diag.pine) ALONE through the unsaved Untitled editor,
// read every row the study computed (pre-history rows included, F-006) with its plot titles,
// and remove it. Then dump the bars of the HTF / anchor timeframes. Never saves anything.
// Preconditions (runbook E-24): layout backed up, autosave OFF, studies cleared, editor Untitled.
//   node gate4_run.mjs <diagDir> <outDir> [15,60,240] [A,B,C] [htf resolutions 15,60,240,1D,1W]
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/alk/tradingview-mcp-jackson/package.json');
const CDP = require('chrome-remote-interface');

const [, , diagDir, outDir, tfArg = '15,60,240', vArg = 'A,B,C', htfArg = '15,60,240,1D,1W'] = process.argv;
mkdirSync(outDir, { recursive: true });
const log = (m) => { const s = `${new Date().toISOString()} ${m}`; console.log(s); appendFileSync(join(outDir, 'capture.log'), s + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t = (await (await fetch('http://127.0.0.1:9222/json/list')).json()).find((x) => x.type === 'page' && /tradingview\.com\/chart/i.test(x.url));
const c = await CDP({ host: '127.0.0.1', port: 9222, target: t.id });
const ev = async (expr) => { const r = await c.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const FIND = `(function(){var container=document.querySelector('.monaco-editor.pine-editor-monaco');if(!container)return null;var el=container,fk;for(var i=0;i<20;i++){if(!el)break;fk=Object.keys(el).find(function(k){return k.startsWith('__reactFiber$')});if(fk)break;el=el.parentElement}if(!fk)return null;var cur=el[fk];for(var d=0;d<15;d++){if(!cur)break;if(cur.memoizedProps&&cur.memoizedProps.value&&cur.memoizedProps.value.monacoEnv){var env=cur.memoizedProps.value.monacoEnv;if(env.editor&&typeof env.editor.getEditors==='function'){var eds=env.editor.getEditors();if(eds.length>0)return{editor:eds[0],env:env}}}cur=cur.return}return null})()`;
const CH = `window.TradingViewApi._activeChartWidgetWV.value()`;
const MS = `${CH}._chartWidget.model().model().mainSeries()`;

async function guard() {
  const g = await ev(`(() => { const s = window.TradingViewApi._saveChartService; return { autoSave: s.autoSaveEnabled().value(), symbol: ${CH}.symbol() }; })()`);
  if (g.autoSave) throw new Error('autosave ON: stop');
  if (g.symbol !== 'OANDA:XAUUSD') throw new Error(`symbol ${g.symbol}: stop`);
}
const barsInfo = () => ev(`(() => { const b = ${MS}.bars(); return { res: ${CH}.resolution(), size: b.size(), first: b.size() ? b.valueAt(b.firstIndex())[0] : null, last: b.size() ? b.valueAt(b.lastIndex())[0] : null, loading: ${MS}.isLoading ? !!${MS}.isLoading() : null }; })()`);

// Switch resolution, then ask for more history until the first bar stops moving.
async function loadRes(res) {
  await guard();
  await ev(`(${CH}.setResolution(${JSON.stringify(res)}), true)`); // not awaited: its promise can stay pending
  let b = null;
  for (let k = 0; k < 60; k++) { await sleep(1000); b = await barsInfo(); if (b.res === res && b.size > 0 && !b.loading) break; }
  let stable = 0;
  for (let k = 0; k < 40 && stable < 3; k++) {
    const before = b.first;
    await ev(`(() => { const m = ${MS}; if (m.requestMoreData) m.requestMoreData(5000); return true; })()`);
    await sleep(2500);
    b = await barsInfo();
    stable = b.first === before ? stable + 1 : 0;
  }
  log(`res ${res}: ${b.size} chart bars ${new Date(b.first * 1000).toISOString()} → ${new Date(b.last * 1000).toISOString()}`);
  return b;
}
async function dumpBars(res) {
  const s = await ev(`(() => { const b = ${MS}.bars(); const out = []; for (let i = b.firstIndex(); i <= b.lastIndex(); i++) { const v = b.valueAt(i); if (v) out.push(v.slice(0, 6)); }
    return JSON.stringify({ symbol: ${CH}.symbol(), resolution: ${CH}.resolution(), capturedAt: new Date().toISOString(), bars: out }); })()`);
  const f = join(outDir, `bars_${res}.json`);
  writeFileSync(f, s);
  log(`bars_${res}.json ${JSON.parse(s).bars.length} bars sha256 ${createHash('sha256').update(s).digest('hex').slice(0, 16)}`);
}

async function runStudy(res, v) {
  await guard();
  const desc = `lastgtg ${v} diag gate4`;
  const src = readFileSync(join(diagDir, `lastgtg_${v}_diag.pine`), 'utf8').replace(/\r\n/g, '\n');
  const pre = await ev(`(() => { const title = [...document.querySelectorAll('button,div,span')].map(e => e.textContent.trim()).find(x => /^Untitled/.test(x)) || null; return { untitled: !!title, studies: ${CH}.getAllStudies().map(x => x.name) }; })()`);
  if (!pre.untitled) throw new Error('editor is not on an Untitled script: stop');
  if (pre.studies.length) throw new Error(`chart has studies ${pre.studies}: stop`);
  await ev(`(() => { const m = ${FIND}; if (!m) throw new Error('no monaco'); m.editor.setValue(${JSON.stringify(src)}); return true; })()`);
  const back = await ev(`(() => ${FIND}.editor.getValue())()`);
  if (back !== src) throw new Error('editor text differs from the file');
  const clicked = await ev(`(() => { const add = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).find(b => /^Add to chart$/i.test((b.getAttribute('aria-label') || b.title || b.textContent || '').trim())); if (!add) return false; add.click(); return true; })()`);
  if (!clicked) throw new Error('no "Add to chart" button');
  const t0 = Date.now();
  let st = null, lastSize = -1, same = 0;
  for (let k = 0; k < 300; k++) {
    await sleep(2000);
    st = await ev(`(() => { const src = ${CH}._chartWidget.model().model().dataSources().find(d => d.metaInfo && d.metaInfo() && (d.metaInfo().description || '') === ${JSON.stringify(desc + ' — export only')});
      if (!src) return { found: false }; let s = null; try { const x = src.status(); s = x && (x.value ? x.value() : x); } catch (e) {}
      return { found: true, type: s ? s.type : null, err: s && s.errorDescription ? JSON.stringify(s.errorDescription).slice(0, 400) : null, size: src.data().size() }; })()`);
    if (st.err) throw new Error(`${v} ${res}: study error ${st.err}`);
    if (st.found && st.type === 2 && st.size > 0) { same = st.size === lastSize ? same + 1 : 0; lastSize = st.size; if (same >= 2) break; }
  }
  if (!(st.found && st.type === 2)) throw new Error(`${v} ${res}: study not loaded ${JSON.stringify(st)}`);
  const s = await ev(`(() => { const src = ${CH}._chartWidget.model().model().dataSources().find(d => d.metaInfo && d.metaInfo() && (d.metaInfo().description || '') === ${JSON.stringify(desc + ' — export only')});
    const mi = src.metaInfo(), d = src.data(), b = ${MS}.bars();
    const titles = mi.plots.map(p => (mi.styles && mi.styles[p.id] && mi.styles[p.id].title) || p.id);
    const rows = []; for (let i = d.firstIndex(); i <= d.lastIndex(); i++) { const r = d.valueAt(i); if (r) rows.push([i].concat(Array.from(r, x => (x === undefined ? null : x)))); }
    return JSON.stringify({ desc: mi.description, resolution: ${CH}.resolution(), symbol: ${CH}.symbol(), capturedAt: new Date().toISOString(), liveBarTime: b.valueAt(b.lastIndex())[0], chartBars: b.size(), titles, rows }); })()`);
  const f = join(outDir, `study_${res}_${v}.json`);
  writeFileSync(f, s);
  const j = JSON.parse(s);
  log(`${v} ${res}: loaded in ${Math.round((Date.now() - t0) / 1000)} s, ${j.rows.length} study rows, ${j.titles.length} plots, row width ${j.rows[0]?.length}, live bar ${new Date(j.liveBarTime * 1000).toISOString()}, sha256 ${createHash('sha256').update(s).digest('hex').slice(0, 16)}`);
  await ev(`(() => { const ch = ${CH}; for (const x of ch.getAllStudies()) ch.removeEntity(x.id); return true; })()`);
  await sleep(1500);
}

for (const res of tfArg.split(',')) {
  await loadRes(res);
  await dumpBars(res);
  for (const v of vArg.split(',')) await runStudy(res, v);
}
for (const res of htfArg.split(',').filter(Boolean)) {
  await loadRes(res);
  await dumpBars(res);
}
log('done');
await c.close();
