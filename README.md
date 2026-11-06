# ChatGPT → Obsidian

[安装指南 / Installation](docs/INSTALL.md) · [架构 / Architecture](docs/ARCHITECTURE.md) · [English only](README.en.md) · [Contributing](CONTRIBUTING.md)

## 项目简介 / Overview

| 中文 | English |
| --- | --- |
| 将 Chrome 中当前 ChatGPT 对话保存为可编辑的 Obsidian 学习笔记，保留可取得的公式、完整代码、本地图片和支持的交互组件。 | Save the currently loaded ChatGPT conversation from Chrome as editable Obsidian notes, including available TeX, complete code, local images and supported interactive components. |
| 实验性社区项目；完整安装链路支持 Windows 10/11、Google Chrome 和 Obsidian 桌面版。 | Experimental community project. The complete installation pipeline supports Windows 10/11, Google Chrome and Obsidian Desktop. |
| Chrome 扩展 **0.8.2**；Obsidian 插件 **0.5.1**；需要 Python **3.10+**。 | Chrome extension **0.8.2**; Obsidian plugin **0.5.1**; requires Python **3.10+**. |
| 安装使用只需 Python 标准库，不需要模型 API Key、额外 Python 包或 Node.js。 | Normal use requires only the Python standard library. No model API key, additional Python packages or Node.js is needed. |

## 功能 / Features

| 中文 | English |
| --- | --- |
| 保存提问与回答为原生 Markdown，保留标题、列表、表格、TeX 和代码围栏。 | Export questions and answers as native Markdown, retaining headings, lists, tables, TeX and fenced code blocks. |
| 将能够取得的图片、SVG 和依赖下载到本地，并核对附件 SHA-256。 | Download accessible images, SVGs and dependencies locally and verify attachment SHA-256 hashes. |
| 读取与当前页面关联的 CodeMirror、Monaco、Ace 编辑器完整文档；无法确认代码完整时停止归档。 | Read complete documents from CodeMirror, Monaco and Ace editors associated with the current page; stop archiving when code completeness cannot be established. |
| 把支持的原程序组件以 `chatgpt-widget` 放在对应段落，同一程序的多个视图共享状态。 | Place supported source-program components inline as `chatgpt-widget` blocks, with shared state between views of the same program. |
| 保存原件、归档报告和内容指纹快照；保留已有笔记中的用户修改。 | Keep source archives, reports and content-addressed snapshots, preserving user edits in existing readable notes. |
| 提供旧整篇播放器笔记的转换器；默认预览，显式 `--apply` 才改写并备份。 | Provide a converter for older whole-note player exports; preview by default and require explicit `--apply` to modify and back up notes. |

## 快速开始 / Quick start

| 中文 | English |
| --- | --- |
| **1.** 下载整个项目，解压到固定目录，例如 `D:\Tools\chatgpt-to-obsidian`。安装后保留原目录。 | **1.** Download the entire project into a permanent directory, such as `D:\Tools\chatgpt-to-obsidian`. Keep that directory after installation. |
| **2.** 在 Obsidian 中打开目标库，再从项目目录运行下方命令，将示例路径替换成你的库路径。 | **2.** Open your target vault in Obsidian, then run the command below from the project directory, replacing the example path with your vault path. |

```powershell
python install.py --vault 'D:\Notes\MyVault'
```

| 中文 | English |
| --- | --- |
| **3.** 打开 Chrome 的 `chrome://extensions/`，启用“开发者模式”，点击“加载未打包的扩展程序”，选择项目的 **`extension`** 子目录。 | **3.** Open `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select the project’s **`extension`** subdirectory. |
| **4.** 在 Obsidian“设置 → 第三方插件”中启用 **ChatGPT Learning Widgets**。 | **4.** Enable **ChatGPT Learning Widgets** in Obsidian’s **Settings → Community plugins**. |
| **5.** 打开具体的 ChatGPT 对话，点击归档扩展，核对“已连接 · 库名”，再点击“归档到 Obsidian”。长对话先加载早期消息，归档期间保持弹窗打开。 | **5.** Open a specific ChatGPT conversation, click the extension, verify the connected vault name, then click **归档到 Obsidian** (*Archive to Obsidian*). Load earlier messages for long chats and keep the popup open while archiving. |
| 扩展当前界面与生成的文件名使用中文。完整安装、升级、移库和故障排查见[安装指南](docs/INSTALL.md)。扩展和插件尚未上架应用商店。 | The current extension interface and generated filenames use Chinese. See the bilingual [installation guide](docs/INSTALL.md) for setup, updates, vault changes and troubleshooting. The extension and plugin are not listed in application stores. |

## 数据和权限 / Data and permissions

| 中文 | English |
| --- | --- |
| 正文、原件和附件保存在指定的本地笔记库；项目没有遥测、上传服务器或模型 API 调用。 | Notes, source archives and attachments are stored in your selected local vault. The project has no telemetry, upload server or model API calls. |
| 采集会访问当前 ChatGPT 页面及配图或依赖网站；后台下载不携带站点凭据，页面内同源下载可能使用页面会话。 | Capture accesses the active ChatGPT page and image or dependency sites. Background downloads omit credentials; same-origin page downloads may use the page session. |
| 基础权限是 `activeTab`、`scripting`、`nativeMessaging`；额外图片网站权限按需申请。 | Core permissions are `activeTab`, `scripting` and `nativeMessaging`. Access to additional image sites is requested when needed. |
| 支持的原生组件通过受限消息桥与隔离框架交换动作和状态，原程序不直接进入 Obsidian 主窗口执行。 | Supported native components exchange actions and state with isolated frames through a restricted message bridge. Source programs do not execute directly in the main Obsidian window. |
| 不要公开上传 `host/config.json`、`host/recovery/`、`recovery/`、`backups/`、`data.json` 或个人归档；`.gitignore` 已排除这些运行文件。 | Do not publish `host/config.json`, `host/recovery/`, `recovery/`, `backups/`, `data.json` or personal archives. These runtime files are excluded by `.gitignore`. |

## 已知限制 / Known limitations

| 中文 | English |
| --- | --- |
| 采集范围是当前分支的已加载内容，不等于账户全部历史；ChatGPT 页面变化也可能导致采集失败。 | Capture covers loaded content in the current branch, not all account history. Changes to ChatGPT’s page structure may break capture. |
| 不保证任意网页外观或任意 JavaScript、iframe、canvas 都能完整迁移。 | Identical appearance and complete migration of arbitrary JavaScript, iframes or canvas behavior are not guaranteed. |
| 本地 DIL 兼容运行时只覆盖部分组件，并非 ChatGPT 原运行环境。未支持组件、失效图片、外部服务和模块依赖会记录在报告中。 | The local DIL compatibility runtime supports a subset of components and is not the original ChatGPT runtime. Reports record unsupported components, expired images, external services and unresolved module dependencies. |
| 无法证明完整的滚动代码可能被拒绝；缺失源码需要返回原对话取得。 | Scrollable code may be rejected when completeness cannot be proven. Missing source must be retrieved from the original conversation. |
| Native Messaging 请求上限 40 MB；单附件或归档 JSON 上限 8 MB；附件总量上限 24 MB，采集端另有依赖资源限制。 | Native Messaging requests are limited to 40 MB, individual attachments or archive JSON to 8 MB, and total attachments to 24 MB. The collector also applies dependency-resource limits. |
| 文件校验只证明磁盘文件与记录一致；实际外观和交互仍须在 Obsidian 中核对。 | File verification establishes consistency with saved records. Visual appearance and interactive behavior still need to be checked in Obsidian. |

## 开发和验证 / Development and validation

| 中文 | English |
| --- | --- |
| 开发检查额外需要 Node.js **20+**；从仓库根目录运行下方命令。 | Development checks additionally require Node.js **20+**. Run the commands below from the repository root. |

```powershell
python build_plugin.py
python tools/check.py
python -m unittest discover -s tests -v
```

| 中文 | English |
| --- | --- |
| 修改 `plugin-src/main.js` 和共享运行时后，运行构建脚本生成 `obsidian-plugin/main.js`。插件只保留 Obsidian 提供的 API 依赖。 | After editing `plugin-src/main.js` or shared runtimes, rebuild `obsidian-plugin/main.js`. The bundle retains only the API dependency provided by Obsidian. |
| 浏览器测试使用合成内容和独立临时 Chrome 配置，不读取个人浏览记录或真实对话。 | Browser tests use synthetic content and fresh temporary Chrome profiles, without reading personal browsing history or real conversations. |
| [Windows CI 示例](docs/github-actions.example.yml) 可手动复制到 `.github/workflows/ci.yml` 并提交后启用；当前未自动启用。 | To enable the optional [Windows CI example](docs/github-actions.example.yml), copy it to `.github/workflows/ci.yml` and commit it. It is not enabled automatically. |

## 许可证 / License

| 中文 | English |
| --- | --- |
| 源码采用 [MIT License](LICENSE)。内置 KaTeX 与字体保留原始许可证，见[第三方声明](THIRD_PARTY_NOTICES.md)。 | Source code is licensed under the [MIT License](LICENSE). Bundled KaTeX and fonts retain their original license; see [third-party notices](THIRD_PARTY_NOTICES.md). |
| 独立社区项目，与 OpenAI、Google、Obsidian 官方无隶属关系；示例均为人工合成。 | Independent community project, not affiliated with OpenAI, Google or Obsidian. All included examples are synthetic. |
