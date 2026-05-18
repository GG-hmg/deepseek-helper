// Popup — 点击扩展图标后向当前标签页发送 toggle 消息
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE" }).catch(() => {});
  }
  window.close();
})();
