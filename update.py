"""Install the Chrome native host and Obsidian plugin for the current user.

No administrator privileges are required. Plugin state and notes are preserved.
Close/reload the relevant plugin after updating its files.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parent
NATIVE_KEY = r'Software\Google\Chrome\NativeMessagingHosts\com.local.chatgpt_obsidian'


def valid_vault(path):
    return (Path(path) / '.obsidian').is_dir()


def select_vault(explicit=None, root=ROOT, appdata=None):
    """Prefer the currently open vault over a possibly stale installation."""
    if explicit is not None:
        selected = Path(explicit).resolve()
        if not valid_vault(selected):
            raise ValueError('Invalid vault: open it once in Obsidian to create .obsidian')
        return selected
    appdata = appdata if appdata is not None else os.environ.get('APPDATA')
    state_path = Path(appdata)/'obsidian/obsidian.json' if appdata else None
    if state_path and state_path.is_file():
        state = json.loads(state_path.read_text(encoding='utf-8-sig'))
        opened = [Path(v['path']).resolve() for v in state.get('vaults', {}).values()
                  if v.get('open') and isinstance(v.get('path'), str) and valid_vault(v['path'])]
        if len(opened) > 1:
            raise ValueError('Multiple open vaults; pass --vault PATH explicitly')
        if len(opened) == 1:
            return opened[0]
    config = root/'host/config.json'
    if config.is_file():
        saved = json.loads(config.read_text(encoding='utf-8-sig'))
        if isinstance(saved.get('vault'), str) and valid_vault(saved['vault']):
            return Path(saved['vault']).resolve()
    raise ValueError('No usable vault found; pass --vault PATH explicitly')


def native_registration():
    if os.name != 'nt':
        raise ValueError('Native Messaging installation currently supports Windows only')
    import winreg
    return winreg


def uninstall():
    registry = native_registration()
    try:
        registry.DeleteKey(registry.HKEY_CURRENT_USER, NATIVE_KEY)
    except FileNotFoundError:
        pass
    print('Native host registration removed. Notes, plugin state and source files preserved.')
    print('Remove the Chrome extension and disable the Obsidian plugin in their settings if desired.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vault', type=Path, help='Target Obsidian vault directory')
    parser.add_argument('--plugin-only', action='store_true', help='Copy only the Obsidian plugin files')
    parser.add_argument('--uninstall', action='store_true', help='Remove only the Windows native host registration')
    args = parser.parse_args(argv)
    if args.uninstall:
        if args.vault or args.plugin_only:
            parser.error('--uninstall cannot be combined with installation options')
        uninstall()
        return
    registry = None if args.plugin_only else native_registration()
    source = ROOT/'obsidian-plugin'
    subprocess.run([sys.executable, str(ROOT/'build_plugin.py'), '--check'], check=True)
    manifest = json.loads((source/'manifest.json').read_text(encoding='utf-8'))
    entry = (source/'main.js').read_text(encoding='utf-8')
    if re.findall(r"\brequire\(\s*['\"]([^'\"]+)['\"]\s*\)", entry) != ['obsidian']:
        raise ValueError('Plugin must be self-contained; run python build_plugin.py')
    vault = select_vault(args.vault)
    target = (vault/'.obsidian/plugins'/manifest['id']).resolve()
    if not target.is_relative_to(vault):
        raise ValueError('Plugin target resolves outside the selected vault')
    # Check every destination before copying; an existing symlink must not
    # redirect a packaged file outside the target plugin folder.
    items = [(p, p.relative_to(source)) for p in source.rglob('*')
             if p.is_file() and p.name != 'data.json']
    for _, relative in items:
        if not (target/relative).resolve().is_relative_to(target):
            raise ValueError('Plugin file resolves outside the plugin folder')
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6]
    backup = ROOT/'backups'/('install-'+stamp)
    backup.mkdir(parents=True, exist_ok=False)
    host = ROOT/'host'
    for name in ['config.json', 'native-host.json', 'launch.cmd']:
        previous = host/name
        if previous.is_file():
            shutil.copy2(previous, backup/name)
    if registry:
        try:
            with registry.OpenKey(registry.HKEY_CURRENT_USER, NATIVE_KEY) as key:
                previous = registry.QueryValueEx(key, '')[0]
        except FileNotFoundError:
            previous = None
        (backup/'registry-before.json').write_text(json.dumps({'key':NATIVE_KEY,'value':previous}, indent=2), encoding='utf-8')
    replaced = []
    for item, relative in items:
        destination = target/relative
        if destination.is_file():
            old = backup/'plugin'/relative
            old.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(destination, old)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, destination)
        replaced.append(relative.as_posix())
    if registry:
        meta = json.loads((ROOT/'extension-id.json').read_text(encoding='utf-8'))
        launcher = host/'launch.cmd'
        # Use the system code page used by cmd.exe; fail rather than writing
        # an unusable launcher on a machine that cannot represent these paths.
        command = '@echo off\r\n"'+sys.executable+'" -u "'+str(host/'host.py')+'" %*\r\n'
        with launcher.open('w', encoding='mbcs', newline='') as stream:
            stream.write(command)
        (host/'config.json').write_text(json.dumps({'vault':str(vault),'extension_id':meta['id']},ensure_ascii=False,indent=2),encoding='utf-8')
        native = host/'native-host.json'
        native.write_text(json.dumps({'name':'com.local.chatgpt_obsidian','description':'Local ChatGPT archives for Obsidian','path':str(launcher),'type':'stdio','allowed_origins':['chrome-extension://'+meta['id']+'/']},ensure_ascii=False,indent=2),encoding='utf-8')
        with registry.CreateKey(registry.HKEY_CURRENT_USER, NATIVE_KEY) as key:
            registry.SetValueEx(key, '', 0, registry.REG_SZ, str(native))
    result = {'installed':True,'plugin_version':manifest['version'],
              'extension_version':json.loads((ROOT/'extension/manifest.json').read_text(encoding='utf-8'))['version'],
              'vault':str(vault),'plugin':str(target),'backup':str(backup),'files':replaced,
              'reload_required':['Chrome extension','Obsidian plugin'],
              'enable_plugin_in_obsidian_settings':True}
    (ROOT/'installation-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True,indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(str(error))
