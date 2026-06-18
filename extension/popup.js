const EMPTY_LIST_MESSAGE = '保存された付箋はありません。';

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

function normalizeUrlForCompare(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch (error) {
    return url || '';
  }
}

function formatPageContext(note) {
  return note.title || note.url || 'ページ情報なし';
}

function getManifestVersion() {
  return chrome.runtime?.getManifest?.().version || '';
}

async function refreshTabNotes(tabId) {
  if (!tabId) return;

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'WEB_SHIORI_REFRESH_NOTES' });
  } catch (error) {
    // The target page may not have the content script yet; storage remains the source of truth.
  }
}

async function refreshTabsForUrl(url) {
  if (!url) return;

  const tabs = await chrome.tabs.query({});
  const targetUrl = normalizeUrlForCompare(url);
  await Promise.all(
    tabs
      .filter((tab) => normalizeUrlForCompare(tab.url) === targetUrl)
      .map((tab) => refreshTabNotes(tab.id)),
  );
}

async function openNoteUrl(note) {
  if (!note.url) return;

  const tabs = await chrome.tabs.query({});
  const targetUrl = normalizeUrlForCompare(note.url);
  const existingTab = tabs.find((tab) => normalizeUrlForCompare(tab.url) === targetUrl);

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId) await chrome.windows?.update(existingTab.windowId, { focused: true });
    return;
  }

  await chrome.tabs.create({ url: note.url });
}

function createNoteItem(note, onComplete, onOpen) {
  const item = document.createElement('li');
  item.className = `note-item${note.completed ? ' note-item--completed' : ''}`;

  const noteButton = document.createElement('button');
  noteButton.type = 'button';
  noteButton.className = 'note-open-button';
  noteButton.addEventListener('click', () => onOpen(note));

  const text = document.createElement('p');
  text.className = 'note-text';
  text.textContent = note.text;

  const context = document.createElement('p');
  context.className = 'note-context';
  context.textContent = formatPageContext(note);

  noteButton.append(text, context);
  item.appendChild(noteButton);

  if (!note.completed) {
    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.className = 'complete-button';
    completeButton.textContent = '完了にする';
    completeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      onComplete(note);
    });
    item.appendChild(completeButton);
  } else {
    const completed = document.createElement('p');
    completed.className = 'note-completed-label';
    completed.textContent = '完了済み';
    item.appendChild(completed);
  }

  return item;
}

async function renderNotes() {
  const list = document.getElementById('notes');
  const status = document.getElementById('status');
  const notes = await window.webShioriStorage.getAllNotes();
  const sortedNotes = [...notes].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  list.replaceChildren();

  if (sortedNotes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-notes';
    empty.textContent = EMPTY_LIST_MESSAGE;
    list.appendChild(empty);
    status.textContent = '';
    return;
  }

  sortedNotes.forEach((note) => {
    list.appendChild(createNoteItem(note, async (selectedNote) => {
      await window.webShioriStorage.updateNote(selectedNote.id, { completed: true });
      await refreshTabsForUrl(selectedNote.url);
      await renderNotes();
    }, openNoteUrl));
  });

  status.textContent = `${sortedNotes.length}件の付箋を表示中`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('note');
  const saveButton = document.getElementById('save');
  const version = document.getElementById('version');
  if (version) version.textContent = `v${getManifestVersion()}`;

  saveButton.addEventListener('click', async () => {
    const noteText = (textarea.value || '').trim();
    if (!noteText) return;

    const tab = await getActiveTab();
    if (!tab?.url) return;

    const pageContext = await getPageContext(tab);

    await window.webShioriStorage.addNote({
      url: pageContext.url,
      title: pageContext.title,
      text: noteText,
      x: pageContext.position.x,
      y: pageContext.position.y,
      position: pageContext.position,
      completed: false,
    });

    await refreshTabNotes(tab.id);
    textarea.value = '';
    await renderNotes();
  });

  await renderNotes();
});
