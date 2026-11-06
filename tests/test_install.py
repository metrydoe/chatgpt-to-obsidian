import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
import update


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.package = self.root/'package'
        (self.package/'host').mkdir(parents=True)
        self.appdata = self.root/'appdata'
        (self.appdata/'obsidian').mkdir(parents=True)

    def vault(self, name):
        vault = self.root/name
        (vault/'.obsidian').mkdir(parents=True)
        return vault.resolve()

    def state(self, vaults):
        (self.appdata/'obsidian/obsidian.json').write_text(json.dumps({'vaults':{str(i):{'path':str(v),'open':True} for i,v in enumerate(vaults)}}),encoding='utf-8')

    def test_current_vault_wins_over_old_config(self):
        old = self.vault('old')
        current = self.vault('current')
        (self.package/'host/config.json').write_text(json.dumps({'vault':str(old)}),encoding='utf-8')
        self.state([current])
        self.assertEqual(update.select_vault(root=self.package,appdata=self.appdata),current)

    def test_stale_vault_requires_explicit_selection(self):
        (self.package/'host/config.json').write_text(json.dumps({'vault':str(self.root/'missing')}),encoding='utf-8')
        with self.assertRaises(ValueError):
            update.select_vault(root=self.package,appdata=self.appdata)

    def test_ambiguous_open_vaults_are_rejected(self):
        self.state([self.vault('one'),self.vault('two')])
        with self.assertRaises(ValueError):
            update.select_vault(root=self.package,appdata=self.appdata)

    def test_explicit_selection_and_invalid_vault(self):
        selected = self.vault('selected')
        self.assertEqual(update.select_vault(selected,root=self.package,appdata=self.appdata),selected)
        with self.assertRaises(ValueError):
            update.select_vault(self.root/'missing',root=self.package,appdata=self.appdata)

    def prepare_package(self):
        source = self.package/'obsidian-plugin'
        source.mkdir()
        (source/'manifest.json').write_text(json.dumps({'id':'chatgpt-learning-widgets','version':'0.5.1'}),encoding='utf-8')
        (source/'main.js').write_text("require('obsidian');\n",encoding='utf-8')
        (self.package/'extension').mkdir()
        (self.package/'extension/manifest.json').write_text(json.dumps({'version':'0.8.2'}),encoding='utf-8')

    def test_install_backs_up_code_preserves_state_and_enabled_list(self):
        self.prepare_package()
        vault = self.vault('target')
        target = vault/'.obsidian/plugins/chatgpt-learning-widgets'
        target.mkdir(parents=True)
        (target/'main.js').write_text('old code',encoding='utf-8')
        (target/'data.json').write_text('{"widgets":{"demo":123}}',encoding='utf-8')
        enabled = vault/'.obsidian/community-plugins.json'
        enabled.write_text('["other-plugin"]',encoding='utf-8')
        with patch.object(update,'ROOT',self.package), patch.object(update.subprocess,'run'):
            update.main(['--vault',str(vault),'--plugin-only'])
        self.assertEqual((target/'data.json').read_text(encoding='utf-8'),'{"widgets":{"demo":123}}')
        self.assertEqual(enabled.read_text(encoding='utf-8'),'["other-plugin"]')
        backups = list((self.package/'backups').glob('*/plugin/main.js'))
        self.assertEqual(len(backups),1)
        self.assertEqual(backups[0].read_text(encoding='utf-8'),'old code')

    def test_installer_rejects_symlink_escape(self):
        self.prepare_package()
        vault = self.vault('target')
        target = vault/'.obsidian/plugins/chatgpt-learning-widgets'
        target.mkdir(parents=True)
        outside = self.root/'outside.js'
        outside.write_text('untouched',encoding='utf-8')
        try:
            (target/'main.js').symlink_to(outside)
        except OSError:
            # NTFS directory junctions do not need symlink privileges. They
            # exercise the same resolved-path boundary for packaged assets.
            if os.name != 'nt':
                self.skipTest('Symlink creation not available for this user')
            vendor = self.package/'obsidian-plugin/vendor'
            vendor.mkdir()
            (vendor/'asset.js').write_text('new asset',encoding='utf-8')
            external = self.root/'external'
            external.mkdir()
            result = subprocess.run([os.environ['COMSPEC'],'/d','/c','mklink','/J',str(target/'vendor'),str(external)],capture_output=True)
            if result.returncode:
                self.skipTest('Symlinks and junctions unavailable for this user')
        with patch.object(update,'ROOT',self.package), patch.object(update.subprocess,'run'), self.assertRaises(ValueError):
            update.main(['--vault',str(vault),'--plugin-only'])
        self.assertEqual(outside.read_text(encoding='utf-8'),'untouched')


if __name__ == '__main__':
    unittest.main()
