(() => {
  const api = window.TradingViewApi;
  const ch = api._activeChartWidgetWV.value();
  const s = api._saveChartService || (api.saveChartService && api.saveChartService());
  const studies = ch.getAllStudies().map((x) => ({ id: x.id, name: x.name }));
  const out = { symbol: ch.symbol(), resolution: ch.resolution(), studies, chartsCount: api._chartWidgetCollection ? api._chartWidgetCollection.getAll().length : null };
  if (s) {
    out.saveService = Object.keys(s).slice(0, 40);
    try { out.autoSave = typeof s.autoSaveEnabled === 'function' ? s.autoSaveEnabled().value() : s.autoSaveEnabled; } catch (e) { out.autoSaveErr = String(e); }
    try { out.hasChanges = typeof s.hasChanges === 'function' ? s.hasChanges() : null; } catch (e) { out.hasChangesErr = String(e); }
  } else out.saveService = null;
  return out;
})()
