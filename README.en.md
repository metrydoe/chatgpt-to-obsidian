# ChatGPT → Obsidian

Save the currently loaded ChatGPT conversation from Chrome as editable Obsidian
Markdown, with TeX, code, local images and supported interactive components.

[中文](README.md) · [Installation](docs/INSTALL.md) · [Architecture](docs/ARCHITECTURE.md)

Experimental community project. The full installation currently targets
**Windows, Google Chrome and Obsidian Desktop**. Extension **0.8.2**;
Obsidian plugin **0.5.1**. Python **3.10+** is required. No model API key,
Python packages or Node.js are needed for normal use.

## Install

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

## Scope

The collector attempts to retrieve full documents from attached editors, rejects
code whose completeness cannot be established, and checks saved file hashes.
Supported source programs run locally with shared state between inline widgets.
The DIL runtime is a local compatibility implementation, not the ChatGPT runtime.

This does not guarantee all account history, identical appearance or arbitrary
JavaScript/iframe/canvas behavior. Unsupported components and unavailable assets
are recorded as losses. File verification is separate from visual verification.
The extension and plugin are distributed as source, not through application stores.

## Development

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
