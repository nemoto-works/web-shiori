document.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('note');
  const saveButton = document.getElementById('save');

  saveButton.addEventListener('click', async () => {
    const noteText = (textarea.value || '').trim();
    if (!noteText) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    // MVP defaults
    const defaultX = 120;
    const defaultY = 160;

    await window.webShioriStorage.addNote({
      url: tab.url,
      title: tab.title || '',
      text: noteText,
      x: defaultX,
      y: defaultY,
      completed: false,
    });

    textarea.value = '';
    window.close();
  });
});
