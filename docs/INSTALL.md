# ��װ��ά�� / Installation and maintenance

[README](../README.md) �� [�ܹ� / Architecture](ARCHITECTURE.md)

## ���� / Requirements

| ���� | English |
| --- | --- |
| Windows 10/11��Google Chrome��Obsidian ����棻���������� Obsidian 1.5.0�� | Windows 10/11, Google Chrome and Obsidian Desktop. The plugin manifest requires Obsidian 1.5.0 or newer. |
| Python 3.10+��ȷ�� `python --version` �����С� | Python 3.10+; verify that `python --version` works. |
| ���齫��Ŀ���ڼ�·�������� `D:\Tools\chatgpt-to-obsidian`��������ʹ�� Windows ϵͳ����ҳ���޷������·���ַ���Ҫ���ü�·���� | Use a simple project path such as `D:\Tools\chatgpt-to-obsidian`. The launcher uses the Windows system code page; choose another path if its characters cannot be represented. |
| Ŀ������� Obsidian �򿪹������� `.obsidian`������������·�ݲ�֧�� macOS��Linux��Edge ���ƶ��ˡ� | Open the target vault in Obsidian at least once so it contains `.obsidian`. The full receiving pipeline does not currently support macOS, Linux, Edge or mobile. |
| `--plugin-only` ֻ���Ʋ���ļ�������Ϊ����ƽ̨�ṩ�����ɼ���·�� | `--plugin-only` copies plugin files only; it does not provide a complete capture pipeline for other platforms. |

## ��װ / Installation

| ���� | English |
| --- | --- |
| **1.** ����������Ŀ����ѹ���̶�Ŀ¼������ `D:\Tools\chatgpt-to-obsidian`����װ����ԭĿ¼�� | **1.** Download the entire project into a permanent directory, such as `D:\Tools\chatgpt-to-obsidian`. Keep that directory after installation. |
| **2.** �� Obsidian �д�Ŀ��⣬�ٴ���ĿĿ¼�����·������ʾ��·���滻����Ŀ�·���� | **2.** Open your target vault in Obsidian, then run the command below from the project directory, replacing the example path with your vault path. |

```powershell
python install.py --vault 'D:\Notes\MyVault'
```

| ���� | English |
| --- | --- |
| ����Ҫ����ԱȨ�ޣ���װ��Ŀ��� `.obsidian/plugins/chatgpt-learning-widgets`�����Ǽǵ�ǰ�û��� Chrome Native Messaging � | No administrator privileges are required. The installer copies files into `.obsidian/plugins/chatgpt-learning-widgets` in the selected vault and registers Chrome Native Messaging for the current user. |
| �滻ǰ���ݲ��������������ã����� `data.json` �͵�������������б��� | Existing plugin code and host configuration are backed up before replacement. `data.json` and the community-plugin enable list are preserved. |
| ʡ�� `--vault` ʱ������ѡ��Ψһ��Ч�ĵ�ǰ�򿪿⣬�ٳ�������Ч�İ�װ���ã������ͬʱ��ʱ����ȷָ��·���� | Without `--vault`, the installer first selects the single valid currently open vault, then falls back to valid saved configuration. Specify a path explicitly when multiple vaults are open. |

| ���� | English |
| --- | --- |
| **3.** �� Chrome �� `chrome://extensions/`�����á�������ģʽ�������������δ�������չ���򡱣�ѡ����Ŀ�� **`extension`** ��Ŀ¼�� | **3.** Open `chrome://extensions/`, enable **Developer mode**, choose **Load unpacked**, and select the project��s **`extension`** subdirectory. |
| **4.** �� Obsidian������ �� ����������������� **ChatGPT Learning Widgets**�� | **4.** Enable **ChatGPT Learning Widgets** in Obsidian��s **Settings �� Community plugins**. |
| **5.** �򿪾���� ChatGPT �Ի�������鵵��չ���˶ԡ������� �� ���������ٵ�����鵵�� Obsidian�������Ի��ȼ���������Ϣ���鵵�ڼ䱣�ֵ����򿪡� | **5.** Open a specific ChatGPT conversation, click the extension, verify the connected vault name, then click **�鵵�� Obsidian** (*Archive to Obsidian*). Load earlier messages for long chats and keep the popup open while archiving. |
| ��չ��ǰ���������ɵ��ļ���ʹ�����ġ�������װ���������ƿ�͹����Ų��[��װָ��](INSTALL.md)����չ�Ͳ����δ�ϼ�Ӧ���̵ꡣ | The current extension interface and generated filenames use Chinese. See the bilingual [installation guide](INSTALL.md) for setup, updates, vault changes and troubleshooting. The extension and plugin are not listed in application stores. |

| ���� | English |
| --- | --- |
| ��չ��Կ���ڹ̶���չ ID����ƥ�䱾��ͨ����Դ��������˽Կ��������ơ� | The extension��s public key keeps its ID stable for Native Messaging origin matching. It is not a private key or access token. |
| ��Ҫʱ�� Obsidian ����������������������ɽ� Chrome �鵵��չ�̶����������� | Allow community plugins through Obsidian��s normal settings flow when needed. You can pin the Chrome archive extension to the toolbar. |

## �鵵 / Archiving

| ���� | English |
| --- | --- |
| �Ȼش���������������������Ϣ���ٵ�����鵵�� Obsidian�����鵵�ڼ䱣�ֵ����򿪡� | Wait for the answer to finish and load the earlier messages you need. Click **�鵵�� Obsidian** (*Archive to Obsidian*) and keep the popup open during capture. |
| ����ͼƬ������Ҫ����ʾ��Ȩ��ӦͼƬ��վ�� | Cross-origin images may require granting access to the specific image site when prompted. |
| ��������ⶥ��� `ChatGPT - ���� - ָ��.md`���Լ� `ChatGPT ѧϰ�鵵` �е�ԭ�������������պ� `�鵵����.json`����Щ�ǳ���ʵ��ʹ�õ������ļ����� | Output includes `ChatGPT - title - fingerprint.md` at the vault root and source data, assets, snapshots and `�鵵����.json` (*archive report*) under `ChatGPT ѧϰ�鵵` (*ChatGPT learning archives*). The latter Chinese names are the actual filenames used by the program. |
| �ȿ����棬�ٺ˶Թ�ʽ���������һ�С�ͼƬ�ͽ���״̬����װ�����һ�δ�ɼ�����ʷ��ʧЧ��Դ�� | Read the report, then check formulas, the final code line, images and interactive state. Reinstallation cannot recover history that was never captured or expired resources. |

## �������ƿ� / Updating or changing vaults

| ���� | English |
| --- | --- |
| ����Դ������� `python build_plugin.py --check`�� | After updating source files, run `python build_plugin.py --check`. |
| �������� `python install.py --vault 'D:\Notes\NewVault'`������Ŀ����ʵ��·���� | Rerun `python install.py --vault 'D:\Notes\NewVault'`, substituting the actual target vault path. |
| �� Chrome ��չ����ҳ���¼�����չ���� Obsidian �رպ����¿������������ | Reload the extension on Chrome��s extensions page, then disable and re-enable the Obsidian plugin. |
| �滻ǰ�ļ���������Ŀ `backups/`����ͨ��������Ҫת���ɱʼǣ��ƿ��Ҫ�˶����ӿ����� | Replaced files are saved in the project��s `backups/` folder. Routine updates do not require converting older notes. Check the connected vault name after moving a vault. |

## ж����ع� / Uninstalling and rollback

| ���� | English |
| --- | --- |
| �����·�������Ƴ�����Ŀ��ǰ�û��ı���ͨ��ע�ᡣ | Run the command below to remove only this project��s native host registration for the current user. |

```powershell
python install.py --uninstall
```

| ���� | English |
| --- | --- |
| �ʼǡ�����ļ���״̬������Ҫֹͣʹ�ã����� Chrome �Ƴ���չ������ Obsidian ͣ�û�ж�ز���� | Notes, plugin files and state are preserved. To stop using the tool, remove the Chrome extension and disable or uninstall the Obsidian plugin in their respective settings. |
| �ع�ʱ��ͣ�ò�����ٴ� `backups/install-ʱ��/plugin/` �ָ����룬���������� `data.json`�� | Before rollback, disable the plugin, restore its code from `backups/install-timestamp/plugin/`, and keep the current `data.json`. |
| ������������ֻ������ԭ������ԭ·������Ҫ�����ϴ���ֱ�Ӹ��õ����˵ĵ��ԡ� | Backed-up host configuration is specific to the original computer and paths. Do not publish it or copy it directly to another person��s computer. |

## �����Ų� / Troubleshooting

| ���� | English |
| --- | --- |
| **���ճ���δ������**ȷ�� Python �����У�����ִ�д� `--vault` �İ�װ������鿴������ | **Receiver not ready:** verify Python works, rerun installation with `--vault`, and inspect any error output. |
| **���ӵ��ɿ⣺**�Ե�ǰ��ʵ��·�����°�װ�����´���չ���˶Կ����� | **Connected to an old vault:** reinstall with the current vault��s actual path, reopen the extension, and check the vault name. |
| **�Ҳ�����֤�� Chrome��**������ұ�׼��װĿ¼���Զ��� Chrome λ��Ŀǰ����� `host/runtime_inspector.py`�� | **Chrome not found for validation:** the program checks standard installation directories. A custom Chrome location currently requires adjusting `host/runtime_inspector.py`. |
| **���벻��������ֹ��**�Ȼش�����������������벢������ϣ���Ҫ�ѿɼ��е����������� | **Incomplete code blocked:** wait for the answer to finish, load the complete code and keep the diagnostic. Visible lines are not proof of the full program. |
| **ͼƬδ���棺**�����վȨ���뱨��ԭ�򣻹��ڻ򲻿ɷ��ʵ�ͼƬ��Ҫԭ���� | **Image missing:** check site permissions and the report��s reason. Expired or inaccessible images require an original copy. |
| **��������ʾΪ���룺**���ò����� Obsidian �����ȷ�Ϲ鵵��������ԭλ�á� | **Widget appears as code:** enable and reload the Obsidian plugin and verify that the source archive remains at the referenced path. |
| **�ļ��ѱ��浫Ч����ͬ��**��鱨���е�δ֧���������Դ���ļ�У�鲻�������һ�¡� | **Saved files look different:** inspect unsupported components and missing resources in the report. File verification does not establish visual equivalence. |
| �ύ�����븽�汾������ϵͳ��������������Ҫ������ʵ�Ի��������Ƶ���Դ��ַ�������������á� | When reporting an issue, include versions, operating system and a redacted error. Do not publish private conversations, token-bearing resource URLs or complete runtime configuration. |
