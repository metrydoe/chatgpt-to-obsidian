# ChatGPT �� Obsidian

[��װָ�� / Installation](docs/INSTALL.md) �� [�ܹ� / Architecture](docs/ARCHITECTURE.md) �� [English only](README.en.md) �� [Contributing](CONTRIBUTING.md)

## ��Ŀ��� / Overview

| ���� | English |
| --- | --- |
| �� Chrome �е�ǰ ChatGPT �Ի�����Ϊ�ɱ༭�� Obsidian ѧϰ�ʼǣ�������ȡ�õĹ�ʽ���������롢����ͼƬ��֧�ֵĽ�������� | Save the currently loaded ChatGPT conversation from Chrome as editable Obsidian notes, including available TeX, complete code, local images and supported interactive components. |
| ʵ����������Ŀ��������װ��·֧�� Windows 10/11��Google Chrome �� Obsidian ����档 | Experimental community project. The complete installation pipeline supports Windows 10/11, Google Chrome and Obsidian Desktop. |
| Chrome ��չ **0.8.2**��Obsidian ��� **0.5.1**����Ҫ Python **3.10+**�� | Chrome extension **0.8.2**; Obsidian plugin **0.5.1**; requires Python **3.10+**. |
| ��װʹ��ֻ�� Python ��׼�⣬����Ҫģ�� API Key������ Python ���� Node.js�� | Normal use requires only the Python standard library. No model API key, additional Python packages or Node.js is needed. |

## ���� / Features

| ���� | English |
| --- | --- |
| ����������ش�Ϊԭ�� Markdown���������⡢�б�������TeX �ʹ���Χ���� | Export questions and answers as native Markdown, retaining headings, lists, tables, TeX and fenced code blocks. |
| ���ܹ�ȡ�õ�ͼƬ��SVG ���������ص����أ����˶Ը��� SHA-256�� | Download accessible images, SVGs and dependencies locally and verify attachment SHA-256 hashes. |
| ��ȡ�뵱ǰҳ������� CodeMirror��Monaco��Ace �༭�������ĵ����޷�ȷ�ϴ�������ʱֹͣ�鵵�� | Read complete documents from CodeMirror, Monaco and Ace editors associated with the current page; stop archiving when code completeness cannot be established. |
| ��֧�ֵ�ԭ��������� `chatgpt-widget` ���ڶ�Ӧ���䣬ͬһ����Ķ����ͼ����״̬�� | Place supported source-program components inline as `chatgpt-widget` blocks, with shared state between views of the same program. |
| ����ԭ�����鵵���������ָ�ƿ��գ��������бʼ��е��û��޸ġ� | Keep source archives, reports and content-addressed snapshots, preserving user edits in existing readable notes. |
| �ṩ����ƪ�������ʼǵ�ת������Ĭ��Ԥ������ʽ `--apply` �Ÿ�д�����ݡ� | Provide a converter for older whole-note player exports; preview by default and require explicit `--apply` to modify and back up notes. |

## ���ٿ�ʼ / Quick start

| ���� | English |
| --- | --- |
| **1.** ����������Ŀ����ѹ���̶�Ŀ¼������ `D:\Tools\chatgpt-to-obsidian`����װ����ԭĿ¼�� | **1.** Download the entire project into a permanent directory, such as `D:\Tools\chatgpt-to-obsidian`. Keep that directory after installation. |
| **2.** �� Obsidian �д�Ŀ��⣬�ٴ���ĿĿ¼�����·������ʾ��·���滻����Ŀ�·���� | **2.** Open your target vault in Obsidian, then run the command below from the project directory, replacing the example path with your vault path. |

```powershell
python install.py --vault 'D:\Notes\MyVault'
```

| ���� | English |
| --- | --- |
| **3.** �� Chrome �� `chrome://extensions/`�����á�������ģʽ�������������δ�������չ���򡱣�ѡ����Ŀ�� **`extension`** ��Ŀ¼�� | **3.** Open `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select the project��s **`extension`** subdirectory. |
| **4.** �� Obsidian������ �� ����������������� **ChatGPT Learning Widgets**�� | **4.** Enable **ChatGPT Learning Widgets** in Obsidian��s **Settings �� Community plugins**. |
| **5.** �򿪾���� ChatGPT �Ի�������鵵��չ���˶ԡ������� �� ���������ٵ�����鵵�� Obsidian�������Ի��ȼ���������Ϣ���鵵�ڼ䱣�ֵ����򿪡� | **5.** Open a specific ChatGPT conversation, click the extension, verify the connected vault name, then click **�鵵�� Obsidian** (*Archive to Obsidian*). Load earlier messages for long chats and keep the popup open while archiving. |
| ��չ��ǰ���������ɵ��ļ���ʹ�����ġ�������װ���������ƿ�͹����Ų��[��װָ��](docs/INSTALL.md)����չ�Ͳ����δ�ϼ�Ӧ���̵ꡣ | The current extension interface and generated filenames use Chinese. See the bilingual [installation guide](docs/INSTALL.md) for setup, updates, vault changes and troubleshooting. The extension and plugin are not listed in application stores. |

## ���ݺ�Ȩ�� / Data and permissions

| ���� | English |
| --- | --- |
| ���ġ�ԭ���͸���������ָ���ı��رʼǿ⣻��Ŀû��ң�⡢�ϴ���������ģ�� API ���á� | Notes, source archives and attachments are stored in your selected local vault. The project has no telemetry, upload server or model API calls. |
| �ɼ�����ʵ�ǰ ChatGPT ҳ�漰��ͼ��������վ����̨���ز�Я��վ��ƾ�ݣ�ҳ����ͬԴ���ؿ���ʹ��ҳ��Ự�� | Capture accesses the active ChatGPT page and image or dependency sites. Background downloads omit credentials; same-origin page downloads may use the page session. |
| ����Ȩ���� `activeTab`��`scripting`��`nativeMessaging`������ͼƬ��վȨ�ް������롣 | Core permissions are `activeTab`, `scripting` and `nativeMessaging`. Access to additional image sites is requested when needed. |
| ֧�ֵ�ԭ�����ͨ��������Ϣ��������ܽ���������״̬��ԭ����ֱ�ӽ��� Obsidian ������ִ�С� | Supported native components exchange actions and state with isolated frames through a restricted message bridge. Source programs do not execute directly in the main Obsidian window. |
| ��Ҫ�����ϴ� `host/config.json`��`host/recovery/`��`recovery/`��`backups/`��`data.json` ����˹鵵��`.gitignore` ���ų���Щ�����ļ��� | Do not publish `host/config.json`, `host/recovery/`, `recovery/`, `backups/`, `data.json` or personal archives. These runtime files are excluded by `.gitignore`. |

## ��֪���� / Known limitations

| ���� | English |
| --- | --- |
| �ɼ���Χ�ǵ�ǰ��֧���Ѽ������ݣ��������˻�ȫ����ʷ��ChatGPT ҳ��仯Ҳ���ܵ��²ɼ�ʧ�ܡ� | Capture covers loaded content in the current branch, not all account history. Changes to ChatGPT��s page structure may break capture. |
| ����֤������ҳ��ۻ����� JavaScript��iframe��canvas ��������Ǩ�ơ� | Identical appearance and complete migration of arbitrary JavaScript, iframes or canvas behavior are not guaranteed. |
| ���� DIL ��������ʱֻ���ǲ������������ ChatGPT ԭ���л�����δ֧�������ʧЧͼƬ���ⲿ�����ģ���������¼�ڱ����С� | The local DIL compatibility runtime supports a subset of components and is not the original ChatGPT runtime. Reports record unsupported components, expired images, external services and unresolved module dependencies. |
| �޷�֤�������Ĺ���������ܱ��ܾ���ȱʧԴ����Ҫ����ԭ�Ի�ȡ�á� | Scrollable code may be rejected when completeness cannot be proven. Missing source must be retrieved from the original conversation. |
| Native Messaging �������� 40 MB����������鵵 JSON ���� 8 MB�������������� 24 MB���ɼ�������������Դ���ơ� | Native Messaging requests are limited to 40 MB, individual attachments or archive JSON to 8 MB, and total attachments to 24 MB. The collector also applies dependency-resource limits. |
| �ļ�У��ֻ֤�������ļ����¼һ�£�ʵ����ۺͽ��������� Obsidian �к˶ԡ� | File verification establishes consistency with saved records. Visual appearance and interactive behavior still need to be checked in Obsidian. |

## ��������֤ / Development and validation

| ���� | English |
| --- | --- |
| ������������Ҫ Node.js **20+**���Ӳֿ��Ŀ¼�����·���� | Development checks additionally require Node.js **20+**. Run the commands below from the repository root. |

```powershell
python build_plugin.py
python tools/check.py
python -m unittest discover -s tests -v
```

| ���� | English |
| --- | --- |
| �޸� `plugin-src/main.js` �͹�������ʱ�����й����ű����� `obsidian-plugin/main.js`�����ֻ���� Obsidian �ṩ�� API ������ | After editing `plugin-src/main.js` or shared runtimes, rebuild `obsidian-plugin/main.js`. The bundle retains only the API dependency provided by Obsidian. |
| ���������ʹ�úϳ����ݺͶ�����ʱ Chrome ���ã�����ȡ���������¼����ʵ�Ի��� | Browser tests use synthetic content and fresh temporary Chrome profiles, without reading personal browsing history or real conversations. |
| [Windows CI ʾ��](docs/github-actions.example.yml) ���ֶ����Ƶ� `.github/workflows/ci.yml` ���ύ�����ã���ǰδ�Զ����á� | To enable the optional [Windows CI example](docs/github-actions.example.yml), copy it to `.github/workflows/ci.yml` and commit it. It is not enabled automatically. |

## ����֤ / License

| ���� | English |
| --- | --- |
| Դ����� [MIT License](LICENSE)������ KaTeX �����屣��ԭʼ����֤����[����������](THIRD_PARTY_NOTICES.md)�� | Source code is licensed under the [MIT License](LICENSE). Bundled KaTeX and fonts retain their original license; see [third-party notices](THIRD_PARTY_NOTICES.md). |
| ����������Ŀ���� OpenAI��Google��Obsidian �ٷ���������ϵ��ʾ����Ϊ�˹��ϳɡ� | Independent community project, not affiliated with OpenAI, Google or Obsidian. All included examples are synthetic. |
