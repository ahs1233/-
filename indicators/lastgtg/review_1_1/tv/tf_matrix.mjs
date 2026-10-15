// For the one lastgtg study on the chart: switch the chart through timeframes and record its
// status (type 2 = loaded) and its panel rows. Autosave must be off. node tf_matrix.mjs <filter> <out.json>
import { writeFileSync } from 'node:fs';
const conn = await import('file:///C:/Users/alk/tradingview-mcp-jackson/src/connection.js');
const data = await import('file:///C:/Users/alk/tradingview-mcp-jackson/src/core/data.js');
const filter = process.argv[2];
const status = () => conn.evaluate(`(() => { const ch = window.TradingViewApi._activeChartWidgetWV.value(); const s = window.TradingViewApi._saveChartService;
  const src = ch._chartWidget.model().model().dataSources().find(d => d.metaInfo && d.metaInfo() && (d.metaInfo().description || '').includes(${JSON.stringify(filter)}));
  let st = null; try { const v = src && src.status(); st = v && (v.value ? v.value() : v); } catch (e) {}
  return { res: ch.resolution(), autoSave: s.autoSaveEnabled().value(), type: st ? st.type : null, err: st && st.errorDescription ? JSON.stringify(st.errorDescription).slice(0, 400) : null }; })()`);
const out = [];
for (const res of ['1', '15', '60', '240']) {
  const pre = await status();
  if (pre.autoSave) throw new Error('autosave ON: stop');
  await conn.evaluate(`window.TradingViewApi._activeChartWidgetWV.value().setResolution(${JSON.stringify(res)})`);
  let st = null; const t0 = Date.now();
  for (let k = 0; k < 90; k++) {
    await new Promise((r) => setTimeout(r, 2000));
    st = await status();
    if (st.res === res && (st.type === 2 || st.err)) break;
  }
  await new Promise((r) => setTimeout(r, 3000));
  const tables = await data.getPineTables({ study_filter: filter });
  out.push({ res, seconds: Math.round((Date.now() - t0) / 1000), status: st, rows: tables.studies?.[0]?.tables?.[0]?.rows || null });
  console.log(JSON.stringify(out.at(-1)));
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
await conn.disconnect();
