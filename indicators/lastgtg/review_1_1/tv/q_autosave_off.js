(async () => {
  const s = window.TradingViewApi._saveChartService;
  if (s.hasChanges()) throw new Error('layout has unsaved changes: stop');
  s.setAutoSaveEnabled(false);
  await new Promise((r) => setTimeout(r, 500));
  return { autoSave: s.autoSaveEnabled().value(), hasChanges: s.hasChanges() };
})()
