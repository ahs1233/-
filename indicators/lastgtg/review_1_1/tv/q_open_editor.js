(async () => {
  const bwb = window.TradingView && window.TradingView.bottomWidgetBar;
  if (bwb && typeof bwb.activateScriptEditorTab === 'function') bwb.activateScriptEditorTab();
  else if (bwb && typeof bwb.showWidget === 'function') bwb.showWidget('pine-editor');
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (document.querySelector('.monaco-editor.pine-editor-monaco')) break;
  }
  // Header of the Pine editor: script title and buttons (text only).
  const root = document.querySelector('[data-name="pine-editor"], #pine-editor-bottom-widget, .pine-editor-container') || document.body;
  const buttons = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null).map((b) => (b.getAttribute('aria-label') || b.title || b.textContent || '').trim()).filter(Boolean).slice(0, 80);
  return { monaco: !!document.querySelector('.monaco-editor.pine-editor-monaco'), buttons };
})()
