(() => {
  const ch = window.TradingViewApi._activeChartWidgetWV.value();
  const model = ch._chartWidget.model().model();
  return model.dataSources().filter((s) => s.metaInfo && s.metaInfo()).map((s) => {
    const mi = s.metaInfo();
    let st = null;
    try { const v = s.status && s.status(); st = v && (v.value ? v.value() : v); } catch (e) { st = 'err ' + e; }
    return { name: mi.description || mi.shortDescription, status: st && typeof st === 'object' ? { type: st.type, errorDescription: st.errorDescription && (st.errorDescription.error || JSON.stringify(st.errorDescription).slice(0, 300)) } : st,
      resolution: ch.resolution() };
  });
})()
