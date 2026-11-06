"""Versioned archive container and portable, offline viewer construction."""
import base64,hashlib,json,re,html
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
MAX_JSON=8*1024*1024

def load_archive(reference,assets,message_count=None):
    if not isinstance(reference,dict) or reference.get('schema')!=2 or reference.get('asset')!='assets/archive-001.json':
        raise ValueError('完整归档引用无效')
    raw=assets.get('archive-001.json')
    if not raw or len(raw)>MAX_JSON or hashlib.sha256(raw).hexdigest()!=reference.get('sha256'):
        raise ValueError('完整归档附件缺失或校验失败')
    data=json.loads(raw.decode('utf-8'))
    if data.get('schema')!=2 or not isinstance(data.get('messages'),list) or not 0<len(data['messages'])<=10000:
        raise ValueError('完整归档消息格式无效')
    if message_count is not None and len(data['messages'])!=message_count:
        raise ValueError('完整归档与 Markdown 消息数量不一致')
    identities=set()
    for message in data['messages']:
        identity=message.get('id')
        if not isinstance(identity,str) or not identity or identity in identities:raise ValueError('归档消息标识缺失或重复')
        identities.add(identity)
        if message.get('role') not in ('user','assistant') or not isinstance(message.get('snapshot',{}).get('html'),str):
            raise ValueError('归档消息缺少页面快照')
        programs=message.get('programs')
        if not isinstance(programs,list) or len(programs)>100:raise ValueError('原程序列表无效')
        for program in programs:check_program(program)
    unbound=data.get('unboundPrograms',[])
    if not isinstance(unbound,list) or len(unbound)>100:raise ValueError('未定位原件列表无效')
    for program in unbound:check_program(program)
    resources=data.get('resources',[])
    if not isinstance(resources,list) or len(resources)>10000:raise ValueError('资源清单无效')
    seen=set()
    for resource in resources:
        name=resource.get('name')
        if not isinstance(name,str) or name in seen or not re.fullmatch(r'(?:image-\d{3,6}\.(?:png|jpg|webp|gif|svg)|resource-\d{3,6}\.bin)',name):raise ValueError('资源引用无效')
        seen.add(name)
        if name not in assets or hashlib.sha256(assets[name]).hexdigest()!=resource.get('sha256'):raise ValueError('完整归档依赖缺失或校验失败：'+name)
        if not re.fullmatch(r'(?:image|font|audio|video|application)/[\w.+-]+|text/(?:css|javascript|plain)',resource.get('type','')):raise ValueError('资源类型无效')
    return data

def check_program(program):
    if not isinstance(program,dict) or program.get('kind') not in ('dil','html'):raise ValueError('原程序类型无效')
    if program['kind']=='dil':
        if not isinstance(program.get('code'),str) or 'DIL.render(' not in program['code'] or not isinstance(program.get('constants'),(dict,list)):
            raise ValueError('原程序或常量缺失')
    elif not isinstance(program.get('html'),str):raise ValueError('HTML 原程序缺失')

def portable_html(data,assets):
    def literal(value):return json.dumps(value,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    def script(value):return re.sub('</script',r'<\\/script',value,flags=re.I)
    resources={r['name']:'data:'+r['type']+';base64,'+base64.b64encode(assets[r['name']]).decode('ascii') for r in data.get('resources',[])}
    runtime=(ROOT/'extension/dil-archive.js').read_text(encoding='utf-8')
    player=(ROOT/'shared/archive-player.js').read_text(encoding='utf-8')
    bindings=(ROOT/'shared/snapshot-bindings.js').read_text(encoding='utf-8')
    math={'js':(ROOT/'shared/vendor/katex.min.js').read_text(encoding='utf-8'),'css':(ROOT/'shared/vendor/katex-offline.css').read_text(encoding='utf-8')}
    setup='const bundle='+literal(data)+';ChatgptArchivePlayer.render(document.getElementById("archive"),bundle,{dil:chatgptDilArchive,bindings:ChatgptSnapshotBindings,math:'+literal(math)+',resources:'+literal(resources)+',states:{}});'
    title=html.escape(str(data.get('title') or '聊天归档'))
    return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>*{box-sizing:border-box}html{background:#fff;color:#222;scrollbar-gutter:stable}body{margin:0;font:16px/1.5 Arial,"Microsoft YaHei","PingFang SC",sans-serif}main.cga-player{max-width:748px;margin:0 auto;padding:40px 24px 100px}.archive-heading{font-size:28.832px;font-weight:700;line-height:1.3;margin:0 0 32px;letter-spacing:-.3px}@media(max-width:600px){main.cga-player{padding:26px 16px 60px}.archive-heading{font-size:25px}}</style><main id="archive" aria-label="聊天记录"><h1 class="archive-heading">' + title + '</h1></main>'+'<script>'+script(runtime)+'</script><script>'+script(bindings)+'</script><script>'+script(player)+'</script><script>'+script(setup)+'</script></html>'
