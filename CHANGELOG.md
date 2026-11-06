# Changelog

## Initial public source release — extension 0.8.2 / plugin 0.5.1

- Publish the Chrome collector, local Python receiver, Obsidian plugin source
  and generated bundle, shared runtimes and licensed offline KaTeX assets.
- Add installation, maintenance, architecture and contribution documentation.
- Exclude machine paths, generated launchers, conversation captures, recovery
  caches, plugin state, diagnostics and backups from the source distribution.
- Prefer the currently open valid vault during installation, preventing an old
  installation config from silently selecting a moved vault.
- Add synthetic regression tests and an optional Windows CI example.

Earlier local builds are not represented as independently verified public
releases. The extension and Obsidian plugin retain their existing version numbers.
