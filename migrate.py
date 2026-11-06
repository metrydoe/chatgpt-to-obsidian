"""Compatibility entry point for the native-note converter (dry-run by default)."""
import runpy
from pathlib import Path
if __name__=="__main__":
    runpy.run_path(str(Path(__file__).with_name("convert_native.py")),run_name="__main__")
