// DeepSeek Helper — Background Service Worker

try {

const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

// ---- 唤醒方式: Chrome 快捷键命令 ----
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-dialog" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE" }).catch(() => {});
  }
});

// ---- API 代理 ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "QUERY") {
    handleQuery(msg.payload).then(sendResponse).catch((e) => sendResponse({ error: e.message }));
    return true;
  }
});

async function handleQuery(payload) {
  const { text, images, apiKey } = payload;

  if (!apiKey) return { needKey: true };

  const messages = [{ role: "user", content: buildContent(text, images) }];

  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) return { invalidKey: true };
    const err = await resp.json().catch(() => ({}));
    return { error: err.error?.message || `API 错误 (${resp.status})` };
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "";
  return { result: content };
}

function buildContent(text, imgList) {
  // DeepSeek chat API 不接收 image_url，仅发文字
  // 截图保留在浮窗 UI 中作为用户的视觉参考
  return text || "";
}

} catch(e) { console.error("[ds-helper bg]", e); }
