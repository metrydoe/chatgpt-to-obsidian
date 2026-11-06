"""Convert a whole-conversation export into an editable Obsidian note.

Dry-run is the default. --apply creates checked backups and replaces only the
derived note(s) and their presentation report. Original JSON and assets stay
byte-for-byte unchanged.
"""
from pathlib import Path
import argparse,hashlib,json,os,re,sys,tempfile,time,uuid
ROOT=Path(__file__).resolve().parent;sys.path.insert(0,str(ROOT/'host'))
from archive_format import load_archive
from native_notes import native_messages

def digest(data):return hashlib.sha256(data).hexdigest()
def within(vault,path):
    path=path.resolve()
    if not path.is_relative_to(vault.resolve()):raise ValueError('引用超出指定笔记库')
    return path

def split_messages(body,archive):
    headers=[];offset=0;fence=None
    for line in body.splitlines(keepends=True):
        marker=re.match(r'^\s{0,3}(`{3,}|~{3,})',line)
        if fence:
            if marker and marker[1][0]==fence[0]and len(marker[1])>=len(fence):fence=None
        elif marker:fence=marker[1]
        else:
            match=re.match(r'^## (\d+)\. (提问|回答)\s*$',line)
            if match:headers.append((offset,offset+len(line),int(match[1]),'user'if match[2]=='提问'else'assistant'))
        offset+=len(line)
    if len(headers)!=len(archive['messages']):raise ValueError('可编辑正文的消息边界与原件不一致，未改写')
    messages=[]
    for i,(_,start,number,role)in enumerate(headers):
        if number!=i+1 or role!=archive['messages'][i]['role']:raise ValueError('消息顺序不一致，未改写')
        end=headers[i+1][0]if i+1<len(headers)else len(body)
        messages.append({'id':archive['messages'][i]['id'],'role':role,'markdown':body[start:end].strip()})
    return messages

def prepare(note,vault):
    note=within(vault,note);before=note.read_bytes();text=before.decode('utf-8-sig').replace('\r\n','\n')
    match=re.search(r'^```chatgpt-archive\n(.*?)\n```',text,re.M|re.S)
    if not match:raise ValueError('此笔记不是整篇播放器格式，无需按此方式转换')
    reference=json.loads(match[1]);asset=reference.get('asset','')
    if not isinstance(asset,str)or '\\'in asset or ':'in asset or '..'in asset.split('/'):raise ValueError('原件引用无效')
    source=within(vault,note.parent/asset)
    if not source.is_file():source=within(vault,vault/asset)
    raw=source.read_bytes();candidate=json.loads(raw);assets={'archive-001.json':raw}
    for resource in candidate.get('resources',[]):
        name=resource.get('name','')
        if not re.fullmatch(r'(?:image-\d{3,6}\.(?:png|jpg|webp|gif|svg)|resource-\d{3,6}\.bin)',name):raise ValueError('资源路径无效')
        assets[name]=(source.parent/name).read_bytes()
    archive=load_archive({'schema':2,'asset':'assets/archive-001.json','sha256':reference['sha256']},assets)
    marker=re.search(r'<details>\s*<summary>Markdown 副本（搜索、编辑和引用）</summary>\s*',text[match.end():])
    if not marker:raise ValueError('没有找到原生 Markdown 正文，未改写')
    start=match.end()+marker.end();end=text.rfind('</details>')
    if end<start:raise ValueError('Markdown 副本边界无效')
    messages=split_messages(text[start:end],archive)
    native,placements=native_messages(messages,archive,reference)
    prefix=text[:match.start()]
    old_report=json.loads((source.parent.parent/'归档报告.json').read_text(encoding='utf-8'))
    warnings={'- '+str(value).replace('\n',' ')for value in old_report.get('warnings',[])}
    marker_at=prefix.find('## 归档范围与缺失项\n')
    if marker_at>=0:
        section=prefix[marker_at+len('## 归档范围与缺失项\n'):]
        custom=[line for line in section.splitlines()if line.strip()and line not in warnings]
        prefix=prefix[:marker_at]+('## 归档范围与缺失项\n'+'\n'.join(custom)+'\n'if custom else '')
    prefix=prefix.replace('> 本文为网页已加载内容的归档快照，保留提问与回答；不是经过模型重写的摘要。\n','').rstrip()
    gap=text[match.end():match.end()+marker.start()]
    gap=re.sub(r'^\[在浏览器中打开离线归档\]\([^\n]+\)\s*','',gap.strip(),flags=re.M).strip()
    if gap:prefix+='\n\n'+gap
    lines=[prefix,'']
    for index,message in enumerate(native,1):lines += [f'## {index}. {"提问"if message["role"]=="user"else"回答"}','',message['markdown'],'']
    suffix=text[end+len('</details>'):].strip()
    if suffix:lines += [suffix,'']
    report_path=within(vault,source.parent.parent/'归档报告.json')
    report_ref=os.path.relpath(report_path,note.parent).replace('\\','/')
    from urllib.parse import quote
    lines += ['---','',f'[归档报告]({quote(report_ref,safe="/")})','']
    output='\n'.join(lines)
    if '```chatgpt-archive'in output or '<summary>Markdown 副本'in output:raise ValueError('仍包含整篇播放器，未提交')
    return {'path':note,'before':before,'after':output.encode('utf-8'),'placements':placements,'archive_path':source,'report_path':report_path,
            'asset_hashes':{str(source.parent/name):digest(value)for name,value in assets.items()}}

def atomic_write(path,data):
    fd,name=tempfile.mkstemp(prefix='.native-note-',suffix='.tmp',dir=path.parent)
    try:
        with os.fdopen(fd,'wb')as stream:stream.write(data)
        os.replace(name,path)
    finally:
        pending=Path(name)
        if pending.is_file():pending.unlink()

def convert(note,vault,output=None,apply=False,also_snapshot=False):
    prepared=[prepare(note,vault)]
    snapshot=prepared[0]['report_path'].parent/'学习记录.md'
    if also_snapshot and snapshot.resolve()!=note.resolve():prepared.append(prepare(snapshot,vault))
    if output:
        output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(prepared[0]['after'])
    summary={'applied':False,'notes':[{'path':str(item['path']),'before':digest(item['before']),'after':digest(item['after']),'components':item['placements']}for item in prepared]}
    if not apply:return summary
    report_path=prepared[0]['report_path'];report_before=report_path.read_bytes();report=json.loads(report_before)
    for item in prepared:
        if item['path'].resolve()==snapshot.resolve():
            report.setdefault('original_note_sha256',report.get('note_sha256'));report['note_sha256']=digest(item['after']);report['presentation']='native-markdown';report['presentation_plugin_version']='0.5.0';report['native_components']=item['placements']
    if also_snapshot:prepared.append({'path':report_path,'before':report_before,'after':json.dumps(report,ensure_ascii=False,indent=2).encode('utf-8')})
    backup=ROOT/'backups'/('native-notes-'+time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6]);backup.mkdir(parents=True)
    for item in prepared:
        target=backup/item['path'].relative_to(vault);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(item['before'])
        if target.read_bytes()!=item['before']:raise ValueError('备份校验失败')
        if item['path'].read_bytes()!=item['before']:raise ValueError('笔记刚被修改，未覆盖')
    committed=[]
    try:
        for item in prepared:
            if item['path'].read_bytes()!=item['before']:raise ValueError('文件刚被修改，未覆盖')
            atomic_write(item['path'],item['after']);committed.append(item)
        hashes=prepared[0]['asset_hashes'];unchanged={path:digest(Path(path).read_bytes())==expected for path,expected in hashes.items()}
        if not all(unchanged.values()):raise ValueError('原件发生变化，已停止提交')
    except Exception:
        for item in reversed(committed):
            if item['path'].read_bytes()==item['after']:atomic_write(item['path'],item['before'])
        raise
    summary.update(applied=True,backup=str(backup),original_assets_unchanged=unchanged)
    (backup/'conversion-result.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--note',type=Path,required=True);parser.add_argument('--vault',type=Path,required=True);parser.add_argument('--output',type=Path);parser.add_argument('--apply',action='store_true');parser.add_argument('--also-snapshot',action='store_true');parser.add_argument('--report',type=Path)
    args=parser.parse_args();result=convert(args.note.resolve(),args.vault.resolve(),args.output,args.apply,args.also_snapshot)
    if args.report:args.report.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True,indent=2))
