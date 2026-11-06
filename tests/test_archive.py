"""Synthetic protocol, integrity and preservation regressions; no personal data."""
import base64
import copy
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT/'host'))
import host
from archive_format import load_archive
from native_notes import normalize_user_math


def bundle():
    return {'title':'Synthetic example','source_url':'https://chatgpt.com/c/synthetic-example',
            'collector_version':'0.8.2','captured_at':'2026-01-01T00:00:00Z',
            'messages':[{'id':'demo-user','role':'user','markdown':'Show a square function.'},
                        {'id':'demo-assistant','role':'assistant','markdown':'$$\ny=x^2\n$$\n\n```python\ndef square(x):\n    return x ** 2\n```'}],
            'assets':[],'code_blocks':[{'partial':False,'scope':'dom_text','lines':2}],
            'interaction_capture':[],'layout_capture':[],'missing_assets':[],'warnings':[]}


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.vault = self.root/'vault'
        (self.vault/'.obsidian').mkdir(parents=True)
        self.host_folder = self.root/'package/host'
        self.host_folder.mkdir(parents=True)
        self.here = patch.object(host, 'HERE', self.host_folder)
        self.here.start()
        self.addCleanup(self.here.stop)
        self.addCleanup(self.temporary.cleanup)

    def archive(self, value=None):
        return host.handle({'action':'archive','bundle':value or bundle()}, {'vault':str(self.vault)})

    def test_archive_preserves_code_and_deduplicates(self):
        first = self.archive()
        second = self.archive()
        text = Path(first['path']).read_text(encoding='utf-8')
        self.assertIn('def square(x):\n    return x ** 2', text)
        self.assertIn('$$\ny=x^2\n$$', text)
        self.assertTrue(first['verified'])
        self.assertTrue(second['reused'])
        self.assertEqual(first['path'], second['path'])
        self.assertFalse(first['obsidian_display_verified'])

    def test_user_edit_is_preserved(self):
        first = self.archive()
        note = Path(first['path'])
        note.write_text('My edits', encoding='utf-8')
        second = self.archive()
        self.assertEqual(note.read_text(encoding='utf-8'), 'My edits')
        self.assertNotEqual(first['path'], second['path'])

    def test_tampered_snapshot_is_not_reported_as_success(self):
        first = self.archive()
        Path(first['snapshot_path']).write_text('tampered', encoding='utf-8')
        with self.assertRaises(ValueError):
            self.archive()

    def test_partial_code_is_rejected_before_writing(self):
        value = bundle()
        value['code_blocks'][0]['partial'] = True
        with self.assertRaises(ValueError):
            self.archive(value)
        self.assertFalse((self.vault/'ChatGPT 学习归档').exists())

    def test_line_count_mismatch_is_rejected(self):
        value = bundle()
        value['code_blocks'][0]['expected_lines'] = 200
        with self.assertRaises(ValueError):
            self.archive(value)

    def test_old_collector_is_rejected(self):
        value = bundle()
        value['collector_version'] = '0.4.3'
        with self.assertRaises(ValueError):
            self.archive(value)

    def test_foreign_source_is_rejected(self):
        value = bundle()
        value['source_url'] = 'https://example.com/c/synthetic-example'
        with self.assertRaises(ValueError):
            self.archive(value)

    def test_path_escape_is_rejected(self):
        with self.assertRaises(ValueError):
            host.within(self.vault, self.vault/'../outside.md')
        with self.assertRaises(ValueError):
            host.checked_asset({'name':'../secret.png','base64':''})

    def test_static_svg_accepts_local_gradient(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/></svg>'
        name, data = host.checked_asset({'name':'image-001.svg','base64':base64.b64encode(svg).decode()})
        self.assertEqual(data, svg)

    def test_svg_scripts_and_external_references_are_rejected(self):
        for inner in ['<script>alert(1)</script>','<image href="https://example.com/a.png"/>','<rect onclick="alert(1)"/>']:
            with self.subTest(inner=inner), self.assertRaises(ValueError):
                raw = ('<svg xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>').encode()
                host.checked_asset({'name':'image-001.svg','base64':base64.b64encode(raw).decode()})

    def test_attachment_tampering_is_detected(self):
        value = bundle()
        raw = b'<svg xmlns="http://www.w3.org/2000/svg"><circle r="3"/></svg>'
        value['assets'] = [{'name':'image-001.svg','base64':base64.b64encode(raw).decode()}]
        value['messages'][1]['markdown'] += '\n\n![circle](assets/image-001.svg)'
        result = self.archive(value)
        asset = Path(result['snapshot_path']).parent/'assets/image-001.svg'
        asset.write_bytes(b'changed')
        with self.assertRaises(ValueError):
            self.archive(value)

    def test_native_message_framing_and_origin(self):
        script = self.host_folder/'host.py'
        script.write_bytes((ROOT/'host/host.py').read_bytes())
        extension_id = 'a'*32
        (self.host_folder/'config.json').write_text(json.dumps({'vault':str(self.vault),'extension_id':extension_id}),encoding='utf-8')
        request = json.dumps({'action':'status'}).encode()
        for origin, expected in [('chrome-extension://'+extension_id+'/',True),('chrome-extension://'+'b'*32+'/',False)]:
            result = subprocess.run([sys.executable,str(script),origin],input=struct.pack('<I',len(request))+request,capture_output=True,timeout=10)
            size = struct.unpack('<I',result.stdout[:4])[0]
            self.assertEqual(len(result.stdout),size+4)
            self.assertEqual(json.loads(result.stdout[4:])['ok'],expected)


class ContainerTests(unittest.TestCase):
    def fixture(self):
        data = {'schema':2,'messages':[{'id':'demo','role':'assistant','snapshot':{'html':'<p>Example</p>'},'programs':[]}],'resources':[]}
        return data

    def load(self, data, expected_hash=None, assets=None):
        raw = json.dumps(data).encode()
        reference = {'schema':2,'asset':'assets/archive-001.json','sha256':expected_hash or hashlib.sha256(raw).hexdigest()}
        return load_archive(reference,{'archive-001.json':raw,**(assets or {})})

    def test_valid_container_and_bad_hash(self):
        data = self.fixture()
        self.assertEqual(self.load(data)['messages'][0]['id'],'demo')
        with self.assertRaises(ValueError):
            self.load(data,'0'*64)

    def test_duplicate_message_identity(self):
        data = self.fixture()
        data['messages'].append(copy.deepcopy(data['messages'][0]))
        with self.assertRaises(ValueError):
            self.load(data)

    def test_missing_resource_rejected(self):
        data = self.fixture()
        data['resources'] = [{'name':'image-001.png','sha256':'0'*64,'type':'image/png'}]
        with self.assertRaises(ValueError):
            self.load(data)

    def test_math_conversion_keeps_fenced_code(self):
        original = '\\[\nx^2\n\\]\n\n```python\n\\[\nx^2\n\\]\n```\n'
        converted = normalize_user_math(original)
        self.assertTrue(converted.startswith('$$\nx^2\n$$'))
        self.assertIn('```python\n\\[\nx^2\n\\]\n```',converted)


if __name__ == '__main__':
    unittest.main()
