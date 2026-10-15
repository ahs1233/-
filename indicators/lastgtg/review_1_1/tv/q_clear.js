(async () => {
  const api = window.TradingViewApi, s = api._saveChartService;
  if (s.autoSaveEnabled().value()) throw new Error('autosave is ON: stop');
  const ch = api._activeChartWidgetWV.value();
  for (const st of ch.getAllStudies()) ch.removeEntity(st.id);
  await new Promise((r) => setTimeout(r, 800));
  return { studies: ch.getAllStudies().map((x) => x.name), autoSave: s.autoSaveEnabled().value(), hasChanges: s.hasChanges() };
})()
