# Contributing

Bug reports, documentation fixes and narrowly scoped patches are welcome.
Use synthetic conversations and fixtures. Never include a personal conversation,
vault, browser profile, token-bearing image URL, native host config or recovery cache.

## Local checks

Install Python 3.10+, Node.js 20+ and Google Chrome. Python dependencies are
standard-library only. From the repository root, run:

```powershell
python build_plugin.py
python tools/check.py
python -m unittest discover -s tests -v
```

Browser tests create a separate temporary headless Chrome profile. They do not
automate your logged-in ChatGPT session. A skipped browser test is not a passed
browser test; explain missing browser verification in a pull request.

Change `plugin-src/main.js`, not just the generated `obsidian-plugin/main.js`.
Rebuild after changing shared runtimes. Preserve bundled dependency licenses.
Do not change source program constants to make a fixture pass or infer missing
source code from prose.

Describe the trigger, observable behavior and relevant validation in a pull
request. State when validation is synthetic and when it used the actual browser
or Obsidian. Avoid claiming all messages, resources or interactions are preserved
when that has not been verified.

Contributions are provided under the repository's MIT license.
