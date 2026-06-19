let latestInteractionPosition = null;
let contentAwareRefreshTimer = null;
let isRenderingStickyNotes = false;

function getDialogPositionFromPoint(clientX, clientY) {
  const margin = 16;
  const dialogWidth = Math.min(360, Math.max(window.innerWidth - 32, 0));
  const dialogHeight = 190;
  const x = clamp(clientX + 12, margin, Math.max(window.innerWidth - dialogWidth - margin, margin));
  const y = clamp(clientY + 12, margin, Math.max(window.innerHeight - dialogHeight - margin, margin));

  return {
    x,
    y,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

function rememberInteractionPosition(event) {
  if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return;
  latestInteractionPosition = getDialogPositionFromPoint(event.clientX, event.clientY);
}

function getQuickEntryPosition() {
  return getSelectionPosition() || latestInteractionPosition || null;
}

function getQuickEntryFallbackPosition() {
  const margin = 16;
  const dialogWidth = Math.min(360, Math.max(window.innerWidth - 32, 0));
  const dialogHeight = 190;

  return {
    x: Math.max(window.innerWidth - dialogWidth - margin, margin),
    y: Math.max(window.innerHeight - dialogHeight - margin, margin),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

document.addEventListener('pointerdown', rememberInteractionPosition, { capture: true, passive: true });
document.addEventListener('click', rememberInteractionPosition, { capture: true, passive: true });


function isSlackWebPage(url = window.location.href) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'app.slack.com' || hostname.endsWith('.slack.com');
  } catch (error) {
    return false;
  }
}

function isSlackNavigableMessageUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    if (!isSlackWebPage(parsed.href)) return false;

    const path = parsed.pathname;
    return /\/archives\/[A-Z0-9]+\/p\d{10,}/i.test(path)
      || /\/archives\/[A-Z0-9]+\/thread\//i.test(path)
      || /[?&](thread_ts|cid|channel|message_ts)=/i.test(parsed.search);
  } catch (error) {
    return false;
  }
}

function getSlackUrlFromElement(element) {
  if (!element?.closest) return null;

  const link = element.closest('a[href]') || element.querySelector?.('a[href*="/archives/"]');
  if (link?.href && isSlackNavigableMessageUrl(link.href)) return link.href;

  const candidateAttributes = ['data-qa-permalink', 'data-message-permalink', 'data-permalink', 'href'];
  for (const attr of candidateAttributes) {
    const value = element.getAttribute?.(attr);
    if (value && isSlackNavigableMessageUrl(value)) return new URL(value, window.location.href).href;
  }

  const timestamp = element.getAttribute?.('data-ts')
    || element.getAttribute?.('data-message-ts')
    || element.closest?.('[data-ts], [data-message-ts]')?.getAttribute?.('data-ts')
    || element.closest?.('[data-ts], [data-message-ts]')?.getAttribute?.('data-message-ts');
  const channel = element.getAttribute?.('data-channel-id')
    || element.closest?.('[data-channel-id]')?.getAttribute?.('data-channel-id')
    || window.location.pathname.match(/\/archives\/([A-Z0-9]+)/i)?.[1];

  if (channel && timestamp && /^\d+(?:\.\d+)?$/.test(timestamp)) {
    return new URL(`/archives/${channel}/p${timestamp.replace('.', '').padEnd(16, '0')}`, window.location.origin).href;
  }

  return null;
}

function findSlackTargetUrlFromSelection() {
  if (!isSlackWebPage()) return null;

  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const start = range.startContainer?.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer?.parentElement;
  const end = range.endContainer?.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer?.parentElement;
  const common = range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer?.parentElement;

  const candidates = [start, end, common]
    .filter(Boolean)
    .flatMap((element) => [
      element,
      element.closest?.('[data-qa="message_container"], [data-qa="virtual-list-item"], [data-ts], [data-message-ts], [data-channel-id]'),
      element.closest?.('a[href]'),
    ])
    .filter(Boolean);

  for (const candidate of candidates) {
    const targetUrl = getSlackUrlFromElement(candidate);
    if (targetUrl) return targetUrl;
  }

  return null;
}

function getSelectionPosition() {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const margin = 16;
  const x = Math.min(Math.max(rect.left, margin), Math.max(window.innerWidth - 280, margin));
  const y = Math.min(Math.max(rect.bottom + 8, margin), Math.max(window.innerHeight - 120, margin));

  return {
    x,
    y,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    selectedText: selection.toString().slice(0, 120),
    selectionText: selection.toString().slice(0, 120),
    targetUrl: findSlackTargetUrlFromSelection() || undefined,
    selectionRect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      pageLeft: rect.left + window.scrollX,
      pageTop: rect.top + window.scrollY,
      pageRight: rect.right + window.scrollX,
      pageBottom: rect.bottom + window.scrollY,
    },
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

function normalizeMatchText(text) {
  return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getNoteSelectedText(note) {
  return note?.anchor?.selectedText || note?.anchor?.selectionText || note?.selectionText || '';
}

function getCurrentPageMatchText() {
  return normalizeMatchText(document.body?.innerText || document.body?.textContent || '');
}

function noteMatchesCurrentPageContent(note, pageMatchText = getCurrentPageMatchText()) {
  const selectedText = normalizeMatchText(getNoteSelectedText(note));
  if (!selectedText) return true;

  return pageMatchText.includes(selectedText);
}

function makeStickyNoteDraggable(el, note, initialPosition, onClickWithoutDrag) {
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

    if (moved) {
      await persistPosition();
    } else {
      onClickWithoutDrag?.(event);
    }
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

function openStickyNoteEditor(el, note) {
  const storage = window.webShioriStorage;
  if (!storage?.updateNote || !note.id || el.querySelector('textarea')) return;

  const originalText = note.text || '';
  el.textContent = '';
  el.style.cursor = 'default';

  const textarea = document.createElement('textarea');
  textarea.value = originalText;
  textarea.setAttribute('aria-label', 'Edit Web Shiori note');
  textarea.style.boxSizing = 'border-box';
  textarea.style.width = '100%';
  textarea.style.minWidth = '220px';
  textarea.style.minHeight = '80px';
  textarea.style.margin = '0';
  textarea.style.padding = '6px';
  textarea.style.border = '1px solid rgba(0,0,0,.25)';
  textarea.style.borderRadius = '4px';
  textarea.style.font = 'inherit';
  textarea.style.resize = 'vertical';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'flex-end';
  actions.style.gap = '6px';
  actions.style.marginTop = '6px';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save';

  const closeEditor = (text) => {
    el.textContent = text;
    el.style.cursor = 'grab';
  };

  const save = async () => {
    if (saveButton.disabled) return;
    const text = textarea.value.trim();
    if (!text) return;

    saveButton.disabled = true;
    await storage.updateNote(note.id, { text });
    note.text = text;
    closeEditor(text);
  };

  textarea.addEventListener('pointerdown', (event) => event.stopPropagation());
  textarea.addEventListener('click', (event) => event.stopPropagation());
  actions.addEventListener('pointerdown', (event) => event.stopPropagation());
  cancelButton.addEventListener('click', () => closeEditor(originalText));
  saveButton.addEventListener('click', save);
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeEditor(originalText);
      event.preventDefault();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      save();
      event.preventDefault();
    }
  });

  actions.append(cancelButton, saveButton);
  el.append(textarea, actions);
  textarea.focus();
  textarea.select();
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

  makeStickyNoteDraggable(el, note, clampedPosition, () => openStickyNoteEditor(el, note));
  el.addEventListener('dblclick', (event) => {
    event.preventDefault();
    openStickyNoteEditor(el, note);
  });
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
  isRenderingStickyNotes = true;
  try {
    document.querySelectorAll('.web-shiori-note').forEach((noteEl) => noteEl.remove());

    const storage = window.webShioriStorage;
    if (!storage?.getNotesForUrl) return;

    const notes = await storage.getNotesForUrl(window.location.href);
    const pageMatchText = getCurrentPageMatchText();
    const activeNotes = (notes || []).filter((note) => !note.completed && noteMatchesCurrentPageContent(note, pageMatchText));
    if (restoreScroll) restoreScrollPosition(activeNotes);
    activeNotes.forEach((note, index) => {
      document.body.appendChild(createStickyNote(note, index));
    });
  } finally {
    isRenderingStickyNotes = false;
  }
}

function scheduleContentAwareRefresh() {
  if (isRenderingStickyNotes) return;

  clearTimeout(contentAwareRefreshTimer);
  contentAwareRefreshTimer = window.setTimeout(() => {
    renderStickyNotes({ restoreScroll: false }).catch(() => {
      // Keep page mutations safe even if extension storage is unavailable.
    });
  }, 250);
}

function startContentAwareRefreshObserver() {
  if (!document.body || typeof MutationObserver === 'undefined') return;

  const observer = new MutationObserver((mutations) => {
    if (isRenderingStickyNotes) return;
    if (mutations.every((mutation) => mutation.target?.closest?.('.web-shiori-note, #web-shiori-quick-entry'))) return;

    scheduleContentAwareRefresh();
  });

  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}


function removeQuickEntryDialog() {
  document.getElementById('web-shiori-quick-entry')?.remove();
}

async function saveQuickEntryNote(noteText, initialPosition = null) {
  const storage = window.webShioriStorage;
  if (!storage?.addNote) return false;

  const position = initialPosition || getQuickEntryPosition() || getStickyPosition(0);
  const anchor = position.selectedText
    ? {
        selectedText: position.selectedText,
        selectionText: position.selectionText,
        selectionRect: position.selectionRect,
        scrollX: position.scrollX,
        scrollY: position.scrollY,
        viewportWidth: position.viewportWidth,
        viewportHeight: position.viewportHeight,
        targetUrl: position.targetUrl,
      }
    : undefined;

  await storage.addNote({
    url: window.location.href,
    title: document.title,
    text: noteText,
    x: position.x,
    y: position.y,
    position,
    ...(position.targetUrl ? { targetUrl: position.targetUrl } : {}),
    ...(anchor ? { anchor } : {}),
    completed: false,
  });
  await renderStickyNotes({ restoreScroll: false });
  return true;
}

function showQuickEntryDialog() {
  const initialPosition = getQuickEntryPosition();
  const existingTextarea = document.querySelector('#web-shiori-quick-entry textarea');
  if (existingTextarea) {
    existingTextarea.focus();
    return;
  }

  const dialog = document.createElement('div');
  dialog.id = 'web-shiori-quick-entry';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Web Shiori quick note');
  dialog.style.position = 'fixed';
  dialog.style.zIndex = '2147483647';
  const dialogPosition = initialPosition || getQuickEntryFallbackPosition();
  dialog.style.left = `${dialogPosition.x}px`;
  dialog.style.top = `${dialogPosition.y}px`;
  dialog.style.width = 'min(360px, calc(100vw - 32px))';
  dialog.style.padding = '12px';
  dialog.style.background = '#fff';
  dialog.style.border = '1px solid rgba(0,0,0,.2)';
  dialog.style.borderRadius = '8px';
  dialog.style.boxShadow = '0 8px 24px rgba(0,0,0,.22)';
  dialog.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  dialog.style.color = '#222';

  const label = document.createElement('label');
  label.textContent = 'Web Shiori note';
  label.style.display = 'block';
  label.style.marginBottom = '6px';
  label.style.fontSize = '13px';
  label.style.fontWeight = '600';

  const textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.placeholder = 'Enter a note for this page…';
  textarea.style.boxSizing = 'border-box';
  textarea.style.width = '100%';
  textarea.style.margin = '0';
  textarea.style.padding = '8px';
  textarea.style.border = '1px solid rgba(0,0,0,.25)';
  textarea.style.borderRadius = '6px';
  textarea.style.font = 'inherit';
  textarea.style.resize = 'vertical';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'flex-end';
  actions.style.gap = '8px';
  actions.style.marginTop = '8px';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.textContent = 'Save note';

  const save = async () => {
    if (saveButton.disabled) return;

    const noteText = textarea.value.trim();
    if (!noteText) return;

    saveButton.disabled = true;
    const saved = await saveQuickEntryNote(noteText, initialPosition);
    if (saved) removeQuickEntryDialog();
    else saveButton.disabled = false;
  };

  cancelButton.addEventListener('click', removeQuickEntryDialog);
  saveButton.addEventListener('click', save);
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      removeQuickEntryDialog();
      event.preventDefault();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      save();
      event.preventDefault();
    }
  });

  actions.append(cancelButton, saveButton);
  dialog.append(label, textarea, actions);
  document.body.appendChild(dialog);
  textarea.focus();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'WEB_SHIORI_REFRESH_NOTES') {
    renderStickyNotes({ restoreScroll: false })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'WEB_SHIORI_QUICK_ENTRY') {
    showQuickEntryDialog();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type !== 'WEB_SHIORI_GET_PAGE_CONTEXT') return false;

  sendResponse({
    url: window.location.href,
    title: document.title,
    position: getQuickEntryPosition() || getStickyPosition(0),
  });
  return true;
});

(async () => {
  try {
    await renderStickyNotes();
    startContentAwareRefreshObserver();
  } catch (error) {
    // Keep the page safe even if extension storage is unavailable.
  }
})();
