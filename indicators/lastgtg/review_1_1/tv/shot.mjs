// Screenshot of the TradingView Desktop page over CDP (no UI focus change). node shot.mjs <out.png>
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/alk/tradingview-mcp-jackson/package.json');
const CDP = require('chrome-remote-interface');
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const t = targets.find((x) => x.type === 'page' && /tradingview\.com\/chart/i.test(x.url));
const c = await CDP({ host: '127.0.0.1', port: 9222, target: t.id });
const r = await c.Page.captureScreenshot({ format: 'png' });
writeFileSync(process.argv[2], Buffer.from(r.data, 'base64'));
console.log('ok', process.argv[2]);
await c.close();
