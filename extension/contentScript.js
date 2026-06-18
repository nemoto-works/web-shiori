function getSelectionRectMetadata(rect) {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    pageX: rect.left + window.scrollX,
    pageY: rect.top + window.scrollY,
  };
}

function getSelectionPosition() {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const margin = 16;
  const x = Math.min(Math.max(rect.left, margin), Math.max(window.innerWidth - 280, margin));
  const y = Math.min(Math.max(rect.bottom + 8, margin), Math.max(window.innerHeight - 120, margin));

  const selectedText = selection.toString().slice(0, 120);
  const selectionRect = getSelectionRectMetadata(rect);

  return {
    x,
    y,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    selectedText,
    // Keep the previous metadata key readable for notes created by earlier prerelease builds.
    selectionText: selectedText,
    selectionRect,
  };
}

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

function getNotePosition(note, index) {
  const fallback = getStickyPosition(index);
  const position = note.position || {};

  return {
    ...fallback,
    ...position,
    x: Number.isFinite(position.x) ? position.x : Number.isFinite(note.x) ? note.x : fallback.x,
    y: Number.isFinite(position.y) ? position.y : Number.isFinite(note.y) ? note.y : fallback.y,
  };
}

function getClampedNotePosition(position, el) {
  const margin = 8;
  const estimatedWidth = el.offsetWidth || Math.min(280, Math.max(window.innerWidth - 32, 0));
  const estimatedHeight = el.offsetHeight || 120;
  const maxLeft = Math.max(window.innerWidth - estimatedWidth - margin, margin);
  const maxTop = Math.max(window.innerHeight - estimatedHeight - margin, margin);

  return {
    ...position,
    x: clamp(position.x, margin, maxLeft),
    y: clamp(position.y, margin, maxTop),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function makeStickyNoteDraggable(el, note, initialPosition) {
  const storage = window.webShioriStorage;
  if (!storage?.updateNote || !note.id) return;

  let startPointerX = 0;
  let startPointerY = 0;
  let startLeft = 0;
  let startTop = 0;
  let moved = false;

  const persistPosition = async () => {
    const x = parseFloat(el.style.left) || initialPosition.x;
    const y = parseFloat(el.style.top) || initialPosition.y;
    const position = {
      ...(note.position || {}),
      x,
      y,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };

    note.x = x;
    note.y = y;
    note.position = position;
    await storage.updateNote(note.id, { x, y, position });
  };

  const onPointerMove = (event) => {
    if (event.buttons === 0) return;

    const nextLeft = startLeft + event.clientX - startPointerX;
    const nextTop = startTop + event.clientY - startPointerY;
    const maxLeft = Math.max(window.innerWidth - el.offsetWidth - 8, 8);
    const maxTop = Math.max(window.innerHeight - el.offsetHeight - 8, 8);

    el.style.left = `${clamp(nextLeft, 8, maxLeft)}px`;
    el.style.top = `${clamp(nextTop, 8, maxTop)}px`;
    moved = true;
    event.preventDefault();
  };

  const onPointerUp = async (event) => {
    el.releasePointerCapture?.(event.pointerId);
    el.style.cursor = 'grab';
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);

    if (moved) await persistPosition();
  };

  el.style.cursor = 'grab';
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    startPointerX = event.clientX;
    startPointerY = event.clientY;
    startLeft = parseFloat(el.style.left) || initialPosition.x;
    startTop = parseFloat(el.style.top) || initialPosition.y;
    moved = false;

    el.style.cursor = 'grabbing';
    el.setPointerCapture?.(event.pointerId);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    event.preventDefault();
  });
}

function createStickyNote(note, index) {
  const position = getNotePosition(note, index);
  const el = document.createElement('div');
  el.className = 'web-shiori-note';
  el.textContent = note.text;

  el.style.position = 'fixed';
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

  const clampedPosition = getClampedNotePosition(position, el);
  el.style.top = `${clampedPosition.y}px`;
  el.style.left = `${clampedPosition.x}px`;

  makeStickyNoteDraggable(el, note, clampedPosition);
  return el;
}

function restoreScrollPosition(notes) {
  const savedPosition = notes.find((note) => !note.completed && note.position?.scrollY !== undefined)?.position;
  if (!savedPosition) return;

  window.scrollTo({
    left: savedPosition.scrollX || 0,
    top: savedPosition.scrollY || 0,
    behavior: 'instant',
  });
}

async function renderStickyNotes({ restoreScroll = true } = {}) {
  document.querySelectorAll('.web-shiori-note').forEach((noteEl) => noteEl.remove());

  const storage = window.webShioriStorage;
  if (!storage?.getNotesForUrl) return;

  const notes = await storage.getNotesForUrl(window.location.href);
  const activeNotes = (notes || []).filter((note) => !note.completed);
  if (restoreScroll) restoreScrollPosition(activeNotes);
  activeNotes.forEach((note, index) => {
    document.body.appendChild(createStickyNote(note, index));
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'WEB_SHIORI_REFRESH_NOTES') {
    renderStickyNotes({ restoreScroll: false })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type !== 'WEB_SHIORI_GET_PAGE_CONTEXT') return false;

  sendResponse({
    url: window.location.href,
    title: document.title,
    position: getSelectionPosition() || getStickyPosition(0),
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
