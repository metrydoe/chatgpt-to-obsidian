# ChatGPT �� Obsidian

[��Ӣ���� / Bilingual README](README.md) �� [Installation](docs/INSTALL.md) �� [Architecture](docs/ARCHITECTURE.md) �� [Contributing](CONTRIBUTING.md)

## Overview

Save the currently loaded ChatGPT conversation from Chrome as editable Obsidian notes, including available TeX, complete code, local images and supported interactive components.

Experimental community project. The complete installation pipeline supports Windows 10/11, Google Chrome and Obsidian Desktop.

Chrome extension **0.8.2**; Obsidian plugin **0.5.1**; requires Python **3.10+**.

Normal use requires only the Python standard library. No model API key, additional Python packages or Node.js is needed.

## Features

Export questions and answers as native Markdown, retaining headings, lists, tables, TeX and fenced code blocks.

Download accessible images, SVGs and dependencies locally and verify attachment SHA-256 hashes.

Read complete documents from CodeMirror, Monaco and Ace editors associated with the current page; stop archiving when code completeness cannot be established.

Place supported source-program components inline as `chatgpt-widget` blocks, with shared state between views of the same program.

Keep source archives, reports and content-addressed snapshots, preserving user edits in existing readable notes.

Provide a converter for older whole-note player exports; preview by default and require explicit `--apply` to modify and back up notes.

## Quick start

**1.** Download the entire project into a permanent directory, such as `D:\Tools\chatgpt-to-obsidian`. Keep that directory after installation.

**2.** Open your target vault in Obsidian, then run the command below from the project directory, replacing the example path with your vault path.

```powershell
python install.py --vault 'D:\Notes\MyVault'
```

**3.** Open `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select the project��s **`extension`** subdirectory.

**4.** Enable **ChatGPT Learning Widgets** in Obsidian��s **Settings �� Community plugins**.

**5.** Open a specific ChatGPT conversation, click the extension, verify the connected vault name, then click **�鵵�� Obsidian** (*Archive to Obsidian*). Load earlier messages for long chats and keep the popup open while archiving.

The current extension interface and generated filenames use Chinese. See the bilingual [installation guide](docs/INSTALL.md) for setup, updates, vault changes and troubleshooting. The extension and plugin are not listed in application stores.

## Data and permissions

Notes, source archives and attachments are stored in your selected local vault. The project has no telemetry, upload server or model API calls.

Capture accesses the active ChatGPT page and image or dependency sites. Background downloads omit credentials; same-origin page downloads may use the page session.

Core permissions are `activeTab`, `scripting` and `nativeMessaging`. Access to additional image sites is requested when needed.

Supported native components exchange actions and state with isolated frames through a restricted message bridge. Source programs do not execute directly in the main Obsidian window.

Do not publish `host/config.json`, `host/recovery/`, `recovery/`, `backups/`, `data.json` or personal archives. These runtime files are excluded by `.gitignore`.

## Known limitations

Capture covers loaded content in the current branch, not all account history. Changes to ChatGPT��s page structure may break capture.

Identical appearance and complete migration of arbitrary JavaScript, iframes or canvas behavior are not guaranteed.

The local DIL compatibility runtime supports a subset of components and is not the original ChatGPT runtime. Reports record unsupported components, expired images, external services and unresolved module dependencies.

Scrollable code may be rejected when completeness cannot be proven. Missing source must be retrieved from the original conversation.

Native Messaging requests are limited to 40 MB, individual attachments or archive JSON to 8 MB, and total attachments to 24 MB. The collector also applies dependency-resource limits.

File verification establishes consistency with saved records. Visual appearance and interactive behavior still need to be checked in Obsidian.

## Development and validation

Development checks additionally require Node.js **20+**. Run the commands below from the repository root.

```powershell
python build_plugin.py
python tools/check.py
python -m unittest discover -s tests -v
```

After editing `plugin-src/main.js` or shared runtimes, rebuild `obsidian-plugin/main.js`. The bundle retains only the API dependency provided by Obsidian.

Browser tests use synthetic content and fresh temporary Chrome profiles, without reading personal browsing history or real conversations.

To enable the optional [Windows CI example](docs/github-actions.example.yml), copy it to `.github/workflows/ci.yml` and commit it. It is not enabled automatically.

## License

Source code is licensed under the [MIT License](LICENSE). Bundled KaTeX and fonts retain their original license; see [third-party notices](THIRD_PARTY_NOTICES.md).

Independent community project, not affiliated with OpenAI, Google or Obsidian. All included examples are synthetic.
