(() => {
  const api = window.TradingViewApi;
  const protoNames = (o) => { const out = new Set(); let p = o; for (let k = 0; p && k < 4; k++, p = Object.getPrototypeOf(p)) Object.getOwnPropertyNames(p).forEach((n) => out.add(n)); return [...out]; };
  const pick = (arr) => arr.filter((n) => /save|json|auto|load|change/i.test(n));
  return { saveChartService: pick(protoNames(api._saveChartService)), chartWidgetCollection: pick(protoNames(api._chartWidgetCollection)), api: pick(protoNames(api)) };
})()
