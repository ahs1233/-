(async () => {
  const s = window.TradingViewApi._saveChartService;
  if (s.hasChanges()) throw new Error('layout has unsaved changes: stop');
  let j = s.saveToJSON();
  if (j && typeof j.then === 'function') j = await j;
  return typeof j === 'string' ? j : JSON.stringify(j);
})()
