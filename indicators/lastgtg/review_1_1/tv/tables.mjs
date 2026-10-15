// Reads Pine table cells of studies on the chart (TradingView MCP core). node tables.mjs <filter>
const data = await import('file:///C:/Users/alk/tradingview-mcp-jackson/src/core/data.js');
const conn = await import('file:///C:/Users/alk/tradingview-mcp-jackson/src/connection.js');
console.log(JSON.stringify(await data.getPineTables({ study_filter: process.argv[2] || '' }), null, 1));
await conn.disconnect();
