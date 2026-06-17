const STORAGE_KEY = 'web-shiori-notes';

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch (e) {
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

function addNote(note) {
  return getAllNotes().then((notes) => {
    notes.push(note);
    return setAllNotes(notes).then(() => note);
  });
}

function updateNote(id, patch) {
  return getAllNotes().then((notes) => {
    const idx = notes.findIndex((n) => n.id === id);
    if (idx !== -1) {
      notes[idx] = { ...notes[idx], ...patch };
      return setAllNotes(notes);
    }
    return undefined;
  });
}

window.webShioriStorage = {
  normalizeUrl,
  getAllNotes,
  setAllNotes,
  addNote,
  updateNote,
};
