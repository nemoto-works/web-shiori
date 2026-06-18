async function sendQuickEntryMessage(tab) {
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'WEB_SHIORI_QUICK_ENTRY' });
  } catch (error) {
    // Content scripts are unavailable on browser internal pages and restricted URLs.
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'quick-entry') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await sendQuickEntryMessage(tab);
});
