// Sends one key to the TradingView page over CDP. node key.mjs Escape
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/alk/tradingview-mcp-jackson/package.json');
const CDP = require('chrome-remote-interface');
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const t = targets.find((x) => x.type === 'page' && /tradingview\.com\/chart/i.test(x.url));
const c = await CDP({ host: '127.0.0.1', port: 9222, target: t.id });
const key = process.argv[2];
const codes = { Escape: 27, Enter: 13 };
await c.Input.dispatchKeyEvent({ type: 'keyDown', key, code: key, windowsVirtualKeyCode: codes[key] });
await c.Input.dispatchKeyEvent({ type: 'keyUp', key, code: key, windowsVirtualKeyCode: codes[key] });
console.log('sent', key);
await c.close();
