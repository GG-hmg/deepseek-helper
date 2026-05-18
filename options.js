const elKey = document.getElementById("api-key");
const elModel = document.getElementById("model");
const elSave = document.getElementById("save");
const elStatus = document.getElementById("status");

chrome.storage.sync.get(["apiKey", "model"], (data) => {
  if (data.apiKey) elKey.value = data.apiKey;
  if (data.model) elModel.value = data.model;
});

// Make shortcuts link clickable (chrome:// URLs blocked in href)
document.getElementById("shortcuts-link").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

elSave.addEventListener("click", () => {
  const apiKey = elKey.value.trim();
  const model = elModel.value;
  chrome.storage.sync.set({ apiKey, model }, () => {
    elStatus.textContent = "已保存";
    elStatus.className = "status ok";
    setTimeout(() => { elStatus.textContent = ""; }, 2000);
  });
});
