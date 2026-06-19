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

function getNoteUrlCandidates(note) {
  return [
    note?.url,
    note?.targetUrl,
    note?.anchorUrl,
    note?.anchor?.targetUrl,
    note?.anchor?.anchorUrl,
  ].filter(Boolean);
}

function noteMatchesUrl(note, url) {
  const normalizedUrl = normalizeUrl(url);
  return getNoteUrlCandidates(note).some((candidateUrl) => normalizeUrl(candidateUrl) === normalizedUrl);
}

function getNotesForUrl(url) {
  return getAllNotes().then((notes) => notes.filter((note) => noteMatchesUrl(note, url)));
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
  getNoteUrlCandidates,
  noteMatchesUrl,
  setAllNotes,
  addNote,
  updateNote,
};
