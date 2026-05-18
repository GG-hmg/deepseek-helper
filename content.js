// DeepSeek Helper — Content Script
(() => {
  "use strict";

  let overlay = null;
  let apiKey = "";
  let model = "deepseek-chat";
  let imageBase64 = null;

  // Load config
  chrome.storage.sync.get(["apiKey", "model"], (d) => {
    apiKey = d.apiKey || "";
    model = d.model || "deepseek-chat";
  });

  // Listen for toggle command from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE") toggle();
  });

  function toggle() {
    if (overlay) {
      overlay.remove();
      overlay = null;
      return;
    }
    loadConfig(() => {
      overlay = createOverlay();
      document.body.appendChild(overlay);
      focusInput();
    });
  }

  function loadConfig(cb) {
    chrome.storage.sync.get(["apiKey", "model"], (d) => {
      apiKey = d.apiKey || "";
      model = d.model || "deepseek-chat";
      cb();
    });
  }

  function createOverlay() {
    const el = document.createElement("div");
    el.id = "ds-helper-overlay";
    el.innerHTML = `
      <div class="ds-header">
        <span>DeepSeek Helper</span>
        <div>
          <button id="ds-mini" title="最小化">_</button>
          <button id="ds-close" title="关闭">x</button>
        </div>
      </div>
      <div class="ds-body"></div>
      <div class="ds-key-box" style="display:none">
        <input type="password" placeholder="API Key (sk-...)" id="ds-key-input">
        <div class="ds-key-btns"><button id="ds-key-save">保存</button></div>
      </div>
      <div class="ds-input-area">
        <textarea id="ds-input" rows="1" placeholder="输入问题... (Ctrl+Enter 发送, 可粘贴图片)"></textarea>
        <button id="ds-submit" title="发送">></button>
      </div>
      <div class="ds-footer">
        <span>Ctrl+Shift+Q 呼出</span>
        <span class="ds-paste-hint" id="ds-paste-img">粘贴截图</span>
        <span style="flex:1"></span>
      </div>`;

    // Drag
    const header = el.querySelector(".ds-header");
    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      const ox = e.clientX - el.offsetLeft;
      const oy = e.clientY - el.offsetTop;
      const move = (ev) => { el.style.left = (ev.clientX - ox) + "px"; el.style.top = (ev.clientY - oy) + "px"; el.style.right = "auto"; el.style.bottom = "auto"; };
      const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });

    // Buttons
    el.querySelector("#ds-close").addEventListener("click", () => { el.remove(); overlay = null; });
    el.querySelector("#ds-mini").addEventListener("click", () => { el.classList.toggle("ds-mini"); });

    // Submit
    el.querySelector("#ds-submit").addEventListener("click", submit);
    el.querySelector("#ds-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
    });

    // Paste image hint
    el.querySelector("#ds-paste-img").addEventListener("click", () => {
      navigator.clipboard.readText().then((t) => {
        el.querySelector("#ds-input").value = t;
        focusInput();
      }).catch(() => {});
    });

    // Clipboard paste (image)
    el.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = () => {
            imageBase64 = reader.result.split(",")[1];
            showImgTag();
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    });

    // API key save
    el.querySelector("#ds-key-save").addEventListener("click", () => {
      const val = el.querySelector("#ds-key-input").value.trim();
      if (!val) return;
      apiKey = val;
      chrome.storage.sync.set({ apiKey }, () => {
        el.querySelector(".ds-key-box").style.display = "none";
        focusInput();
      });
    });

    // Re-fetch config after storage change
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.apiKey) apiKey = changes.apiKey.newValue || "";
      if (changes.model) model = changes.model.newValue || "deepseek-chat";
    });

    return el;
  }

  function showImgTag() {
    if (!overlay) return;
    const footer = overlay.querySelector(".ds-footer");
    let tag = footer.querySelector(".ds-img-tag");
    if (!tag) {
      tag = document.createElement("span");
      tag.className = "ds-img-tag";
      const btn = document.createElement("button");
      btn.textContent = "x";
      btn.addEventListener("click", () => { imageBase64 = null; tag.remove(); });
      tag.appendChild(btn);
      tag.appendChild(document.createTextNode(" 已粘贴截图"));
      footer.querySelector("span:last-child").before(tag);
    } else {
      tag.querySelector("button").nextSibling.textContent = " 已粘贴截图";
    }
  }

  function focusInput() {
    setTimeout(() => {
      const inp = overlay?.querySelector("#ds-input");
      if (inp) inp.focus();
    }, 100);
  }

  async function submit() {
    if (!overlay) return;
    const body = overlay.querySelector(".ds-body");
    const input = overlay.querySelector("#ds-input");
    const btn = overlay.querySelector("#ds-submit");
    const text = input.value.trim();

    if (!text && !imageBase64) return;
    if (!apiKey) {
      overlay.querySelector(".ds-key-box").style.display = "flex";
      overlay.querySelector("#ds-key-input").focus();
      return;
    }

    btn.disabled = true;
    body.className = "ds-body ds-loading";
    body.textContent = "正在思考...";
    overlay.querySelector(".ds-key-box").style.display = "none";

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "QUERY",
        payload: { text, image: imageBase64, apiKey, model },
      });

      if (resp.needKey || resp.invalidKey) {
        apiKey = "";
        chrome.storage.sync.set({ apiKey: "" }, () => {});
        overlay.querySelector(".ds-key-box").style.display = "flex";
        overlay.querySelector("#ds-key-input").value = "";
        overlay.querySelector("#ds-key-input").focus();
        body.textContent = "API Key 无效，请重新输入";
        body.className = "ds-body ds-error";
      } else if (resp.error) {
        body.textContent = "错误: " + resp.error;
        body.className = "ds-body ds-error";
      } else {
        body.textContent = resp.result || "(无内容)";
        body.className = "ds-body";
        input.value = "";
        imageBase64 = null;
        const tag = overlay.querySelector(".ds-img-tag");
        if (tag) tag.remove();
      }
    } catch (e) {
      body.textContent = "请求失败: " + e.message;
      body.className = "ds-body ds-error";
    } finally {
      btn.disabled = false;
    }
  }
})();
