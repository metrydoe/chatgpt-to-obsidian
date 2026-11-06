# ChatGPT → Obsidian

[English](#english) · [中文](#中文)

## English

Save the currently loaded ChatGPT conversation from Chrome as editable Obsidian
Markdown, with TeX, code, local images and supported interactive components.

[Installation](docs/INSTALL.md) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md)

Experimental community project. The full installation currently targets
**Windows, Google Chrome and Obsidian Desktop**. Extension **0.8.2**;
Obsidian plugin **0.5.1**. Python **3.10+** is required. No model API key,
Python packages or Node.js are needed for normal use.

### Install

1. Download/clone the whole project into a permanent directory.
2. Open your target vault in Obsidian, then run from the project directory:

   ```powershell
   python install.py --vault 'D:\Notes\MyVault'
   ```

3. Open `chrome://extensions/`, enable Developer mode and use **Load unpacked**
   to select the project's `extension/` directory.
4. Enable **ChatGPT Learning Widgets** in Obsidian's community plugin settings.
5. Open a specific ChatGPT conversation and click the extension. Verify the
   connected vault name, then archive. Load earlier messages first for long chats.

Notes, source archives, attachments and reports stay in your selected vault.
There is no telemetry or project upload server. Capturing downloads resources
from the active page and permitted image/resource sites. The background downloader
omits credentials; same-origin page downloads may use the page session.

### Scope

The collector attempts to retrieve full documents from attached editors, rejects
code whose completeness cannot be established, and checks saved file hashes.
Supported source programs run locally with shared state between inline widgets.
The DIL runtime is a local compatibility implementation, not the ChatGPT runtime.

This does not guarantee all account history, identical appearance or arbitrary
JavaScript/iframe/canvas behavior. Unsupported components and unavailable assets
are recorded as losses. File verification is separate from visual verification.
The extension and plugin are distributed as source, not through application stores.

### Development

Node.js 20+ is needed only for development checks.

```powershell
python build_plugin.py
python tools/check.py
python -m unittest discover -s tests -v
```

Tests use synthetic content and temporary Chrome profiles. Do not commit local
configuration, recovery caches, plugin state, personal notes or source archives.

MIT license. See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled KaTeX.
Independent project, not affiliated with OpenAI, Google or Obsidian.

---

## 中文

把 Chrome 中当前 ChatGPT 对话保存为可编辑的 Obsidian 学习笔记，尽量保留公式、完整代码、本地图片和可取得的交互程序。

[安装说明](docs/INSTALL.md) · [架构与限制](docs/ARCHITECTURE.md) · [参与开发](CONTRIBUTING.md)

**实验性社区项目，当前完整安装链路支持 Windows + Chrome + Obsidian 桌面版。**
Chrome 扩展版本 **0.8.2**，Obsidian 插件版本 **0.5.1**。

### 能做什么

- 保存提问与回答为原生 Markdown，支持标题、列表、表格、TeX 和代码围栏。
- 下载能够取得的配图、SVG 和依赖到本地，核对附件 SHA-256。
- 对关联到页面的 CodeMirror、Monaco、Ace 编辑器读取完整文档；无法确认代码完整时停止归档。
- 将支持的交互程序以 `chatgpt-widget` 组件放回笔记正文，同一程序的多个视图共享状态。
- 保留原件及归档报告；新采集生成带内容指纹的快照，已有笔记的修改不会被静默覆盖。
- 提供旧整篇播放器笔记的转换器，默认预览，显式 `--apply` 才改写并备份。

### 快速开始

需要 Python **3.10 或更高版本**、Google Chrome、Obsidian 桌面版。接收程序只用 Python 标准库，不需要 API Key 或付费模型 API。

1. 下载本仓库或发布包并解压到固定目录，例如 `D:\Tools\chatgpt-to-obsidian`。保留整个目录，安装后不要移动。
2. 在 Obsidian 中打开目标库。在项目目录运行：

   ```powershell
   python install.py --vault 'D:\Notes\MyVault'
   ```

3. 打开 Chrome 的 `chrome://extensions/`，开启开发者模式，点击“加载未打包的扩展程序”，选择项目中的 **`extension`** 文件夹。
4. 在 Obsidian“设置 → 第三方插件”中启用 **ChatGPT Learning Widgets**。
5. 打开一条具体的 ChatGPT 对话，点击 Chrome 工具栏中的扩展。显示“已连接 · 你的库名”后，点击“归档到 Obsidian”。长对话先加载早期消息，归档期间保持弹窗打开。

安装、升级、移库、权限、卸载和故障排查见[完整安装说明](docs/INSTALL.md)。扩展以源码方式安装，尚未发布到 Chrome 应用商店或 Obsidian 社区插件目录。

### 数据和权限

归档正文、原件和附件保存在你指定的本地笔记库。工程本身没有遥测、上传服务器或模型 API 调用；采集时仍需要访问当前 ChatGPT 页面及配图/资源网站。

扩展权限包括 `activeTab`、`scripting` 和 `nativeMessaging`。对额外图片网站的访问按需申请；后台下载不携带站点凭据。页面内同源下载可能使用当前页面的会话。交互程序在隔离框架中运行，支持的原生组件桥接限制网络访问。

不要将自己的 `host/config.json`、`host/recovery/`、`recovery/`、`backups/`、`data.json` 或生成的归档提交到公共仓库。仓库的 `.gitignore` 已排除这些运行文件。内置 KaTeX 与字体供离线公式使用；项目只带人工编写的合成示例。

### 已知限制

- 页面结构和 ChatGPT 组件会变化，采集可能失败；当前分支的已加载内容不等于账户全部历史。
- 不承诺任意网页外观或任意 JavaScript、iframe、canvas 能完全迁移。
- 本地 DIL 兼容运行时覆盖一部分组件，并非 ChatGPT 原运行环境。未支持组件、失效图片、外部服务和模块依赖会记录在报告中。
- 无法证明完整的滚动代码可能被拒绝保存；需要返回原对话取得完整源码。
- Native Messaging 请求上限 40 MB，单附件/归档 JSON 上限 8 MB，附件总量上限 24 MB；采集端另有依赖资源限制。
- 文件校验成功代表磁盘文件一致，界面与交互效果还需要在实际笔记中核对。

### 开发和验证

开发时额外需要 Node.js 20 或更高版本，用于 JavaScript 语法检查。安装使用不需要 Node.js。

```powershell
python build_plugin.py
python tools/check.py
python -m unittest discover -s tests -v
```

`build_plugin.py` 将 `plugin-src/main.js` 及共享运行时打包为 `obsidian-plugin/main.js`；只保留 Obsidian 提供的外部 API 依赖。浏览器测试使用临时独立 Chrome 配置和合成页面，不接触个人浏览记录或真实对话。`docs/github-actions.example.yml` 提供可手动启用的 Windows CI 示例；将其复制到 `.github/workflows/ci.yml` 后提交即可启用。

### 许可证

项目源码使用 [MIT License](LICENSE)。KaTeX 与字体的原始许可保留在 `vendor/LICENSE`，见[第三方声明](THIRD_PARTY_NOTICES.md)。本项目独立开发，与 OpenAI、Google、Obsidian 官方无隶属关系。
