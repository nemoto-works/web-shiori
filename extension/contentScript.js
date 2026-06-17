(async () => {
  try {
    if (!window.webShioriStorage?.getNotesForUrl) return;
    const url = window.location.href;
    const notes = await window.webShioriStorage.getNotesForUrl(url);

    (notes || [])
      .filter((n) => !n.completed)
      .forEach((note) => {
        const el = document.createElement('div');
        el.className = 'web-shiori-note';
        el.textContent = note.text;
        el.style.position = 'fixed';
        el.style.top = `${note.y}px`;
        el.style.left = `${note.x}px`;
        el.style.zIndex = '2147483646';
        el.style.maxWidth = '260px';
        el.style.padding = '8px 10px';
        el.style.background = '#fff3b0';
        el.style.border = '1px solid rgb(async () => {
  try {
    const storage = window.webShioriStorage;
    if (!storage?.getNotesForUrl) return;

    const url = window.location.href;
    const notes = await storage.getNotesForUrl(url);

    (notes || [])
      .filter((n) => !n.completed)
      .forEach((note) => {
        const el = document.createElement('div');
        el.className = 'web-shiori-note';
        el.textContent = note.text;

        el.style.position = 'fixed';
        el.style.top = `${note.y}px`;
        el.style.left = `${note.x}px`;
        el.style.zIndex = '2147483646';
        el.style.maxWidth = '260px';
        el.style.padding = '8px 10px';
        el.style.background = '#fff3b0';
        el.style.border = '1px solid rgba(0,0,0,.2)';
        el.style.borderRadius = '6px';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,.15)';
        el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
        el.style.fontSize = '13px';
        el.style.lineHeight = '1.4';
        el.style.color = '#222';

        document.body.appendChild(el);
      });
  } catch {
    // keep the page safe
  }
})();a(0,0,0,.2)';
        el.style.borderRadius = '6px';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,.15)';
        el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
        el.style.fontSize = '13px';
        el.style.lineHeight = '1.4';
        el.style.color = '#222';

        document.body.appendChild(el);
      });
  } catch (e) {
    // avoid breaking the page
  }
})();
