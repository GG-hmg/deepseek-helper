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
  const { text, image, apiKey } = payload;

  if (!apiKey) return { needKey: true };

  const messages = [{ role: "user", content: buildContent(text, image) }];

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

function buildContent(text, imageBase64) {
  if (!imageBase64) return text || "";
  return [
    { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
    { type: "text", text: text || "请描述这张图片的内容" },
  ];
}

} catch(e) { console.error("[ds-helper bg]", e); }
