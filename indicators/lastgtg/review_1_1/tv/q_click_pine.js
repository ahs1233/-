(async () => {
  const b = document.querySelector('[data-name="pine-dialog-button"]');
  if (!b) return 'no button';
  b.click();
  for (let i = 0; i < 50; i++) { await new Promise((r) => setTimeout(r, 200)); if (document.querySelector('.monaco-editor.pine-editor-monaco')) break; }
  return { monaco: !!document.querySelector('.monaco-editor.pine-editor-monaco') };
})()
