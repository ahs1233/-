// Evaluates one JS expression (from a file) in the TradingView Desktop chart page over CDP
// (127.0.0.1:9222) and prints the JSON result. Uses the TradingView MCP's own CDP client.
//   node cdp.mjs <expr.js>
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/alk/tradingview-mcp-jackson/package.json');
const CDP = require('chrome-remote-interface');
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const t = targets.find((x) => x.type === 'page' && /tradingview\.com\/chart/i.test(x.url)) || targets.find((x) => x.type === 'page' && /tradingview/i.test(x.url));
if (!t) { console.log(JSON.stringify({ error: 'no chart target', targets: targets.map((x) => [x.type, x.url]) })); process.exit(1); }
const c = await CDP({ host: '127.0.0.1', port: 9222, target: t.id });
const expr = readFileSync(process.argv[2], 'utf8');
const r = await c.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
if (process.argv[3] && !r.exceptionDetails) {
  const { writeFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const s = typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value);
  writeFileSync(process.argv[3], s);
  console.log(JSON.stringify({ url: t.url, wrote: process.argv[3], bytes: Buffer.byteLength(s), sha256: createHash('sha256').update(s).digest('hex') }));
} else console.log(JSON.stringify(r.exceptionDetails ? { error: r.exceptionDetails.exception?.description || r.exceptionDetails.text, url: t.url } : { url: t.url, value: r.result.value }, null, 1));
await c.close();
