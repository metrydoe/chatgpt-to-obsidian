"""Dependency-free source, bundle and JavaScript syntax checks (Node.js required)."""
import ast
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def main():
    subprocess.run([sys.executable, str(ROOT/'build_plugin.py'), '--check'], check=True)
    folders = ['extension', 'host', 'plugin-src', 'shared', 'obsidian-plugin', 'tools', 'tests']
    paths = list(ROOT.glob('*.py'))
    for folder in folders:
        paths.extend((ROOT/folder).rglob('*'))
    python_count = javascript_count = 0
    node = shutil.which('node')
    if not node:
        raise SystemExit('Node.js 20+ is required for development checks')
    for path in sorted(set(paths)):
        if not path.is_file() or '__pycache__' in path.parts:
            continue
        if path.suffix == '.py':
            ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
            python_count += 1
        if path.suffix == '.js':
            subprocess.run([node, '--check', str(path)], check=True)
            javascript_count += 1
    manifest = json.loads((ROOT/'extension/manifest.json').read_text(encoding='utf-8'))
    for name in [manifest['action']['default_popup'], manifest['background']['service_worker']]:
        assert (ROOT/'extension'/name).is_file(), name
    print(json.dumps({'python_files':python_count,'javascript_files':javascript_count,'bundle':'current'}))


if __name__ == '__main__':
    main()
