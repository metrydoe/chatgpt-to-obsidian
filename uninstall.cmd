@echo off
cd /d "%~dp0"
python install.py --uninstall
if errorlevel 1 pause
