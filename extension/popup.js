const EMPTY_LIST_MESSAGE = '保存された付箋はありません。';
const EMPTY_FILTER_MESSAGES = {
  active: '未完了の付箋はありません。',
  completed: '完了済みの付箋はありません。',
  all: EMPTY_LIST_MESSAGE,
};
const TAB_LABELS = {
  active: '未完了',
  completed: '完了',
  all: 'すべて',
};

let currentNoteFilter = 'active';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getPageContext(tab) {
  const fallback = {
    url: tab?.url || '',
    title: tab?.title || '',
    position: {
      x: 120,
      y: 160,
      scrollX: 0,
      scrollY: 0,
      viewportWidth: null,
      viewportHeight: null,
    },
  };

  if (!tab?.id) return fallback;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'WEB_SHIORI_GET_PAGE_CONTEXT' });
    return {
      ...fallback,
      ...response,
      url: response?.url || fallback.url,
      title: response?.title || fallback.title,
      position: {
        ...fallback.position,
        ...(response?.position || {}),
      },
    };
  } catch (error) {
    return fallback;
  }
}

async function sendRefreshMessage(tab) {
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'WEB_SHIORI_REFRESH_NOTES' });
  } catch (error) {
    // The target tab may not have the content script, such as browser internal pages.
  }
}


function getAnchorFromPosition(position) {
  if (!position?.selectedText) return undefined;

  return {
    selectedText: position.selectedText,
    selectionText: position.selectionText || position.selectedText,
    selectionRect: position.selectionRect,
    scrollX: position.scrollX,
    scrollY: position.scrollY,
    viewportWidth: position.viewportWidth,
    viewportHeight: position.viewportHeight,
    targetUrl: position.targetUrl,
    anchorUrl: position.anchorUrl,
  };
}

function urlsMatch(leftUrl, rightUrl) {
  if (!leftUrl || !rightUrl) return false;

  const normalizeUrl = window.webShioriStorage?.normalizeUrl || ((url) => url);
  return normalizeUrl(leftUrl) === normalizeUrl(rightUrl);
}

async function getMatchingTabs(url) {
  if (!url) return [];

  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => urlsMatch(tab.url, url));
}

async function refreshTabsForUrl(url) {
  const tabs = await getMatchingTabs(url);
  await Promise.all(tabs.map((tab) => sendRefreshMessage(tab)));
}

function getNoteNavigationUrl(note) {
  return note?.targetUrl || note?.anchorUrl || note?.anchor?.targetUrl || note?.anchor?.anchorUrl || note?.url || '';
}

async function openOrFocusNoteUrl(note) {
  const navigationUrl = getNoteNavigationUrl(note);
  if (!navigationUrl) return;

  const [matchingTab] = await getMatchingTabs(navigationUrl);
  const [fallbackTab] = matchingTab ? [] : await getMatchingTabs(note.url);
  const targetTab = matchingTab || fallbackTab;
  if (targetTab?.id) {
    await chrome.tabs.update(targetTab.id, { active: true, url: navigationUrl });
    if (targetTab.windowId !== undefined) {
      await chrome.windows.update(targetTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: navigationUrl });
}

function renderVersion() {
  const versionEl = document.getElementById('version');
  const manifest = chrome.runtime.getManifest?.();
  if (!versionEl || !manifest?.version) return;

  versionEl.textContent = `v${manifest.version}`;
}

function formatPageTitle(note) {
  return note.title || 'タイトルなし';
}

function formatPageUrl(note) {
  return note.url || 'URLなし';
}

function createNoteItem(note, onComplete, onOpen) {
  const item = document.createElement('li');
  item.className = `note-item${note.completed ? ' note-item--completed' : ''}`;

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'note-card-button';
  openButton.title = note.url ? `${formatPageTitle(note)}\n${note.url}` : formatPageTitle(note);
  openButton.addEventListener('click', () => onOpen(note));

  const text = document.createElement('p');
  text.className = 'note-text';
  text.textContent = note.text;

  const meta = document.createElement('div');
  meta.className = 'note-meta';

  const title = document.createElement('p');
  title.className = 'note-title';
  title.textContent = formatPageTitle(note);
  title.title = formatPageTitle(note);

  const url = document.createElement('p');
  url.className = 'note-url';
  url.textContent = formatPageUrl(note);
  url.title = formatPageUrl(note);

  meta.append(title, url);
  openButton.append(text, meta);
  item.appendChild(openButton);

  if (!note.completed) {
    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.className = 'complete-button';
    completeButton.textContent = '完了にする';
    completeButton.addEventListener('click', () => onComplete(note));
    const actions = document.createElement('div');
    actions.className = 'note-actions';
    actions.appendChild(completeButton);
    item.appendChild(actions);
  } else {
    const completed = document.createElement('p');
    completed.className = 'note-completed-label';
    completed.textContent = '✓ 完了済み';
    item.appendChild(completed);
  }

  return item;
}

function splitNotesByStatus(notes) {
  return {
    active: notes.filter((note) => !note.completed),
    completed: notes.filter((note) => note.completed),
  };
}

function getVisibleNotesByFilter(notesByStatus, filter) {
  if (filter === 'completed') return notesByStatus.completed;
  if (filter === 'all') return [...notesByStatus.active, ...notesByStatus.completed];
  return notesByStatus.active;
}

function updateTabLabels(notesByStatus) {
  const counts = {
    active: notesByStatus.active.length,
    completed: notesByStatus.completed.length,
    all: notesByStatus.active.length + notesByStatus.completed.length,
  };

  document.querySelectorAll('.note-tab').forEach((tab) => {
    const filter = tab.dataset.filter;
    tab.textContent = `${TAB_LABELS[filter]} ${counts[filter]}`;
    tab.setAttribute('aria-selected', String(filter === currentNoteFilter));
  });
}

async function renderNotes() {
  const list = document.getElementById('notes');
  const status = document.getElementById('status');
  const notes = await window.webShioriStorage.getAllNotes();
  const sortedNotes = [...notes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const notesByStatus = splitNotesByStatus(sortedNotes);
  const visibleNotes = getVisibleNotesByFilter(notesByStatus, currentNoteFilter);

  list.replaceChildren();
  updateTabLabels(notesByStatus);

  if (sortedNotes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-notes';
    empty.textContent = EMPTY_LIST_MESSAGE;
    list.appendChild(empty);
    status.textContent = '';
    return;
  }

  if (visibleNotes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-notes';
    empty.textContent = EMPTY_FILTER_MESSAGES[currentNoteFilter];
    list.appendChild(empty);
    status.textContent = `${TAB_LABELS[currentNoteFilter]} 0件`;
    return;
  }

  visibleNotes.forEach((note) => {
    list.appendChild(createNoteItem(note, async (targetNote) => {
      await window.webShioriStorage.updateNote(targetNote.id, { completed: true });
      await refreshTabsForUrl(targetNote.url);
      await renderNotes();
    }, openOrFocusNoteUrl));
  });

  status.textContent = `${TAB_LABELS[currentNoteFilter]} ${visibleNotes.length}件 / 全${sortedNotes.length}件`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('note');
  const saveButton = document.getElementById('save');
  const noteTabs = document.querySelectorAll('.note-tab');

  noteTabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      currentNoteFilter = tab.dataset.filter || 'active';
      await renderNotes();
    });
  });

  saveButton.addEventListener('click', async () => {
    const noteText = (textarea.value || '').trim();
    if (!noteText) return;

    const tab = await getActiveTab();
    if (!tab?.url) return;

    const pageContext = await getPageContext(tab);

    const anchor = getAnchorFromPosition(pageContext.position);

    await window.webShioriStorage.addNote({
      url: pageContext.url,
      title: pageContext.title,
      text: noteText,
      x: pageContext.position.x,
      y: pageContext.position.y,
      position: pageContext.position,
      ...(pageContext.position.targetUrl ? { targetUrl: pageContext.position.targetUrl } : {}),
      ...(pageContext.position.anchorUrl ? { anchorUrl: pageContext.position.anchorUrl } : {}),
      ...(anchor ? { anchor } : {}),
      completed: false,
    });

    textarea.value = '';
    await refreshTabsForUrl(pageContext.url);
    await renderNotes();
  });

  renderVersion();
  await renderNotes();
});
