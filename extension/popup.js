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

async function refreshActiveTabNotes(tab) {
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'WEB_SHIORI_REFRESH_NOTES' });
  } catch (error) {
    // The active tab may not have the content script, such as browser internal pages.
  }
}

function renderVersion() {
  const versionEl = document.getElementById('version');
  const manifest = chrome.runtime.getManifest?.();
  if (!versionEl || !manifest?.version) return;

  versionEl.textContent = `v${manifest.version}`;
}

function formatPageContext(note) {
  return note.title || note.url || 'ページ情報なし';
}

function createNoteItem(note, onComplete) {
  const item = document.createElement('li');
  item.className = `note-item${note.completed ? ' note-item--completed' : ''}`;

  const text = document.createElement('p');
  text.className = 'note-text';
  text.textContent = note.text;

  const context = document.createElement('p');
  context.className = 'note-context';
  context.textContent = formatPageContext(note);

  item.append(text, context);

  if (!note.completed) {
    const completeButton = document.createElement('button');
    completeButton.type = 'button';
    completeButton.className = 'complete-button';
    completeButton.textContent = '完了にする';
    completeButton.addEventListener('click', () => onComplete(note.id));
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
    list.appendChild(createNoteItem(note, async (id) => {
      const tab = await getActiveTab();
      await window.webShioriStorage.updateNote(id, { completed: true });
      await refreshActiveTabNotes(tab);
      await renderNotes();
    }));
  });

  status.textContent = `${sortedNotes.length}件の付箋を表示中`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('note');
  const saveButton = document.getElementById('save');

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

    textarea.value = '';
    await refreshActiveTabNotes(tab);
    await renderNotes();
  });

  renderVersion();
  await renderNotes();
});
