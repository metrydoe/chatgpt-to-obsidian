"""Render source programs in offline, opaque-origin frames in a fresh headless
Chrome profile. Uses the installed browser, no browser account/profile data."""
from pathlib import Path
import html,json,os,re,tempfile
from offline_browser import render_result

def browser_path():
    for folder in [os.environ.get('PROGRAMFILES','C:/Program Files'),os.environ.get('PROGRAMFILES(X86)','C:/Program Files (x86)'),os.environ.get('LOCALAPPDATA')]:
        if not folder:continue
        candidate=Path(folder)/'Google/Chrome/Application/chrome.exe'
        if candidate.is_file():return candidate
    raise ValueError('未找到 Chrome，无法验证原交互程序')

def inspect_programs(records,recovery):
    if not isinstance(records,list) or len(records)>40:raise ValueError('原程序数量无效')
    payload=[]
    for record in records:
        if not isinstance(record,dict) or not isinstance(record.get('id'),str) or not isinstance(record.get('html'),str):raise ValueError('原程序验证请求无效')
        # The exported HTML runs only inside sandbox="allow-scripts". Neither
        # the program nor its DOM can access the trusted parent document.
        payload.append({'id':record['id'],'html':record['html']})
    if sum(len(record['html']) for record in payload)>24_000_000:raise ValueError('原程序超过验证大小限制')
    literal=json.dumps(payload,ensure_ascii=False).replace('<','\\u003c')
    child_bridge="""<script>addEventListener('error',e=>{window.__archiveError=String(e.message||e.error)});</script>"""
    parent_script="""
const items=PAYLOAD,results=[],frames=new Map();
function finish(){if(results.length!==items.length)return;const pre=document.createElement('pre');pre.id='inspection-result';pre.textContent=JSON.stringify(results);document.body.replaceChildren(pre);}
addEventListener('message',event=>{const entry=frames.get(event.source);if(!entry||event.data?.token!==entry.token)return;frames.delete(event.source);results.push({id:entry.id,...event.data.result});finish();});
for(const [index,item] of items.entries()){
 const token='inspection-'+index+'-'+Math.random(),frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');
 const tail='<script>setTimeout(()=>{try{if(window.__archiveError)throw Error(window.__archiveError);const inspection=__archiveInspect();parent.postMessage({token:'+JSON.stringify(token)+',result:{verified:true,inspection}},"*")}catch(error){parent.postMessage({token:'+JSON.stringify(token)+',result:{verified:false,error:String(error.message||error)}},"*")}},20);<'+ '/script>';
 frame.srcdoc=BRIDGE+item.html+tail;document.body.append(frame);frames.set(frame.contentWindow,{id:item.id,token});
}
if(!items.length)finish();
""".replace('PAYLOAD',literal).replace('BRIDGE',json.dumps(child_bridge).replace('<','\\u003c'))
    policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; frame-src 'self' about:; connect-src 'none'"
    page='<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+html.escape(policy,quote=True)+'"><body><pre id="inspection-result">pending</pre><script>'+parent_script+'</script>'
    recovery=Path(recovery);recovery.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='runtime-check-',dir=recovery,ignore_cleanup_errors=True) as temporary:
        temp=Path(temporary);source=temp/'inspect.html';source.write_text(page,encoding='utf-8')
        result=render_result(browser_path(),source,temp/'profile')
        if not isinstance(result,list) or len(result)!=len(records):raise ValueError('交互验证结果数量不完整')
        for item in result:
            if item.get('verified'):
                info=item.get('inspection',{})
                if not info.get('wholeProgram') or not isinstance(info.get('nodes'),list) or len(info['nodes'])>20000:
                    raise ValueError('完整程序验证结果无效')
        return result
