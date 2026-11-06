"""Real Chrome on synthetic pages in a fresh temporary profile."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'host'))
from offline_browser import render_result
from runtime_inspector import browser_path


def script(source):
    return source.replace('</script','<\\/script')


class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.browser = browser_path()
        except ValueError as error:
            raise unittest.SkipTest(str(error))

    def render(self, body, source):
        with tempfile.TemporaryDirectory(prefix='archive-tests-',ignore_cleanup_errors=True) as directory:
            temporary = Path(directory)
            page = temporary/'test.html'
            error_handler = "addEventListener('error',e=>{document.getElementById('inspection-result').textContent=JSON.stringify({browserError:e.message})});\n"
            page.write_text('<!doctype html><meta charset="utf-8">'+body+'<pre id="inspection-result">pending</pre><script>'+error_handler+script(source)+'</script>',encoding='utf-8')
            return render_result(self.browser,page,temporary/'profile')

    def test_full_attached_document_exceeds_visible_lines(self):
        reader = (ROOT/'extension/code-source.js').read_text(encoding='utf-8')
        code = '\n'.join('    print('+str(i)+')' for i in range(2400))
        source = '''const full=CODE;
const editor=document.querySelector('.cm-editor'),content=editor.querySelector('.cm-content');
content.cmView={view:{dom:editor,state:{doc:{toString:()=>full,lines:2400}}}};
READER
const records=readObsidianCodeSources();
document.getElementById('inspection-result').textContent=JSON.stringify({count:records.length,full:records[0]?.text===full,lines:records[0]?.lines,scope:records[0]?.scope});
'''.replace('CODE',json.dumps(code)).replace('READER',reader)
        body = '<main><article data-message-author-role="assistant"><div class="cm-editor" style="width:600px;height:100px"><div class="cm-content">Only one visible line</div></div></article></main>'
        result = self.render(body,source)
        self.assertEqual(result,{'count':1,'full':True,'lines':2400,'scope':'codemirror6_document'})

    def test_runtime_control_updates_output_and_restores_state(self):
        runtime = (ROOT/'extension/dil-archive.js').read_text(encoding='utf-8')
        source = runtime + '''
const archiveConstants={},archiveOptions={};
chatgptDilArchive.runtime();
function Demo(){
  const [n,setN]=DIL.useState(2,{key:'n'});
  return __dil.jsx('box',{},__dil.jsx('slider',{min:0,max:10,value:n,onChange:setN}),__dil.jsx('text',{},'Squared: '+n*n));
}
DIL.render(__dil.jsx(Demo,{}));
const field=document.querySelector('input');field.value='5';field.dispatchEvent(new Event('input',{bubbles:true}));
setTimeout(()=>{
  const afterInput=document.getElementById('lesson').textContent;
  const saved=__archiveGetState();__archiveSetState({n:3});
  const restored=document.getElementById('lesson').textContent;
  document.getElementById('inspection-result').textContent=JSON.stringify({afterInput,saved,restored,controls:__archiveInspect().controls});
},20);
'''
        result = self.render('<div id="lesson"></div><section id="handoff" hidden><textarea></textarea></section>',source)
        self.assertIn('Squared: 25',result['afterInput'])
        self.assertEqual(result['saved'],{'n':5})
        self.assertIn('Squared: 9',result['restored'])
        self.assertEqual(result['controls'],1)


if __name__ == '__main__':
    unittest.main()
