function getStickyPosition(index) {
  const margin = 16;
  const baseTop = Math.min(Math.max(window.innerHeight * 0.18, 80), 180);
  const offset = index * 24;

  return {
    x: margin,
    y: baseTop + offset,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

function createStickyNote(note, index) {
  const position = note.position || {};
  const el = document.createElement('div');
  el.className = 'web-shiori-note';
  el.textContent = note.text;

  el.style.position = 'fixed';
  el.style.top = `${position.y || note.y || getStickyPosition(index).y}px`;
  el.style.left = `${position.x || note.x || getStickyPosition(index).x}px`;
  el.style.zIndex = '2147483646';
  el.style.maxWidth = 'min(260px, calc(100vw - 32px))';
  el.style.padding = '8px 10px';
  el.style.background = '#fff3b0';
  el.style.border = '1px solid rgba(0,0,0,.2)';
  el.style.borderRadius = '6px';
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,.15)';
  el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  el.style.fontSize = '13px';
  el.style.lineHeight = '1.4';
  el.style.color = '#222';
  el.style.whiteSpace = 'pre-wrap';

  return el;
}

async function renderStickyNotes() {
  const storage = window.webShioriStorage;
  if (!storage?.getNotesForUrl) return;

  const notes = await storage.getNotesForUrl(window.location.href);
  (notes || [])
    .filter((note) => !note.completed)
    .forEach((note, index) => {
      document.body.appendChild(createStickyNote(note, index));
    });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'WEB_SHIORI_GET_PAGE_CONTEXT') return false;

  sendResponse({
    url: window.location.href,
    title: document.title,
    position: getStickyPosition(0),
  });
  return true;
});

(async () => {
  try {
    await renderStickyNotes();
  } catch (error) {
    // Keep the page safe even if extension storage is unavailable.
  }
})();
