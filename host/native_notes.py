"""Native Markdown notes with small, shared-program component references.

No conversation text is rendered inside a whole-note iframe. The existing DOM
to-Markdown conversion remains authoritative for prose, TeX, code and images.
"""
from pathlib import Path
import hashlib,json,re,tempfile,unicodedata
from offline_browser import render_result
from runtime_inspector import browser_path

ROOT=Path(__file__).resolve().parent.parent

def normalize_user_math(markdown):
    """Restore explicit display delimiters escaped by the DOM converter.

    Only standalone bracket delimiters are interpreted; fenced code stays
    unchanged and ordinary prose parentheses are never guessed to be math.
    """
    def convert(text):
        def equation(match):
            tex=re.sub(r'\\([\\`*_\[\]<>])',r'\1',match[1]).strip()
            return '$$\n'+tex+'\n$$'
        text=re.sub(r'(?m)^\\?\[[ \t]*\n([\s\S]*?)^\\?\][ \t]*(?=\n|$)',equation,text)
        # Some pasted sources already lost the opening delimiter. Preserve
        # their TeX fragment without inventing the missing equation prefix.
        return re.sub(r'(?m)^([^\n]*\\\\[a-zA-Z][^\n]*[{}^][^\n]*)\n\\?\][ \t]*(?=\n|$)',equation,text)
    output=[];plain=[];fence=None
    for line in markdown.splitlines(keepends=True):
        marker=re.match(r'^\s{0,3}(`{3,}|~{3,})',line)
        if fence:
            output.append(line)
            if marker and marker[1][0]==fence[0]and len(marker[1])>=len(fence):fence=None
        elif marker:
            output.append(convert(''.join(plain)));plain=[];output.append(line);fence=marker[1]
        else:plain.append(line)
    output.append(convert(''.join(plain)))
    return ''.join(output)

def inspect_panels(messages,recovery=None):
    programs=[{'key':m['id']+'::'+p['id'],'program':p}for m in messages for p in m.get('programs',[])if p.get('kind')=='dil']
    if not programs:return {}
    sources='\n'.join((ROOT/name).read_text(encoding='utf-8')for name in ['extension/dil-archive.js','shared/native-widgets.js'])
    def literal(value):return json.dumps(value,ensure_ascii=False).replace('<','\\u003c')
    def script(value):return re.sub('</script',r'<\\/script',value,flags=re.I)
    run='''const items=ITEMS,results={},pending=new Map();
    const finish=()=>{if(Object.keys(results).length===items.length)document.getElementById('inspection-result').textContent=JSON.stringify(results);};
    addEventListener('message',event=>{const item=pending.get(event.source),data=event.data;if(!item||data?.channel!=='chatgpt-native-widgets'||data.token!==item.token)return;
      if(data.type==='model'){results[item.key]={verified:true,controls:data.controls,panels:data.panels};pending.delete(event.source);item.frame.remove();finish();}
      if(data.type==='error'){results[item.key]={verified:false,error:data.message,panels:[]};pending.delete(event.source);item.frame.remove();finish();}});
    for(const [index,item]of items.entries()){const token='native-plan-'+index,frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.style.cssText='width:700px;height:800px';document.body.append(frame);pending.set(frame.contentWindow,{key:item.key,token,frame});frame.srcdoc=ChatgptNativeWidgets.documentFor(item.program,chatgptDilArchive,token,{},true);}
    '''.replace('ITEMS',literal(programs))
    page='<!doctype html><meta charset="utf-8"><pre id="inspection-result">pending</pre><script>'+script(sources)+'</script><script>'+script(run)+'</script>'
    recovery=Path(recovery or ROOT/'recovery/native-plans');recovery.mkdir(parents=True,exist_ok=True)
    identity=hashlib.sha256((sources+json.dumps(programs,ensure_ascii=False,sort_keys=True)).encode()).hexdigest()
    cached=recovery/(identity+'.json')
    if cached.is_file():return json.loads(cached.read_text(encoding='utf-8'))
    with tempfile.TemporaryDirectory(prefix='inspect-',dir=recovery,ignore_cleanup_errors=True)as temporary:
        temp=Path(temporary);source=temp/'inspect.html';source.write_text(page,encoding='utf-8')
        result=render_result(browser_path(),source,temp/'profile')
    cached.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');return result

def normalized(value):
    return ''.join(c.casefold()for c in unicodedata.normalize('NFKC',str(value))if c.isalnum())

def text_index(markdown):
    """Presentation characters mapped back to original Markdown offsets.

    Fenced programs and URL destinations never count as prose anchors. The
    function only locates a component; it never reformats the retained text.
    """
    keep=[True]*len(markdown);offset=0;fence=None
    for line in markdown.splitlines(keepends=True):
        match=re.match(r'^\s{0,3}(`{3,}|~{3,})',line)
        if fence or match:
            keep[offset:offset+len(line)]=[False]*len(line)
            if fence and match and match[1][0]==fence[0]and len(match[1])>=len(fence):fence=None
            elif not fence:fence=match[1]
        offset+=len(line)
    for match in re.finditer(r'!?\[[^\]]*\]\(([^)\n]*)\)|<!--.*?-->',markdown,re.S):
        start,end=match.span(1)if match.lastindex else match.span()
        keep[start:end]=[False]*(end-start)
    chars=[];positions=[]
    for i,char in enumerate(markdown):
        if not keep[i]:continue
        for value in unicodedata.normalize('NFKC',char).casefold():
            if value.isalnum():chars.append(value);positions.append(i)
    return ''.join(chars),positions

def locate_panel(markdown,panel):
    anchors=[normalized(value)for value in panel.get('anchors',[])if normalized(value)]
    if not anchors:return None
    text,positions=text_index(markdown);matches=[];offset=0
    while len(matches)<100:
        start=text.find(anchors[0],offset)
        if start<0:break
        end=start+len(anchors[0]);valid=True
        for anchor in anchors[1:]:
            found=text.find(anchor,end)
            if found<0:valid=False;break
            end=found+len(anchor)
        if valid and end-start<=max(240,len(normalized(panel.get('text','')))*3):
            first=markdown.rfind('\n',0,positions[start])+1
            last=markdown.find('\n',positions[end-1]);last=len(markdown)if last<0 else last
            matches.append((first,last))
        offset=start+1
    return matches[0]if len(matches)==1 else None

def widget_block(reference,message_id,program_id,path):
    data={'schema':1,'asset':reference['asset'],'sha256':reference['sha256'],'message':message_id,'program':program_id,'view':path}
    return '```chatgpt-widget\n'+json.dumps(data,ensure_ascii=False,indent=2)+'\n```'

def native_messages(messages,archive,reference,plans=None,recovery=None):
    if plans is None:
        plans={};missing=[]
        for message in archive['messages']:
            selected=[]
            for program in message.get('programs',[]):
                if program.get('kind')!='dil':continue
                panels=program.get('inspection',{}).get('panels')if isinstance(program.get('inspection'),dict)else None
                if program.get('runtimeVerified')and isinstance(panels,list):plans[message['id']+'::'+program['id']]={'verified':True,'panels':panels}
                else:selected.append(program)
            if selected:missing.append({**message,'programs':selected})
        if missing:plans.update(inspect_panels(missing,recovery))
    output=[];placements=[]
    for index,message in enumerate(messages):
        view=archive['messages'][index];body=normalize_user_math(message['markdown'])if message['role']=='user'else message['markdown'];edits=[];append=[]
        for program in view.get('programs',[]):
            if program.get('kind')!='dil':continue
            plan=plans.get(view['id']+'::'+program['id'],{})
            for panel in plan.get('panels',[]):
                if not re.fullmatch(r'r(?:\.(?:\d+|f|fragment))*',panel.get('path','')):continue
                # New collectors already mark the exact source DOM boundary.
                existing=[]
                for match in re.finditer(r'^```chatgpt-widget\n(.*?)\n```',body,re.M|re.S):
                    config=json.loads(match[1])
                    if(config.get('message'),config.get('program'),config.get('view'))==(view['id'],program['id'],panel['path']):existing.append(match)
                if existing:
                    placements.append({'message':view['id'],'program':program['id'],'view':panel['path'],'status':'dom-boundary','controls':len(panel.get('controls',[]))});continue
                block=widget_block(reference,view['id'],program['id'],panel['path']);span=locate_panel(body,panel)
                if span and not any(span[0]<end and start<span[1]for start,end,_ in edits):
                    edits.append((*span,block));status='source-anchors'
                else:
                    append.append(block);status='appended-unlocated'
                placements.append({'message':view['id'],'program':program['id'],'view':panel['path'],'status':status,'controls':len(panel.get('controls',[]))})
        for start,end,value in sorted(edits,reverse=True):body=body[:start]+value+body[end:]
        if append:body+='\n\n### 交互组件\n\n'+'\n\n'.join(append)
        output.append({**message,'markdown':body})
    return output,placements

def compose_note(title,messages,source_url,captured_at=None):
    lines=['# '+title,'',f'来源：<{source_url}>','']
    if captured_at:lines += ['采集时间：'+str(captured_at),'']
    for index,message in enumerate(messages,1):
        lines += [f'## {index}. {"提问" if message["role"]=="user"else"回答"}','',message['markdown'],'']
    lines += ['---','','[归档报告](归档报告.json)','']
    return '\n'.join(lines)
