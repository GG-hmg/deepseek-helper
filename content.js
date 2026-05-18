// DeepSeek Helper — Content Script
(() => {
  "use strict";

  let overlay = null;
  let apiKey = "";
  let model = "deepseek-chat";
  let images = []; // [{base64, id}]

  function initConfig() {
    chrome.storage.sync.get(["apiKey", "model"], (d) => {
      apiKey = d.apiKey || "";
      model = d.model || "deepseek-chat";
    });
  }
  initConfig();

  console.log("[ds-helper] content script loaded on", location.href);

  // ---- 唤醒方式 1: 直接监听键盘 ----
  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyQ" && e.ctrlKey && e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  });

  // ---- 唤醒方式 2: background 命令转发 ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE") toggle();
  });

  function toggle() {
    if (overlay) {
      overlay.remove();
      overlay = null;
      return;
    }
    chrome.storage.sync.get(["apiKey", "model"], (d) => {
      apiKey = d.apiKey || "";
      model = d.model || "deepseek-chat";
      overlay = createOverlay();
      document.body.appendChild(overlay);
      focusInput();
    });
  }

  function createOverlay() {
    const el = document.createElement("div");
    el.id = "ds-helper-overlay";
    el.innerHTML = `
      <div class="ds-header">
        <span>DeepSeek Helper</span>
        <div class="ds-header-actions">
          <button id="ds-mini" title="最小化">&minus;</button>
          <button id="ds-close" class="ds-btn-close" title="关闭">&times;</button>
        </div>
      </div>
      <div class="ds-body"></div>
      <div class="ds-key-row">
        <input type="password" placeholder="API Key (sk-...)" id="ds-key-input">
        <div class="ds-key-btns"><button id="ds-key-save">保存</button></div>
      </div>
      <div class="ds-input-row">
        <textarea id="ds-input" rows="1" placeholder="输入问题... (贴图仅参考，需配合文字)"></textarea>
        <button id="ds-submit" class="ds-btn-send" title="发送">&nearr;</button>
      </div>
      <div class="ds-footer-bar">
        <span>Ctrl+Shift+Q 呼出</span>
        <span class="ds-hint" id="ds-paste-img">粘贴文字</span>
        <span class="ds-spacer"></span>
      </div>`;

    // 拖动
    const header = el.querySelector(".ds-header");
    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") return;
      const ox = e.clientX - el.offsetLeft;
      const oy = e.clientY - el.offsetTop;
      const move = (ev) => {
        el.style.left = (ev.clientX - ox) + "px";
        el.style.top = (ev.clientY - oy) + "px";
        el.style.right = "auto";
        el.style.bottom = "auto";
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });

    // 按钮
    el.querySelector("#ds-close").addEventListener("click", () => { el.remove(); overlay = null; });
    el.querySelector("#ds-mini").addEventListener("click", () => { el.classList.toggle("ds-mini"); });

    // 提交
    el.querySelector("#ds-submit").addEventListener("click", submit);
    el.querySelector("#ds-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
    });

    // 粘贴文字
    el.querySelector("#ds-paste-img").addEventListener("click", () => {
      navigator.clipboard.readText().then((t) => {
        el.querySelector("#ds-input").value = t;
        focusInput();
      }).catch(() => {});
    });

    // 粘贴图片（支持多次粘贴，追加不覆盖）
    el.addEventListener("paste", (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(",")[1];
            const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
            images.push({ base64, id });
            addPreviewCard(base64, id);
            updateBadge();
          };
          reader.readAsDataURL(item.getAsFile());
          return;
        }
      }
    });

    // 保存 API Key
    el.querySelector("#ds-key-save").addEventListener("click", () => {
      const val = el.querySelector("#ds-key-input").value.trim();
      if (!val) return;
      apiKey = val;
      chrome.storage.sync.set({ apiKey }, () => {
        el.querySelector(".ds-key-row").style.display = "none";
        focusInput();
      });
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.apiKey) apiKey = changes.apiKey.newValue || "";
      if (changes.model) model = changes.model.newValue || "deepseek-chat";
    });

    return el;
  }

  function addPreviewCard(base64, id) {
    if (!overlay) return;
    const body = overlay.querySelector(".ds-body");

    const card = document.createElement("div");
    card.className = "ds-img-card";
    card.dataset.imgId = id;
    card.style.cssText = "display:inline-block;margin:0 6px 6px 0;position:relative;vertical-align:top;";

    const img = document.createElement("img");
    img.src = "data:image/png;base64," + base64;
    img.style.cssText = "max-width:120px;max-height:120px;border-radius:8px;border:1px solid #33333d;display:block;";

    const rm = document.createElement("button");
    rm.textContent = "x";
    rm.style.cssText = "position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;border:none;cursor:pointer;font-size:11px;line-height:1;";
    rm.addEventListener("click", () => {
      images = images.filter((img) => img.id !== id);
      card.remove();
      updateBadge();
    });

    card.appendChild(img);
    card.appendChild(rm);
    body.prepend(card);
  }

  function updateBadge() {
    if (!overlay) return;
    const footer = overlay.querySelector(".ds-footer-bar");
    let badge = footer.querySelector(".ds-img-badge");
    if (images.length === 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "ds-img-badge";
      const btn = document.createElement("button");
      btn.textContent = "x";
      btn.addEventListener("click", () => { clearAllImages(); });
      badge.appendChild(btn);
      badge.appendChild(document.createTextNode(""));
      const spacer = footer.querySelector(".ds-spacer");
      spacer.before(badge);
    }
    badge.querySelector("button").nextSibling.textContent =
      ` ${images.length} 张截图`;
  }

  function clearAllImages() {
    images = [];
    if (overlay) {
      overlay.querySelectorAll(".ds-img-card").forEach((c) => c.remove());
      const badge = overlay.querySelector(".ds-img-badge");
      if (badge) badge.remove();
    }
  }

  function focusInput() {
    setTimeout(() => {
      overlay?.querySelector("#ds-input")?.focus();
    }, 100);
  }

  async function submit() {
    if (!overlay) return;
    const body = overlay.querySelector(".ds-body");
    const input = overlay.querySelector("#ds-input");
    const btn = overlay.querySelector("#ds-submit");
    const text = input.value.trim();

    if (!text && images.length === 0) return;
    if (!text && images.length > 0) {
      body.className = "ds-body ds-error";
      body.textContent = "当前模型不支持视觉识别，请用文字描述截图内容后发送";
      return;
    }
    if (!apiKey) {
      overlay.querySelector(".ds-key-row").style.display = "flex";
      overlay.querySelector("#ds-key-input").focus();
      return;
    }

    btn.disabled = true;
    body.className = "ds-body ds-loading";
    body.textContent = "正在思考...";
    overlay.querySelector(".ds-key-row").style.display = "none";

    try {
      const resp = await chrome.runtime.sendMessage({
        type: "QUERY",
        payload: {
          text,
          images: images.map((img) => img.base64),
          apiKey,
          model,
        },
      });

      if (resp.needKey || resp.invalidKey) {
        apiKey = "";
        chrome.storage.sync.set({ apiKey: "" });
        overlay.querySelector(".ds-key-row").style.display = "flex";
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
        clearAllImages();
      }
    } catch (e) {
      body.textContent = "请求失败: " + e.message;
      body.className = "ds-body ds-error";
    } finally {
      btn.disabled = false;
    }
  }
})();
