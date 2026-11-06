# 安装与维护 / Installation and maintenance

[README](../README.md) · [架构 / Architecture](ARCHITECTURE.md)

## 环境 / Requirements

| 中文 | English |
| --- | --- |
| Windows 10/11、Google Chrome、Obsidian 桌面版；插件声明最低 Obsidian 1.5.0。 | Windows 10/11, Google Chrome and Obsidian Desktop. The plugin manifest requires Obsidian 1.5.0 or newer. |
| Python 3.10+，确认 `python --version` 可运行。 | Python 3.10+; verify that `python --version` works. |
| 建议将项目放在简单路径，例如 `D:\Tools\chatgpt-to-obsidian`。启动器使用 Windows 系统代码页，无法表达的路径字符需要改用简单路径。 | Use a simple project path such as `D:\Tools\chatgpt-to-obsidian`. The launcher uses the Windows system code page; choose another path if its characters cannot be represented. |
| 目标库须在 Obsidian 打开过并包含 `.obsidian`。完整接收链路暂不支持 macOS、Linux、Edge 或移动端。 | Open the target vault in Obsidian at least once so it contains `.obsidian`. The full receiving pipeline does not currently support macOS, Linux, Edge or mobile. |
| `--plugin-only` 只复制插件文件，不会为其他平台提供完整采集链路。 | `--plugin-only` copies plugin files only; it does not provide a complete capture pipeline for other platforms. |

## 安装 / Installation

| 中文 | English |
| --- | --- |
| **1.** 下载整个项目，解压到固定目录，例如 `D:\Tools\chatgpt-to-obsidian`。安装后保留原目录。 | **1.** Download the entire project into a permanent directory, such as `D:\Tools\chatgpt-to-obsidian`. Keep that directory after installation. |
| **2.** 在 Obsidian 中打开目标库，再从项目目录运行下方命令，将示例路径替换成你的库路径。 | **2.** Open your target vault in Obsidian, then run the command below from the project directory, replacing the example path with your vault path. |

```powershell
python install.py --vault 'D:\Notes\MyVault'
```

| 中文 | English |
| --- | --- |
| 不需要管理员权限；安装到目标库 `.obsidian/plugins/chatgpt-learning-widgets`，并登记当前用户的 Chrome Native Messaging 项。 | No administrator privileges are required. The installer copies files into `.obsidian/plugins/chatgpt-learning-widgets` in the selected vault and registers Chrome Native Messaging for the current user. |
| 替换前备份插件代码和主机配置；保留 `data.json` 和第三方插件启用列表。 | Existing plugin code and host configuration are backed up before replacement. `data.json` and the community-plugin enable list are preserved. |
| 省略 `--vault` 时，优先选择唯一有效的当前打开库，再尝试仍有效的安装配置；多个库同时打开时须明确指定路径。 | Without `--vault`, the installer first selects the single valid currently open vault, then falls back to valid saved configuration. Specify a path explicitly when multiple vaults are open. |

| 中文 | English |
| --- | --- |
| **3.** 打开 Chrome 的 `chrome://extensions/`，启用“开发者模式”，点击“加载未打包的扩展程序”，选择项目的 **`extension`** 子目录。 | **3.** Open `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select the project’s **`extension`** subdirectory. |
| **4.** 在 Obsidian“设置 → 第三方插件”中启用 **ChatGPT Learning Widgets**。 | **4.** Enable **ChatGPT Learning Widgets** in Obsidian’s **Settings → Community plugins**. |
| **5.** 打开具体的 ChatGPT 对话，点击归档扩展，核对“已连接 · 库名”，再点击“归档到 Obsidian”。长对话先加载早期消息，归档期间保持弹窗打开。 | **5.** Open a specific ChatGPT conversation, click the extension, verify the connected vault name, then click **归档到 Obsidian** (*Archive to Obsidian*). Load earlier messages for long chats and keep the popup open while archiving. |
| 扩展当前界面与生成的文件名使用中文。完整安装、升级、移库和故障排查见[安装指南](INSTALL.md)。扩展和插件尚未上架应用商店。 | The current extension interface and generated filenames use Chinese. See the bilingual [installation guide](INSTALL.md) for setup, updates, vault changes and troubleshooting. The extension and plugin are not listed in application stores. |

| 中文 | English |
| --- | --- |
| 扩展公钥用于固定扩展 ID，以匹配本机通信来源；它不是私钥或访问令牌。 | The extension’s public key keeps its ID stable for Native Messaging origin matching. It is not a private key or access token. |
| 需要时按 Obsidian 正常流程允许社区插件；可将 Chrome 归档扩展固定到工具栏。 | Allow community plugins through Obsidian’s normal settings flow when needed. You can pin the Chrome archive extension to the toolbar. |

## 归档 / Archiving

| 中文 | English |
| --- | --- |
| 等回答结束，加载所需的早期消息，再点击“归档到 Obsidian”，归档期间保持弹窗打开。 | Wait for the answer to finish and load the earlier messages you need. Click **归档到 Obsidian** (*Archive to Obsidian*) and keep the popup open during capture. |
| 跨域图片可能需要按提示授权对应图片网站。 | Cross-origin images may require granting access to the specific image site when prompted. |
| 结果包含库顶层的 `ChatGPT - 标题 - 指纹.md`，以及 `ChatGPT 学习归档` 中的原件、附件、快照和 `归档报告.json`。这些是程序实际使用的中文文件名。 | Output includes `ChatGPT - title - fingerprint.md` at the vault root and source data, assets, snapshots and `归档报告.json` (*archive report*) under `ChatGPT 学习归档` (*ChatGPT learning archives*). The latter Chinese names are the actual filenames used by the program. |
| 先看报告，再核对公式、代码最后一行、图片和交互状态；重装不能找回未采集的历史或失效资源。 | Read the report, then check formulas, the final code line, images and interactive state. Reinstallation cannot recover history that was never captured or expired resources. |

## 升级或移库 / Updating or changing vaults

| 中文 | English |
| --- | --- |
| 更新源码后运行 `python build_plugin.py --check`。 | After updating source files, run `python build_plugin.py --check`. |
| 重新运行 `python install.py --vault 'D:\Notes\NewVault'`，换成目标库的实际路径。 | Rerun `python install.py --vault 'D:\Notes\NewVault'`, substituting the actual target vault path. |
| 在 Chrome 扩展管理页重新加载扩展；在 Obsidian 关闭后重新开启交互插件。 | Reload the extension on Chrome’s extensions page, then disable and re-enable the Obsidian plugin. |
| 替换前文件保存在项目 `backups/`；普通升级不需要转换旧笔记，移库后要核对连接库名。 | Replaced files are saved in the project’s `backups/` folder. Routine updates do not require converting older notes. Check the connected vault name after moving a vault. |

## 卸载与回滚 / Uninstalling and rollback

| 中文 | English |
| --- | --- |
| 运行下方命令仅移除本项目当前用户的本机通信注册。 | Run the command below to remove only this project’s native host registration for the current user. |

```powershell
python install.py --uninstall
```

| 中文 | English |
| --- | --- |
| 笔记、插件文件和状态保留。要停止使用，可在 Chrome 移除扩展，并在 Obsidian 停用或卸载插件。 | Notes, plugin files and state are preserved. To stop using the tool, remove the Chrome extension and disable or uninstall the Obsidian plugin in their respective settings. |
| 回滚时先停用插件，再从 `backups/install-时间/plugin/` 恢复代码，并保留现有 `data.json`。 | Before rollback, disable the plugin, restore its code from `backups/install-timestamp/plugin/`, and keep the current `data.json`. |
| 备份主机配置只适用于原机器及原路径；不要公开上传或直接复用到别人的电脑。 | Backed-up host configuration is specific to the original computer and paths. Do not publish it or copy it directly to another person’s computer. |

## 故障排查 / Troubleshooting

| 中文 | English |
| --- | --- |
| **接收程序未就绪：**确认 Python 可运行，重新执行带 `--vault` 的安装命令，并查看报错。 | **Receiver not ready:** verify Python works, rerun installation with `--vault`, and inspect any error output. |
| **连接到旧库：**以当前真实库路径重新安装，重新打开扩展并核对库名。 | **Connected to an old vault:** reinstall with the current vault’s actual path, reopen the extension, and check the vault name. |
| **找不到验证用 Chrome：**程序查找标准安装目录；自定义 Chrome 位置目前需调整 `host/runtime_inspector.py`。 | **Chrome not found for validation:** the program checks standard installation directories. A custom Chrome location currently requires adjusting `host/runtime_inspector.py`. |
| **代码不完整被阻止：**等回答结束，加载完整代码并保留诊断，不要把可见行当作完整程序。 | **Incomplete code blocked:** wait for the answer to finish, load the complete code and keep the diagnostic. Visible lines are not proof of the full program. |
| **图片未保存：**检查网站权限与报告原因；过期或不可访问的图片需要原件。 | **Image missing:** check site permissions and the report’s reason. Expired or inaccessible images require an original copy. |
| **交互块显示为代码：**启用并重载 Obsidian 插件，确认归档附件仍在原位置。 | **Widget appears as code:** enable and reload the Obsidian plugin and verify that the source archive remains at the referenced path. |
| **文件已保存但效果不同：**检查报告中的未支持组件及资源；文件校验不代表外观一致。 | **Saved files look different:** inspect unsupported components and missing resources in the report. File verification does not establish visual equivalence. |
| 提交问题请附版本、操作系统和脱敏报错，不要公开真实对话、带令牌的资源地址或完整运行配置。 | When reporting an issue, include versions, operating system and a redacted error. Do not publish private conversations, token-bearing resource URLs or complete runtime configuration. |
