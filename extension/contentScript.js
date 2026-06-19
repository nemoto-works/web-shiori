let latestInteractionPosition = null;
let contentAwareRefreshTimer = null;
let isRenderingStickyNotes = false;
let lastStickyRenderSignature = '';
let lastContentAwareRefreshAt = 0;
const CONTENT_AWARE_REFRESH_DEBOUNCE_MS = 350;
const CONTENT_AWARE_REFRESH_THROTTLE_MS = 1000;

const SLACK_PERMALINK_ATTRIBUTES = [
  'data-qa-permalink',
  'data-message-permalink',
  'data-permalink',
  'data-thread-permalink',
  'data-activity-permalink',
  'data-item-permalink',
  'data-qa-message_permalink',
  'data-original-message-permalink',
  'data-original-thread-permalink',
  'data-channel-message-permalink',
];
const SLACK_PERMALINK_SELECTOR = `a[href], ${SLACK_PERMALINK_ATTRIBUTES.map((attr) => `[${attr}]`).join(', ')}`;
const SLACK_ACTIVITY_CONTAINER_SELECTOR = [
  '[data-qa="activity_feed_item"]',
  '[data-qa="activity-item"]',
  '[data-qa="activity_page_item"]',
  '[data-qa="activity_page_list_item"]',
  '[data-qa="activity_feed_item_message"]',
  '[role="listitem"][data-item-key*="activity" i]',
  '[aria-label*="Activity" i]',
  '[class*="activity" i]',
].join(', ');
const SLACK_ACTIVITY_PERMALINK_SELECTOR = [
  'a[data-qa*="permalink" i][href]',
  'a[data-qa*="message" i][href*="/archives/"]',
  'a[data-qa*="thread" i][href*="/archives/"]',
  'a[data-qa*="channel" i][href*="/archives/"]',
  'a[data-qa*="message" i][href*="/client/"]',
  'a[data-qa*="thread" i][href*="/client/"]',
  'a[data-qa*="channel" i][href*="/client/"]',
  'a[aria-label*="message" i][href]',
  'a[aria-label*="thread" i][href]',
  'a[aria-label*="channel" i][href]',
  'a[aria-label*="permalink" i][href]',
  'a[aria-label*="jump" i][href]',
  'a[aria-label*="open" i][href]',
  'a[title*="permalink" i][href]',
  'a[title*="jump" i][href]',
  'a[title*="open" i][href]',
  'a[href*="/archives/"]',
  'a[href*="/client/"]',
  ...SLACK_PERMALINK_ATTRIBUTES.map((attr) => `[${attr}]`),
].join(', ');

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
    const isWorkspaceArchivePermalink = parsed.hostname !== 'app.slack.com'
      && parsed.hostname.endsWith('.slack.com')
      && /\/archives\/[A-Z0-9]+\/p\d{10,}(?:$|[/?#])/i.test(path);
    const isAppClientMessageLink = parsed.hostname === 'app.slack.com'
      && /\/client\/[A-Z0-9]+\/[A-Z0-9]+(?:\/thread\/[A-Z0-9]+-\d{10,})?(?:$|[/?#])/i.test(path);

    return isWorkspaceArchivePermalink || isAppClientMessageLink;
  } catch (error) {
    return false;
  }
}

function getSlackUrlFromElement(element) {
  if (!element?.closest) return null;

  const candidateElements = [
    element.closest('a[href]'),
    element,
    ...(element.querySelectorAll?.(SLACK_PERMALINK_SELECTOR) || []),
  ].filter(Boolean);

  for (const candidate of candidateElements) {
    const href = candidate.href || candidate.getAttribute?.('href');
    if (href && !isSlackActivityScreenUrl(href) && isSlackNavigableMessageUrl(href)) return new URL(href, window.location.href).href;

    for (const attr of SLACK_PERMALINK_ATTRIBUTES) {
      const value = candidate.getAttribute?.(attr);
      if (value && !isSlackActivityScreenUrl(value) && isSlackNavigableMessageUrl(value)) return new URL(value, window.location.href).href;
    }
  }

  return null;
}

function findSlackActivityContainer(element) {
  return element?.closest?.(SLACK_ACTIVITY_CONTAINER_SELECTOR) || null;
}

function findSlackChannelContainer(element) {
  return element?.closest?.('[data-qa=\"message_container\"], [data-qa=\"virtual-list-item\"], [data-ts], [data-message-ts], [data-channel-id], [role=\"listitem\"]') || null;
}

function isSlackActivityScreenUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return isSlackWebPage(parsed.href) && /\/activity(?:$|[/?#])/i.test(parsed.pathname);
  } catch (error) {
    return false;
  }
}

function getSlackCandidateUrl(candidate) {
  const href = candidate?.href || candidate?.getAttribute?.('href');
  if (href && !isSlackActivityScreenUrl(href) && isSlackNavigableMessageUrl(href)) return new URL(href, window.location.href).href;

  for (const attr of SLACK_PERMALINK_ATTRIBUTES) {
    const value = candidate?.getAttribute?.(attr);
    if (value && !isSlackActivityScreenUrl(value) && isSlackNavigableMessageUrl(value)) return new URL(value, window.location.href).href;
  }

  return null;
}

function getSlackCandidateScore(candidate) {
  const descriptor = [
    candidate?.getAttribute?.('data-qa'),
    candidate?.getAttribute?.('aria-label'),
    candidate?.getAttribute?.('title'),
    candidate?.className,
  ].join(' ').toLowerCase();

  if (/thread/.test(descriptor)) return 0;
  if (/message|permalink|jump|open|channel/.test(descriptor)) return 1;
  return 2;
}

function findSlackActivityTargetUrlFromElement(element) {
  const activityContainer = findSlackActivityContainer(element);
  if (!activityContainer) return null;

  const activityPermalinkCandidates = [
    activityContainer.closest?.(SLACK_ACTIVITY_PERMALINK_SELECTOR),
    ...Array.from(activityContainer.querySelectorAll?.(SLACK_ACTIVITY_PERMALINK_SELECTOR) || []),
  ]
    .filter(Boolean)
    .filter((candidate, index, candidates) => candidates.indexOf(candidate) === index)
    .sort((left, right) => getSlackCandidateScore(left) - getSlackCandidateScore(right));

  for (const candidate of activityPermalinkCandidates) {
    const activityPermalink = getSlackCandidateUrl(candidate);
    if (activityPermalink) return activityPermalink;
  }

  return getSlackUrlFromElement(activityContainer);
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
      findSlackActivityContainer(element),
      findSlackChannelContainer(element),
      element.closest?.(SLACK_PERMALINK_SELECTOR),
      element.closest?.('a[href]'),
    ])
    .filter(Boolean);

  for (const candidate of candidates) {
    const activityTargetUrl = findSlackActivityTargetUrlFromElement(candidate);
    if (activityTargetUrl) return activityTargetUrl;
  }

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

  const slackTargetUrl = findSlackTargetUrlFromSelection() || undefined;
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
    targetUrl: slackTargetUrl,
    anchorUrl: slackTargetUrl,
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

function getNoteRenderKey(note, index) {
  return note.id || `${note.url || 'note'}:${note.createdAt || ''}:${index}`;
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


function findElementContainingText(searchText) {
  const normalizedSearchText = normalizeMatchText(searchText);
  if (!normalizedSearchText || !document.body) return null;

  const slackMessageSelector = '[data-qa="message_container"], [data-qa="virtual-list-item"], [data-ts], [data-message-ts]';
  const slackMessages = Array.from(document.querySelectorAll(slackMessageSelector));
  const matchingSlackMessage = slackMessages.find((element) => normalizeMatchText(element.innerText || element.textContent || '').includes(normalizedSearchText));
  if (matchingSlackMessage) return matchingSlackMessage;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!normalizeMatchText(node.textContent).includes(normalizedSearchText)) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest?.('.web-shiori-note, #web-shiori-quick-entry, script, style, noscript')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const matchingTextNode = walker.nextNode();
  if (!matchingTextNode) return null;

  return matchingTextNode.parentElement?.closest?.('p, li, article, section, div, span') || matchingTextNode.parentElement || null;
}

function getPositionNearElement(element, fallbackPosition) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect || (rect.width === 0 && rect.height === 0)) return fallbackPosition;

  const margin = 16;
  return {
    ...fallbackPosition,
    x: clamp(rect.left, margin, Math.max(window.innerWidth - 280, margin)),
    y: clamp(rect.bottom + 8, margin, Math.max(window.innerHeight - 120, margin)),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

function resolveRenderableNote(note, index, { restoreScroll = true } = {}) {
  const selectedText = getNoteSelectedText(note);
  if (!normalizeMatchText(selectedText)) return { note, anchorElement: null };

  const anchorElement = findElementContainingText(selectedText);
  if (!anchorElement) return null;

  if (restoreScroll) {
    anchorElement.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }

  return {
    note,
    anchorElement,
  };
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

  const closeEditor = () => {
    renderStickyNotes({ restoreScroll: false, force: true }).catch(() => {
      el.style.cursor = 'grab';
    });
  };

  const save = async () => {
    if (saveButton.disabled) return;
    const text = textarea.value.trim();
    if (!text) return;

    saveButton.disabled = true;
    await storage.updateNote(note.id, { text });
    note.text = text;
    closeEditor();
  };

  textarea.addEventListener('pointerdown', (event) => event.stopPropagation());
  textarea.addEventListener('click', (event) => event.stopPropagation());
  actions.addEventListener('pointerdown', (event) => event.stopPropagation());
  cancelButton.addEventListener('click', () => { note.text = originalText; closeEditor(); });
  saveButton.addEventListener('click', save);
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      note.text = originalText;
      closeEditor();
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
  const storage = window.webShioriStorage;
  const position = getNotePosition(note, index);
  const el = document.createElement('div');
  el.className = 'web-shiori-note';
  el.dataset.noteId = getNoteRenderKey(note, index);

  const noteText = document.createElement('div');
  noteText.className = 'web-shiori-note-text';
  noteText.textContent = note.text;

  const controls = document.createElement('div');
  controls.className = 'web-shiori-note-controls';
  controls.style.display = 'flex';
  controls.style.justifyContent = 'flex-end';
  controls.style.gap = '6px';
  controls.style.marginTop = '6px';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.className = 'web-shiori-note-edit';
  const completeButton = document.createElement('button');
  completeButton.type = 'button';
  completeButton.textContent = 'Done';
  completeButton.className = 'web-shiori-note-complete';
  controls.addEventListener('pointerdown', (event) => event.stopPropagation());
  editButton.addEventListener('click', (event) => { event.stopPropagation(); openStickyNoteEditor(el, note); });
  completeButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!storage?.updateNote || !note.id) return;
    await storage.updateNote(note.id, { completed: true });
    await renderStickyNotes({ restoreScroll: false, force: true });
  });
  controls.append(editButton, completeButton);
  el.append(noteText, controls);

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
  el.style.userSelect = 'none';

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

function getRenderableNotesSignature(renderableNotes) {
  return JSON.stringify(renderableNotes.map(({ note }, index) => {
    const position = getNotePosition(note, index);
    return {
      id: getNoteRenderKey(note, index),
      text: note.text || '',
      completed: !!note.completed,
      x: Number.isFinite(position.x) ? Math.round(position.x) : null,
      y: Number.isFinite(position.y) ? Math.round(position.y) : null,
    };
  }));
}

async function renderStickyNotes({ restoreScroll = true, force = false } = {}) {
  isRenderingStickyNotes = true;
  try {
    const storage = window.webShioriStorage;
    if (!storage?.getNotesForUrl) return;

    const notes = await storage.getNotesForUrl(window.location.href);
    const pageMatchText = getCurrentPageMatchText();
    const activeNotes = (notes || []).filter((note) => !note.completed && noteMatchesCurrentPageContent(note, pageMatchText));
    const renderableNotes = activeNotes
      .map((note, index) => resolveRenderableNote(note, index, { restoreScroll }))
      .filter(Boolean);
    const renderSignature = getRenderableNotesSignature(renderableNotes);
    if (!force && !restoreScroll && renderSignature === lastStickyRenderSignature) return;

    document.querySelectorAll('.web-shiori-note').forEach((noteEl) => noteEl.remove());
    lastStickyRenderSignature = renderSignature;

    if (restoreScroll && renderableNotes.every(({ anchorElement }) => !anchorElement)) restoreScrollPosition(activeNotes);
    renderableNotes.forEach(({ note }, index) => {
      document.body.appendChild(createStickyNote(note, index));
    });
  } finally {
    isRenderingStickyNotes = false;
  }
}

function scheduleContentAwareRefresh() {
  if (isRenderingStickyNotes) return;

  clearTimeout(contentAwareRefreshTimer);
  const now = Date.now();
  const throttleDelay = Math.max(0, CONTENT_AWARE_REFRESH_THROTTLE_MS - (now - lastContentAwareRefreshAt));
  contentAwareRefreshTimer = window.setTimeout(() => {
    lastContentAwareRefreshAt = Date.now();
    renderStickyNotes({ restoreScroll: false }).catch(() => {
      // Keep page mutations safe even if extension storage is unavailable.
    });
  }, Math.max(CONTENT_AWARE_REFRESH_DEBOUNCE_MS, throttleDelay));
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
        anchorUrl: position.anchorUrl,
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
    ...(position.anchorUrl ? { anchorUrl: position.anchorUrl } : {}),
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
