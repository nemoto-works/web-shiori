const STORAGE_KEY = 'web-shiori-notes';

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch (error) {
    return url;
  }
}

function getAllNotes() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

function setAllNotes(notes) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: notes }, () => resolve());
  });
}

function getNotesForUrl(url) {
  const normalizedUrl = normalizeUrl(url);
  return getAllNotes().then((notes) => notes.filter((note) => normalizeUrl(note.url) === normalizedUrl));
}

function addNote(note) {
  return getAllNotes().then((notes) => {
    const now = new Date().toISOString();
    const nextNote = {
      id: note.id || crypto.randomUUID(),
      createdAt: note.createdAt || now,
      updatedAt: now,
      completed: false,
      ...note,
      url: normalizeUrl(note.url),
    };
    notes.push(nextNote);
    return setAllNotes(notes).then(() => nextNote);
  });
}

function updateNote(id, patch) {
  return getAllNotes().then((notes) => {
    const idx = notes.findIndex((note) => note.id === id);
    if (idx !== -1) {
      notes[idx] = {
        ...notes[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      return setAllNotes(notes).then(() => notes[idx]);
    }
    return undefined;
  });
}

window.webShioriStorage = {
  normalizeUrl,
  getAllNotes,
  getNotesForUrl,
  setAllNotes,
  addNote,
  updateNote,
};
