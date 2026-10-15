// Gate 1 compile check: posts each Pine file to TradingView's own translator (the endpoint the
// TradingView MCP's pine check uses), as Guest; nothing is saved and no chart is touched.
//   node pine_check.mjs <file.pine> ...   → prints one JSON line per file
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
for (const f of process.argv.slice(2)) {
  const source = readFileSync(f, 'utf8');
  const body = new URLSearchParams();
  body.append('source', source);
  const res = await fetch('https://pine-facade.tradingview.com/pine-facade/translate_light?user_name=Guest&pine_id=00000000-0000-0000-0000-000000000000',
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://www.tradingview.com/' }, body });
  const j = await res.json().catch(() => null);
  const inner = j?.result;
  const errors = (inner?.errors2 || []).map((e) => ({ line: e.start?.line, column: e.start?.column, message: e.message }));
  const warnings = (inner?.warnings2 || []).map((w) => ({ line: w.start?.line, column: w.start?.column, message: w.message }));
  if (typeof j?.error === 'string') errors.push({ message: j.error });
  console.log(JSON.stringify({ file: f, sha256: createHash('sha256').update(source).digest('hex'), http: res.status, success: j?.success, compiled: res.ok && errors.length === 0 && !!inner, errors, warnings: warnings.length, warningSample: warnings.slice(0, 5) }));
}
