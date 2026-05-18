# DeepSeek Helper

通用 AI 问答浏览器扩展，任意网页按 **Ctrl+Shift+Q** 唤醒浮窗，支持文字 + 截图提问。

## 功能

- 任意页面呼出问答浮窗
- 输入文字或粘贴截图（Ctrl+V 粘贴图片）
- 接入 DeepSeek Chat API
- API Key 本地存储，缺省时浮窗内直接配置
- 浮窗可拖动、可最小化
- 快捷键可通过 `chrome://extensions/shortcuts` 自定义

## 安装

1. 克隆仓库或下载 ZIP 解压
2. Chrome → `chrome://extensions` → 开启「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择项目目录
4. 在浮窗中或扩展设置页配置 API Key

## API Key

在 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 创建，充值后即可使用。

## 快捷键

| 操作 | 默认快捷键 |
|------|-----------|
| 呼出/关闭浮窗 | Ctrl+Shift+Q |
| 发送消息 | Ctrl+Enter |

快捷键可在 `chrome://extensions/shortcuts` 修改。

## 许可证

MIT
