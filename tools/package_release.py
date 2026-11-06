"""Package only committed files from a clean checkout; exclude all local data."""
import argparse
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'dist/chatgpt-to-obsidian-0.8.2.zip')
    args = parser.parse_args()
    dirty = subprocess.check_output(['git','status','--porcelain','--untracked-files=no'], cwd=ROOT)
    if dirty.strip():
        raise SystemExit('Commit source changes before building a release')
    names = subprocess.check_output(['git','ls-files','-z'], cwd=ROOT).decode('utf-8').split('\0')
    names = [name for name in names if name]
    if not names:
        raise SystemExit('No tracked source files')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(names):
            raw = subprocess.check_output(['git','show','HEAD:'+name], cwd=ROOT)
            archive.writestr('chatgpt-to-obsidian/'+name, raw)
    print(f'Packaged {len(names)} committed source files: {args.output.resolve()}')


if __name__ == '__main__':
    main()
