"""Chrome Native Messaging receiver; no external network, third-party libraries or model API."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import sys
import tempfile
import shutil
import time
import uuid
from urllib.parse import urlparse, quote, unquote
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
LIMIT = 40 * 1024 * 1024

def config():
    return json.loads((HERE / 'config.json').read_text(encoding='utf-8-sig'))

def within(root, path):
    result = path.resolve()
    if not result.is_relative_to(root.resolve()):
        raise ValueError('目标路径不在指定笔记库内')
    return result

def checked_asset(asset):
    name = asset['name']
    if not re.fullmatch(r'(?:image-\d{3,6}\.(?:png|jpg|webp|gif|svg)|interactive-\d{3,6}\.html\.txt|archive-001\.json|resource-\d{3,6}\.bin)', name):
        raise ValueError('附件名称无效')
    encoded = asset['base64']
    if not isinstance(encoded, str) or len(encoded) > 12 * 1024 * 1024:
        raise ValueError('附件太大')
    data = base64.b64decode(encoded, validate=True)
    if len(data)>8*1024*1024:raise ValueError('附件超过 8 MB')
    if name.endswith('.json'):
        value=json.loads(data.decode('utf-8'))
        if value.get('schema')!=2:raise ValueError('归档包版本无效')
        return name,data
    if name.endswith('.bin'):return name,data
    if name.endswith('.html.txt'):
        source=data.decode('utf-8')
        if not source.strip() or '\x00' in source:raise ValueError('交互源码无效')
        return name,data
    ext = name.rsplit('.', 1)[1]
    valid = {'png': data.startswith(b'\x89PNG\r\n\x1a\n'), 'jpg': data.startswith(b'\xff\xd8\xff'),
             'webp': data.startswith(b'RIFF') and data[8:12] == b'WEBP',
             'gif': data[:6] in (b'GIF87a', b'GIF89a')}
    if ext == 'svg':
        svg = data.decode('utf-8-sig')
        # SVG markers, gradients and clip paths legitimately use url(#local-id).
        without_local_urls=re.sub(r'url\(\s*[\"\x27]?#[-\w.:]+[\"\x27]?\s*\)', '', svg, flags=re.I)
        if any(s in without_local_urls.lower() for s in ('<!doctype', '<!entity', '<?xml-stylesheet', 'url(', '@import')):
            raise ValueError('SVG 含外部资源或不支持的样式')
        tree = ET.fromstring(svg)
        if tree.tag.split('}')[-1] != 'svg':
            raise ValueError('不是 SVG')
        for node in tree.iter():
            if node.tag.split('}')[-1].lower() in ('script','foreignobject','iframe','animate','animatemotion','animatetransform','set'):
                raise ValueError('SVG 含交互内容，未按静态图保存')
            for key, val in node.attrib.items():
                key = key.split('}')[-1].lower()
                if key.startswith('on') or (key in ('href','src') and not val.startswith('#')):
                    raise ValueError('SVG 含外部资源或交互事件')
    elif not valid.get(ext):
        raise ValueError('图片格式与文件内容不匹配')
    return name, data

def ensure_layout_style(vault):
    """Enable only our scoped snippet, preserving other appearance settings."""
    source=(HERE/'layout.css').read_text(encoding='utf-8')
    snippets=within(vault,vault/'.obsidian'/'snippets')
    snippets.mkdir(exist_ok=True)
    name='chatgpt-archive-layout-v1'
    target=within(vault,snippets/(name+'.css'))
    # Upgrade our known generated file in place: the running app watches this
    # enabled filename, but may not reread enabled names in appearance.json.
    known_generated={'6abd990a325df411c668606170053333839dcbb23b0fed209848acda41b6888d'}
    if target.exists() and target.read_text(encoding='utf-8')!=source:
        previous_style=target.read_bytes()
        if hashlib.sha256(previous_style).hexdigest() in known_generated:
            backup=within(vault,snippets/(name+'.before-'+hashlib.sha256(previous_style).hexdigest()[:8]+'.css.bak'))
            if not backup.exists():
                with backup.open('xb') as stream:stream.write(previous_style)
            if backup.read_bytes()!=previous_style:raise ValueError('旧样式备份校验失败，未更新')
            pending=within(vault,snippets/('.layout-update-'+uuid.uuid4().hex+'.tmp'))
            try:
                with pending.open('x',encoding='utf-8',newline='') as stream:stream.write(source)
                if target.read_bytes()!=previous_style:raise ValueError('样式刚被修改，未覆盖')
                os.replace(pending,target)
            finally:
                if pending.exists():pending.unlink()
    # A user's edited stylesheet is kept intact; use a content-specific sibling.
    if target.exists() and target.read_text(encoding='utf-8')!=source:
        name+='-'+hashlib.sha256(source.encode()).hexdigest()[:8]
        target=within(vault,snippets/(name+'.css'))
    if not target.exists():
        with target.open('x',encoding='utf-8',newline='') as stream:stream.write(source)
    if target.read_text(encoding='utf-8')!=source:
        raise ValueError('排版样式存在用户修改，未覆盖')
    appearance=within(vault,vault/'.obsidian'/'appearance.json')
    previous=appearance.read_bytes() if appearance.exists() else None
    settings=json.loads(previous.decode('utf-8-sig')) if previous else {}
    enabled=settings.get('enabledCssSnippets',[])
    if not isinstance(enabled,list):raise ValueError('Obsidian 样式设置格式异常，未修改')
    if name not in enabled:
        if previous is not None:
            backup=within(vault,appearance.with_name('appearance.before-chatgpt-layout-'+uuid.uuid4().hex[:8]+'.json'))
            with backup.open('xb') as stream:stream.write(previous)
        settings['enabledCssSnippets']=[*enabled,name]
        # Check again before committing, in case Obsidian changed its settings.
        if (appearance.read_bytes() if appearance.exists() else None)!=previous:
            raise ValueError('Obsidian 设置刚刚变化，请重试以保留新设置')
        pending=within(vault,appearance.with_name('.appearance-chatgpt-'+uuid.uuid4().hex+'.tmp'))
        try:
            with pending.open('x',encoding='utf-8') as stream:
                json.dump(settings,stream,ensure_ascii=False,indent=2)
            os.replace(pending,appearance)
        finally:
            if pending.exists():pending.unlink()
    return {'enabled':True,'snippet':name,'display_verified':False}

def archive(bundle, vault):
    code_blocks=bundle.get('code_blocks',[])
    if not isinstance(code_blocks,list) or len(code_blocks)>10000:
        raise ValueError('代码完整性报告格式无效，未写入归档')
    accepted_scopes={'dom_text','delivered_message_source',
                     'codemirror6_document','codemirror5_document','monaco_attached_document','ace_attached_document'}
    for block in code_blocks:
        if not isinstance(block,dict) or type(block.get('partial')) is not bool:
            raise ValueError('代码完整性报告缺少检查结果，未写入归档')
        if block['partial'] or block.get('scope') not in accepted_scopes:
            raise ValueError('代码尚未完整采集，已停止写入；请保留代码诊断，不要把可见行当作完整程序')
        if type(block.get('lines')) is not int or block['lines']<1:
            raise ValueError('代码行数无效，未写入归档')
        if block.get('expected_lines',block['lines'])!=block['lines']:
            raise ValueError('代码行数与编辑器文档不一致，未写入归档')
    parsed = urlparse(bundle.get('source_url', ''))
    match = re.search(r'/(?:c|share)/([a-zA-Z0-9_-]{1,100})(?:/|$)', parsed.path)
    if parsed.scheme != 'https' or parsed.hostname not in ('chatgpt.com','chat.openai.com') or not match:
        raise ValueError('来源不是 ChatGPT 对话地址')
    messages = bundle.get('messages')
    if not isinstance(messages, list) or not 0 < len(messages) <= 10000:
        raise ValueError('没有可保存的消息，或消息数量过多')
    if any(not isinstance(m, dict) or m.get('role') not in ('user','assistant') or not isinstance(m.get('markdown'),str) for m in messages):
        raise ValueError('消息格式错误')
    if sum(len(m['markdown']) for m in messages) > 8_000_000:
        raise ValueError('正文超过本次大小限制')
    warnings = bundle.get('warnings', [])
    if not isinstance(warnings,list) or not all(isinstance(w,str) for w in warnings):
        raise ValueError('报告格式错误')
    warnings = list(warnings)
    warnings.append('归档基于已加载网页内容；不保证包含未加载历史、其他分支或交互图形。')
    # Messages are stored exactly as captured. Interactive content is only ever
    # the original program bytes saved as an asset; nothing is rebuilt from prose.
    rendered_messages=list(messages)
    assets = {}; failed = []
    for asset in bundle.get('assets', []):
        try:
            name, data = checked_asset(asset)
            if name in assets: raise ValueError('附件重名')
            assets[name] = data
        except Exception as error:
            failed.append(str(asset.get('name','未知附件')))
            warnings.append(f'附件未保存：{asset.get("name","未知附件")}（{error}）')
    if sum(map(len,assets.values())) > 24 * 1024 * 1024:
        raise ValueError('附件总量超过 24 MB')
    archive_reference=bundle.get('archive')
    archive_data=None
    if archive_reference:
        from archive_format import load_archive
        archive_data=load_archive(archive_reference,assets,len(messages))
    native_placements=[]
    if archive_data:
        from native_notes import native_messages
        rendered_messages,native_placements=native_messages(messages,archive_data,archive_reference)
    interactions=bundle.get('interaction_capture',[])
    layouts=bundle.get('layout_capture',[])
    if not isinstance(interactions,list) or len(interactions)>10000 or not isinstance(layouts,list):
        raise ValueError('交互或布局报告格式无效')
    for item in interactions:
        if not isinstance(item,dict) or item.get('status') not in ('native','missing','source_saved','source_saved_dependencies_missing'):
            raise ValueError('交互报告缺少有效状态')
        if item['status'].startswith('source_saved'):
            if item.get('archive_program'):
                ref=item['archive_program']
                matched=[p for m in (archive_data or {}).get('messages',[]) if m['id']==ref.get('message_id') for p in m['programs'] if p['id']==ref.get('program_id')]
                if len(matched)!=1:raise ValueError('完整程序关联无效')
                continue
            name=item.get('asset')
            if not isinstance(name,str) or not re.fullmatch(r'interactive-\d{3,6}\.html\.txt',name) or name not in assets:
                raise ValueError('交互源码附件缺失，未写入归档')
            if item.get('sha256')!=hashlib.sha256(assets[name]).hexdigest():
                raise ValueError('交互源码校验失败，未写入归档')
    missing_assets=bundle.get('missing_assets',[])
    if not isinstance(missing_assets,list) or not all(isinstance(x,dict) for x in missing_assets):raise ValueError('缺失附件报告格式无效')
    losses=[item for item in interactions if item['status'] in ('missing','source_saved_dependencies_missing')]
    for item in losses:
        warnings.append(f"交互缺失 {item.get('id','')}（第 {item.get('message_index','?')} 条消息 / {item.get('title') or item.get('kind','控件')}）：{item.get('reason','未保存')}"+
                        ('；依赖：'+ '、'.join(map(str,item.get('dependencies',[]))) if item.get('dependencies') else ''))
    fidelity={'status':'partial' if losses or failed or missing_assets else 'saved_unverified',
              'interaction_losses':len(losses),'source_saved':sum(i['status'].startswith('source_saved') for i in interactions),
              'native_interactions':sum(i['status']=='native' for i in interactions),'failed_assets':len(failed)+len(missing_assets),
              'visual_verified':False,'interaction_runtime_verified':False,'archive_schema':2 if archive_data else 1,
              'whole_programs':sum(len(m['programs']) for m in archive_data['messages']) if archive_data else 0,
              'unbound_programs':len(archive_data.get('unboundPrograms',[])) if archive_data else 0}
    title = str(bundle.get('title') or 'ChatGPT 学习记录')[:200].replace('\n',' ')
    identity = json.dumps({'title':title,'messages':messages,'assets':{k:hashlib.sha256(v).hexdigest() for k,v in assets.items()},'warnings':warnings,'archive':archive_reference,'interaction_capture':interactions,'layout_capture':layouts,'presentation_revision':3,**({'code_capture_revision':1} if code_blocks else {})},ensure_ascii=False,sort_keys=True)
    digest = hashlib.sha256(identity.encode()).hexdigest()[:16]
    folder = within(vault, vault / 'ChatGPT 学习归档' / match.group(1) / digest)
    note = within(vault, folder / '学习记录.md')
    report_path = within(vault, folder / '归档报告.json')
    # Content-addressed snapshots preserve old captures and user edits.
    if note.exists():
        if not report_path.exists(): raise ValueError('目标目录存在未完成归档，请保留现场并重试新快照')
        report = json.loads(report_path.read_text(encoding='utf-8'))
        return response(vault,note,report,True)
    lines = [f'# {title}', '', f'来源：<{bundle["source_url"]}>', '',
             f'采集时间：{bundle.get("captured_at", "未提供")}', '']
    for index,message in enumerate(rendered_messages,1):
        body = message['markdown']
        for name in failed:
            body = re.sub(r'!\[([^\]]*)\]\(assets/'+re.escape(name)+r'\)',lambda match:'[图片未保存：'+(match[1]or name)+']',body)
        lines += [f'## {index}. {"提问" if message["role"]=="user" else "回答"}', '', body, '']
    if losses or failed:lines += [f'> {len(losses)} 项交互、{len(failed)} 项附件未完整保存，详见归档报告。','']
    lines += ['---','','[归档报告](归档报告.json)','']
    report = {'source_url':bundle['source_url'],'messages':len(messages),'assets':len(assets),'warnings':list(dict.fromkeys(warnings)),
              'captured_at':bundle.get('captured_at'),'snapshot':digest,'title':title,'full_history_verified':False,
              'code_capture':code_blocks,'collector_version':bundle.get('collector_version'),'source_capture':bundle.get('source_capture'),
              'archive':archive_reference,'interaction_capture':interactions,'layout_capture':layouts,'fidelity':fidelity,'missing_assets':missing_assets,
              'presentation':'native-markdown','native_components':native_placements,
              'note_sha256':hashlib.sha256('\n'.join(lines).encode('utf-8')).hexdigest(),
              'asset_sha256':{name:hashlib.sha256(data).hexdigest() for name,data in assets.items()}}
    folder.parent.mkdir(parents=True,exist_ok=True)
    # Keep preparation outside the vault: Obsidian/indexers may hold directory
    # handles that prevent a whole-folder rename on Windows.
    recovery=HERE.parent/'recovery'
    recovery.mkdir(exist_ok=True)
    staging=Path(tempfile.mkdtemp(prefix='archive-',dir=recovery))
    try:
        (staging/'assets').mkdir()
        for name,data in assets.items(): (staging/'assets'/name).write_bytes(data)
        if archive_data:
            from archive_format import portable_html
            portable=portable_html(archive_data,assets).encode('utf-8')
            (staging/'归档视图.html').write_bytes(portable)
            report['portable_sha256']=hashlib.sha256(portable).hexdigest()
        (staging/'归档报告.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        (staging/'消息原文.json').write_text(json.dumps(messages,ensure_ascii=False,indent=2),encoding='utf-8')
        (staging/'学习记录.md').write_text('\n'.join(lines),encoding='utf-8')
        # Reserve a new directory without replacing existing or in-progress data.
        try:
            folder.mkdir()
        except FileExistsError:
            if note.exists() and report_path.exists():
                existing=json.loads(report_path.read_text(encoding='utf-8'))
                shutil.rmtree(staging,ignore_errors=True)
                return response(vault,note,existing,True)
            folder=within(vault,folder.with_name(digest+'-'+uuid.uuid4().hex[:8]))
            folder.mkdir()
            note=folder/'学习记录.md'
        (folder/'assets').mkdir()
        # Publish the note last, so a visible note only references saved assets.
        files=[*sorted((staging/'assets').iterdir()),*([staging/'归档视图.html'] if archive_data else []),staging/'归档报告.json',staging/'消息原文.json',staging/'学习记录.md']
        for source in files:
            destination=within(vault,folder/source.relative_to(staging))
            for attempt in range(6):
                try:
                    output=destination.open('xb')
                    break
                except PermissionError:
                    if attempt==5:raise
                    time.sleep(0.15*(attempt+1))
            with output:
                    output.write(source.read_bytes())
        completed=response(vault,note,report,False)
    except Exception as error:
        # Preserve staged source data instead of deleting it on failure.
        raise RuntimeError(f'写入未完成：{error}。本次完整材料已保留在 {staging}，可恢复，无需重新下载图片。') from error
    else:
        shutil.rmtree(staging,ignore_errors=True)
    return completed

def obsidian_uri(vault,note):
    """Use the registered vault ID and a vault-relative filename, encoded once."""
    vault_name=vault.name
    try:
        settings=Path(os.environ.get('APPDATA',''))/'obsidian/obsidian.json'
        entries=json.loads(settings.read_text(encoding='utf-8-sig')).get('vaults',{})
        for key,entry in entries.items():
            if os.path.normcase(str(Path(entry['path']).resolve()))==os.path.normcase(str(vault.resolve())):
                vault_name=key;break
    except (OSError,ValueError,KeyError,TypeError):pass
    return 'obsidian://open?vault='+quote(vault_name,safe='')+'&file='+quote(note.relative_to(vault).as_posix(),safe='')

def response(vault,note,report,reused):
    text=note.read_text(encoding='utf-8')
    if not text.strip() or len(re.findall(r'^## \d+\. (?:提问|回答)\s*$',text,re.M))<report['messages']:
        raise ValueError('校验失败：正文为空或问答数量不足，未报告保存成功')
    if report.get('note_sha256') and hashlib.sha256(text.encode('utf-8')).hexdigest()!=report['note_sha256']:
        raise ValueError('校验失败：归档正文与保存记录不一致；已有文件未覆盖')
    for name,digest in report.get('asset_sha256',{}).items():
        asset=within(vault,note.parent/'assets'/name)
        if not asset.exists() or hashlib.sha256(asset.read_bytes()).hexdigest()!=digest:
            raise ValueError('校验失败：附件丢失或内容不一致：'+name)
    if report.get('portable_sha256'):
        portable=note.parent/'归档视图.html'
        if not portable.is_file() or hashlib.sha256(portable.read_bytes()).hexdigest()!=report['portable_sha256']:raise ValueError('离线播放器校验失败')
    def check_links(body,parent):
        for link in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',body):
            if link.startswith(('http:','https:','#','data:')):continue
            target=within(vault,parent/unquote(link))
            if not target.is_file():raise ValueError('校验失败：本地图片引用不存在：'+link)
    def check_embedded_resources(body,parent):
        for block in re.finditer(r'^```chatgpt-(?:layout|html|archive|widget)\n(.*?)\n```',body,re.M|re.S):
            data=json.loads(block[1])
            def walk(value):
                if isinstance(value,dict):
                    for key,item in value.items():
                        if key in ('src','asset') and isinstance(item,str):
                            target=within(vault,parent/item)
                            if not target.is_file():raise ValueError('校验失败：交互或布局附件不存在：'+item)
                        else:walk(item)
                elif isinstance(value,list):
                    for item in value:walk(item)
            walk(data)
    check_links(text,note.parent)
    check_embedded_resources(text,note.parent)
    saved_assets=list((note.parent/'assets').glob('*'))
    if len([a for a in saved_assets if a.is_file()])!=report['assets']:
        raise ValueError('校验失败：附件文件数量与报告不一致')
    title=report.get('title') or text.splitlines()[0].lstrip('# ').strip()
    safe=re.sub(r'[<>:"/\\|?*\x00-\x1f]','-',title).strip(' .')[:64] or '学习笔记'
    prefix=note.parent.relative_to(vault).as_posix()+'/assets/'
    readable=re.sub(r'\]\(assets/([^)]+)\)',lambda m:']('+quote(prefix+m.group(1),safe='/')+')',text)
    readable=re.sub(r'("(?:asset|src)"\s*:\s*")assets/',lambda m:m.group(1)+prefix,readable)
    if report.get('archive'):
        readable=readable.replace('](归档视图.html)',']('+quote(note.parent.relative_to(vault).as_posix()+'/归档视图.html',safe='/')+')')
    readable=readable.replace('](归档报告.json)',']('+quote(note.parent.relative_to(vault).as_posix()+'/归档报告.json',safe='/')+')')
    target=within(vault,vault/f'ChatGPT - {safe} - {report["snapshot"][:8]}.md')
    # User edits to a readable note are preserved; publish a separate copy.
    if target.exists() and target.read_text(encoding='utf-8')!=readable:
        target=within(vault,target.with_name(target.stem+' - '+uuid.uuid4().hex[:6]+'.md'))
    if not target.exists():
        for attempt in range(6):
            try:
                stream=target.open('x',encoding='utf-8',newline='')
                break
            except PermissionError:
                if attempt==5:raise
                time.sleep(.15*(attempt+1))
        with stream:stream.write(readable)
    if target.read_text(encoding='utf-8')!=readable:raise ValueError('校验失败：可读笔记写入不完整')
    check_links(readable,vault)
    check_embedded_resources(readable,vault)
    layout_style=None
    warnings=list(report['warnings'])
    if re.search(r'^\s*(?:>\s*)+\[!chatgpt-(?:columns|flow|card|gallery)(?:\|[^\]\r\n]*)?\]',text,re.M):
        try:layout_style=ensure_layout_style(vault)
        except Exception as error:
            layout_style={'enabled':False,'error':str(error),'display_verified':False}
            warnings.append('笔记已保存，但卡片分栏样式未启用：'+str(error))
    return {'ok':True,'path':str(target),'snapshot_path':str(note),'verified':True,
            'verification_scope':'saved_files_only','obsidian_display_verified':False,
            'messages':report['messages'],'assets':report['assets'],
            'warnings':warnings,'reused':reused,'layout_style':layout_style,
            'code_capture':report.get('code_capture',[]),'fidelity':report.get('fidelity',{'status':'saved_unverified'}),
            'interaction_capture':report.get('interaction_capture',[]),'layout_capture':report.get('layout_capture',[]),
            'uri':obsidian_uri(vault,target)}

def handle(message, cfg):
    if message.get('action') == 'diagnose':
        structure=message.get('structure')
        if not isinstance(structure,dict) or not isinstance(structure.get('rows'),list):
            raise ValueError('无效的页面结构诊断')
        encoded=json.dumps(structure,ensure_ascii=False,indent=2)
        if len(encoded)>3_000_000: raise ValueError('诊断超过大小限制')
        diagnostic=HERE.parent/'page-structure-diagnostic.json'
        diagnostic.write_text(encoded,encoding='utf-8')
        return {'ok':True,'path':str(diagnostic)}
    vault = Path(cfg['vault']).resolve()
    if not vault.is_dir() or not (vault/'.obsidian').is_dir():
        raise ValueError('配置的 Obsidian 库不存在，或缺少 .obsidian 文件夹')
    if message.get('action') == 'inspect_programs':
        from runtime_inspector import inspect_programs
        return {'ok':True,'results':inspect_programs(message.get('records'),HERE/'recovery'),'runner':'native-chrome-offline'}
    if message.get('action') == 'read_sources':
        url=str(message.get('source_url',''))
        match=re.fullmatch(r'https://chatgpt\.com/c/([a-f0-9-]{36})',url)
        if not match:raise ValueError('源码补充仅用于指定的当前对话')
        path=HERE/'recovery'/'message-sources'/(match.group(1)+'.json')
        if not path.is_file():return {'ok':True,'records':[]}
        if path.stat().st_size>900000:raise ValueError('补充源码超过大小限制')
        saved=json.loads(path.read_text(encoding='utf-8'))
        if saved.get('source_url')!=url:raise ValueError('补充源码对话不匹配')
        records=saved.get('records',[])
        if not isinstance(records,list) or len(records)>40:raise ValueError('补充源码格式无效')
        for record in records:
            if not isinstance(record,dict) or not isinstance(record.get('code'),str) or 'DIL.render(' not in record['code'] or not isinstance(record.get('fallback'),str) or not isinstance(record.get('constants'),dict):raise ValueError('补充源码格式无效')
        return {'ok':True,'records':records,'origin':saved.get('share_url'),'scope':'user_provided_share'}
    if message.get('action') == 'status':
        return {'ok':True,'vault_name':vault.name,'vault':str(vault),'write_test_performed':False,'minimum_collector_version':'0.8.0','runtime_inspector':'native-chrome-offline'}
    if message.get('action') == 'archive':
        bundle=message['bundle']
        version=str(bundle.get('collector_version',''))
        if not re.fullmatch(r'\d+\.\d+\.\d+',version) or tuple(map(int,version.split('.')))<(0,8,0):
            raise ValueError('扩展采集版本较旧，请在 Chrome 扩展管理页重新加载 ChatGPT → Obsidian，以启用 SVG 布局及交互源码采集')
        if not isinstance(bundle.get('code_blocks'),list):
            raise ValueError('缺少代码完整性报告，未写入归档')
        if not isinstance(bundle.get('interaction_capture'),list) or not isinstance(bundle.get('layout_capture'),list):
            raise ValueError('缺少交互及布局采集报告，未写入归档')
        return archive(bundle,vault)
    raise ValueError('未知操作')

def read_exact(stream, size):
    result=bytearray()
    while len(result)<size:
        chunk=stream.read(size-len(result))
        if not chunk: raise EOFError('消息不完整')
        result.extend(chunk)
    return bytes(result)

def main():
    if os.name=='nt':
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(),os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(),os.O_BINARY)
    try:
        cfg=config()
        if len(sys.argv)<2 or sys.argv[1] != f'chrome-extension://{cfg["extension_id"]}/':
            raise ValueError('调用来源不是已登记的扩展')
        size=struct.unpack('<I',read_exact(sys.stdin.buffer,4))[0]
        if size>LIMIT: raise ValueError('本次归档超过 40 MB')
        message=json.loads(read_exact(sys.stdin.buffer,size))
        result=handle(message,cfg)
        if message.get('action')=='archive' and result.get('verified') and os.name=='nt':
            try:
                os.startfile(result['uri'])
                result['open_requested']=True
            except OSError as error:
                result['open_requested']=False
                result['warnings'].append('文件已校验，但自动打开失败：'+str(error))
    except Exception as error:
        result={'ok':False,'error':str(error)}
    encoded=json.dumps(result,ensure_ascii=False).encode('utf-8')
    if len(encoded)>900000: encoded=b'{"ok":false,"error":"Response too large"}'
    sys.stdout.buffer.write(struct.pack('<I',len(encoded))+encoded);sys.stdout.buffer.flush()

if __name__=='__main__': main()
