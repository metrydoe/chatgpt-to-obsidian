/* One complete source program per execution context. No component slicing. */
(function(global){
  'use strict';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const script=value=>String(value).replace(/<\/script/gi,'<\\/script');
  const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c');
  const policy="default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src about: blob: data:; object-src 'none'; base-uri 'none'; form-action 'none'";
  function node(parent,tag,cls,text){const el=parent.ownerDocument.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);parent.appendChild(el);return el;}
  function sanitizeState(value){try{const text=JSON.stringify(value);if(text.length>200000)return {};const data=JSON.parse(text);return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}}
  function bridge(token,state,formControls){
    return '('+function(token,saved,formControls){
      const send=(type,value={})=>parent.postMessage({channel:'chatgpt-archive-v2',token,type,...value},'*');
      let pending=false,last=0;
      const size=()=>{pending=false;const children=[...document.body.children].filter(el=>!['SCRIPT','STYLE'].includes(el.tagName)&&!el.hidden);const margin=parseFloat(getComputedStyle(document.body).marginBottom)||0;const height=Math.ceil(Math.max(40,...children.map(el=>el.getBoundingClientRect().bottom+scrollY))+margin+4);if(height!==last){last=height;send('height',{height});}};
      const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(size);}};
      addEventListener('error',event=>send('error',{message:event.message||'资源加载错误'}));
      addEventListener('unhandledrejection',event=>send('error',{message:String(event.reason)}));
      addEventListener('securitypolicyviolation',event=>send('error',{message:'存在未打包的资源或服务依赖：'+event.violatedDirective}));
      addEventListener('archive-state',event=>send('state',{state:event.detail}));
      addEventListener('archive-bindings',event=>send('bindings',{report:event.detail}));
      addEventListener('archive-image',event=>send('image',event.detail));
      addEventListener('archive-link',event=>send('link',event.detail));
      const fields=()=>[...document.querySelectorAll('input,select,textarea')].filter(el=>!['password','file','hidden','submit','button'].includes(el.type)).slice(0,1000);
      const fieldKey=el=>{
        if(el.id&&[...document.querySelectorAll('[id]')].filter(n=>n.id===el.id).length===1)return 'id:'+el.id;
        const path=[];for(let n=el;n&&n!==document.body;n=n.parentElement){const peers=[...n.parentElement.children].filter(p=>p.localName===n.localName);path.unshift(n.localName+':'+peers.indexOf(n));}return path.join('/');
      };
      let ready=false,formTimer;
      const saveForm=()=>{if(!ready||window.__archiveGetState)return;clearTimeout(formTimer);formTimer=setTimeout(()=>{const form={};for(const field of fields())form[fieldKey(field)]={value:field.value.slice(0,8192),checked:!!field.checked};send('state',{state:{__archiveForms:form}});},100);};
      document.addEventListener('input',saveForm);document.addEventListener('change',saveForm);
      addEventListener('load',async()=>{
        if(window.__archiveSetState&&Object.keys(saved).length)window.__archiveSetState(saved);
        else if(window.__archiveSetState&&formControls.length){
          for(const item of formControls){
            if(typeof item.path!=='string'||!/^r(?:\.(?:\d+|f|fragment))*$/.test(item.path))continue;
            const holder=document.querySelector('[data-archive-node="'+item.path+'"]');
            const field=holder?.matches('input,select,textarea')?holder:holder?.querySelector('input,select,textarea');
            if(!field)continue;field.value=item.value;if(['radio','checkbox'].includes(field.type))field.checked=item.checked;
            field.dispatchEvent(new Event(field.matches('select')?'change':'input',{bubbles:true}));await Promise.resolve();
          }
        }
        else if(saved.__archiveForms){
          for(const field of fields()){
            const item=saved.__archiveForms[fieldKey(field)];if(!item||typeof item.value!=='string')continue;
            field.value=item.value;if(['radio','checkbox'].includes(field.type))field.checked=!!item.checked;
            field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));await Promise.resolve();
          }
        }
        ready=true;
        new ResizeObserver(schedule).observe(document.body);
        new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
        if(window.__archiveGetState)send('state',{state:window.__archiveGetState()});
        send('ready');schedule();
      });
      addEventListener('resize',schedule);
      addEventListener('message',event=>{
        if(event.source!==parent||event.data?.channel!=='chatgpt-archive-sync'||event.data.token!==token)return;
        const state=event.data.state;
        if(state&&typeof state==='object'&&!Array.isArray(state)&&Object.keys(state).length&&window.__archiveSetState)window.__archiveSetState(state);
        if(window.__archiveGetState)send('state',{state:window.__archiveGetState()});
        if(window.__archiveGetBindings)send('bindings',{report:window.__archiveGetBindings()});
        last=0;schedule();if(ready)send('ready');
      });
    }.toString()+')('+literal(token)+','+literal(sanitizeState(state))+','+literal(formControls||[])+');';
  }
  function resolve(html,resources){return String(html).replace(/archive-resource:([\w.-]+)/g,(_,name)=>resources[name]||'data:,');}
  function documentFor(message,program,options,token,state,preserveSnapshot=false){
    let raw='';
    if(preserveSnapshot&&program?.kind==='dil'&&options.bindings)raw=options.dil.liveHtml(program,message.snapshot,options.bindings);
    else if(program?.kind==='dil')raw=options.dil.html(program);
    else if(program?.kind==='html')raw=program.html;
    else {
      raw='<!doctype html><meta charset="utf-8"><body style="color:'+escape(message.snapshot.color||'inherit')+';background:'+escape(message.snapshot.background||'transparent')+'">'+message.snapshot.html+'</body>';
      const embedded=(message.programs||[]).filter(p=>p.kind==='html');
      if(embedded.length){
        const documents=embedded.map((p,i)=>({id:p.id,token:token+'-embedded-'+i,html:documentFor(message,p,options,token+'-embedded-'+i,options.states?.[message.id+'::'+p.id]||{})}));
        raw+='<script>('+function(items,token){
          const frames=new Map();
          addEventListener('message',event=>{const item=frames.get(event.source);if(!item||event.data?.channel!=='chatgpt-archive-v2'||event.data.token!==item.token)return;
            if(event.data.type==='height'&&Number.isFinite(event.data.height))item.frame.style.height=Math.max(80,event.data.height)+'px';
            if(event.data.type==='state')parent.postMessage({channel:'chatgpt-archive-v2',token,type:'embedded-state',programId:item.id,state:event.data.state},'*');
          });
          for(const [i,item] of items.entries()){
            const holder=document.querySelector('[data-archive-frame="'+i+'"]');if(!holder)continue;
            const frame=document.createElement('iframe');frame.style.cssText='width:100%;border:0;min-height:120px';frame.setAttribute('sandbox','allow-scripts');frame.title='归档框架 '+(i+1);holder.style.height='auto';holder.appendChild(frame);frame.srcdoc=item.html;frames.set(frame.contentWindow,{frame,token:item.token,id:item.id});
          }
        }.toString()+')('+literal(documents)+','+literal(token)+');<'+ '/script>';
      }
    }
    if(!program&&options.bindings?.prepareView)raw+='<script>('+options.bindings.prepareView.toString()+')(document.body,'+literal(message.snapshot.width||null)+');<'+ '/script>';
    raw=resolve(raw,options.resources||{});
    const math=options.math||{};
    const head='<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+escape(policy)+'">'+
      '<style>html{overflow:hidden}html,body{margin:0;padding:0;min-height:0}body{overflow-wrap:break-word}img{max-width:100%}'+(preserveSnapshot?'body{background:'+escape(message.snapshot.background||'white')+';color:'+escape(message.snapshot.color||'#0d0d0d')+'}':'')+(math.css||'')+'</style>'+
      (math.js&&program?.kind==='dil'?'<script>'+script(math.js)+'</script>':'')+
      '<script>document.documentElement.dataset.archiveRole='+literal(message.role||'assistant')+';window.__archiveTypography='+literal(options.typography||null)+';'+bridge(token,state,program?.controls)+'</script>';
    return head+raw;
  }
  function render(container,bundle,options={}){
    if(bundle?.schema!==2||!Array.isArray(bundle.messages)||bundle.messages.length>10000)throw Error('归档包格式无效');
    options.states=options.states||{};
    const doc=container.ownerDocument,win=doc.defaultView,frames=new Map(),disposers=[];
    // Use the vault's native reading typography, including theme overrides.
    // The offline viewer uses the same defaults when no host theme is present.
    const nativeRoot=container.closest('.markdown-preview-view,.markdown-source-view');
    if(!options.typography&&nativeRoot){
      const sample=doc.createElement('div');sample.className='markdown-rendered';sample.style.cssText='position:absolute;visibility:hidden;pointer-events:none;width:700px;left:-10000px';nativeRoot.append(sample);
      const typography={},samples=new Map();node(sample,'span','',' ');
      for(const tag of ['p','h1','h2','h3','h4','strong'])samples.set(tag,node(sample,tag,'','Aa 中文'));
      node(sample,'span','',' ');
      // Measure after all siblings exist. First/last-child theme rules would
      // otherwise incorrectly remove the margins from every archived paragraph.
      for(const [tag,item]of samples){const css=win.getComputedStyle(item);typography[tag]={};for(const key of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','marginTop','marginBottom'])typography[tag][key]=css[key];}
      sample.remove();options.typography=typography;
    }
    let disposed=false;
    container.classList.add('cga-player');
    const style=node(container,'style','');style.textContent='.cga-player{font:16px/1.75 Arial,"Microsoft YaHei","PingFang SC",sans-serif;color:#1f1f1f;background:#fff;max-width:768px;margin:0 auto;isolation:isolate}.cga-message{position:relative;margin:0 0 44px;width:100%;box-sizing:border-box}.cga-message[data-role=user]{width:fit-content;max-width:80%;min-width:0;margin-left:auto;margin-bottom:36px}.cga-role{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.cga-options{font-size:12px;color:#8a8a8a;margin:6px 0 0}.cga-options>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:28px;height:24px;border-radius:6px;font-size:19px;letter-spacing:2px;user-select:none}.cga-options>summary::-webkit-details-marker{display:none}.cga-options>summary:hover{background:#f4f4f4;color:#333}.cga-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 0}.cga-toolbar button{font:inherit;font-size:12px;border:1px solid #dedede;border-radius:8px;padding:5px 10px;background:#fff;color:#555;cursor:pointer}.cga-toolbar button[aria-pressed=true]{background:#f4f4f4;border-color:#aaa;color:#222}.cga-status{font-size:12px;color:#777;margin:3px 0}.cga-frame{display:block;border:0;width:100%;min-height:40px;background:transparent}.cga-error{color:#b3372a}.cga-unbound{margin:20px 0;padding:12px;border:1px dashed #ccc}@media(max-width:520px){.cga-message[data-role=user]{max-width:92%}.cga-message{margin-bottom:32px}}';
    const listen=(el,event,handler)=>{el.addEventListener(event,handler);disposers.push(()=>el.removeEventListener(event,handler));};
    function previewImage(data){
      if(typeof data.src!=='string'||data.src.length>12*1024*1024||!/^data:image\/(?:png|jpeg|gif|webp|svg\+xml)[;,]/.test(data.src))return;
      const dialog=node(doc.body,'dialog','cga-image-preview');dialog.style.cssText='max-width:96vw;max-height:94vh;padding:12px;border:1px solid #999;border-radius:10px;background:var(--background-primary,white);color:var(--text-normal,black)';
      const close=node(dialog,'button','','关闭');close.type='button';close.style.cssText='display:block;margin-left:auto;margin-bottom:8px';
      const image=node(dialog,'img','');image.src=data.src;image.alt=String(data.alt||'');image.style.cssText='display:block;max-width:90vw;max-height:80vh;width:auto;height:auto;object-fit:contain';
      close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
      disposers.push(()=>{if(dialog.open)dialog.close();dialog.remove();});dialog.showModal();
    }
    listen(win,'message',event=>{
      const entry=frames.get(event.source),data=event.data;
      if(!entry||data?.channel!=='chatgpt-archive-v2'||data.token!==entry.token)return;
      if(data.type==='image')previewImage(data);
      if(data.type==='link'&&typeof data.url==='string'&&data.url.length<=16000){try{const url=new URL(data.url);if(['https:','http:'].includes(url.protocol))win.open(url.href,'_blank','noopener,noreferrer');}catch{}}
      if(data.type==='height'&&Number.isFinite(data.height)&&data.height>0&&data.height<10_000_000)entry.frame.style.height=Math.ceil(data.height)+'px';
      if(data.type==='error'){entry.status.hidden=false;entry.status.classList.add('cga-error');entry.status.textContent='运行问题：'+String(data.message).slice(0,500);entry.failed=true;}
      if(data.type==='bindings'){
        entry.bindings=data.report;
        if(data.report?.unbound?.length){entry.partial=true;entry.status.hidden=false;entry.status.textContent=data.report.unbound.length+' 个控件尚未恢复；原页面内容已保留。';}
      }
      if(data.type==='ready'&&!entry.failed&&!entry.partial){entry.status.textContent=entry.description;entry.status.hidden=true;}
      if(data.type==='state'&&entry.key){const state=sanitizeState(data.state);options.states[entry.key]=state;options.onState?.(entry.key,state);}
      if(data.type==='embedded-state'&&entry.programIds.includes(data.programId)){
        const key=entry.messageId+'::'+data.programId,state=sanitizeState(data.state);options.states[key]=state;options.onState?.(key,state);
      }
    });
    function messageView(message,index,unbound=false){
      if(!message?.snapshot||typeof message.snapshot.html!=='string'||!Array.isArray(message.programs))throw Error('消息归档格式无效');
      const section=node(container,'section','cga-message'+(unbound?' cga-unbound':''));
      section.dataset.role=message.role;
      const capturedWidth=message.snapshot.width;
      if(message.role==='user'){section.style.width=Math.min(600,Math.max(180,Number(capturedWidth)||416)+40)+'px';}
      node(section,'div','cga-role',unbound?'未定位的原程序':message.role==='user'?'你':'ChatGPT');
      const menu=node(section,'details','cga-options');const summary=node(menu,'summary','','···');summary.title='显示选项';summary.setAttribute('aria-label','显示选项');
      const toolbar=node(menu,'div','cga-toolbar'),status=node(section,'div','cga-status');
      const frame=node(section,'iframe','cga-frame');frame.title='已归档消息 '+(index+1);frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
      // A real size hint keeps Obsidian's virtual preview from measuring a long
      // answer as an 80px block before the sandbox has completed its first load.
      const initialHeight=Number(message.snapshot.height);
      frame.style.height=(Number.isFinite(initialHeight)&&initialHeight>0?Math.max(40,Math.min(200000,Math.ceil(initialHeight))):160)+'px';
      section.append(menu);
      const buttons=[];let currentWindow=null,currentEntry=null;
      // Obsidian prepares code blocks off-document and moves cached previews.
      // A reattached iframe gets a new WindowProxy; reconnect on every load.
      listen(frame,'load',()=>{
        if(disposed||!currentEntry)return;
        if(currentWindow)frames.delete(currentWindow);
        currentWindow=frame.contentWindow;if(!currentWindow)return;
        frames.set(currentWindow,currentEntry);currentWindow.postMessage({channel:'chatgpt-archive-sync',token:currentEntry.token,state:sanitizeState(options.states[currentEntry.key]||{})},'*');
      });
      const canBind=!!options.bindings&&message.programs.length===1&&message.programs[0].kind==='dil'&&Number.isFinite(message.snapshot.width)&&message.snapshot.width>0;
      const show=programIndex=>{
        if(disposed)return;
        if(currentWindow)frames.delete(currentWindow);
        const preserve=programIndex===-2,program=preserve?message.programs[0]:programIndex<0?null:message.programs[programIndex];
        const token=win.crypto.randomUUID(),key=program?message.id+'::'+program.id:null;
        for(const button of buttons)button.setAttribute('aria-pressed',String(Number(button.dataset.view)===programIndex));
        status.classList.remove('cga-error');status.hidden=false;status.textContent='正在加载归档内容…';
        const description=preserve?'原页面与交互':program?(program.kind==='dil'?'完整程序 · 兼容运行环境 · 状态在本地保存':'已保存的完整 HTML 程序'):(message.programs.length?'原页面快照':'原页面快照');
        frame.srcdoc=documentFor(message,program,options,token,options.states?.[key]||{},preserve);
        currentEntry={frame,token,key,status,description,messageId:message.id,programIds:message.programs.map(p=>p.id)};
        currentWindow=frame.contentWindow;if(currentWindow)frames.set(currentWindow,currentEntry);
      };
      if(message.programs.length){
        const snapshot=node(toolbar,'button','',canBind?'原页面与交互':'页面快照');snapshot.type='button';snapshot.dataset.view=String(canBind?-2:-1);buttons.push(snapshot);listen(snapshot,'click',()=>show(canBind?-2:-1));
        message.programs.forEach((program,i)=>{const button=node(toolbar,'button','cga-program-button',message.programs.length===1?'兼容程序界面':'兼容程序界面 '+(i+1));button.type='button';button.dataset.view=String(i);buttons.push(button);listen(button,'click',()=>show(i));});
        const reset=node(toolbar,'button','','重置当前交互');reset.type='button';listen(reset,'click',()=>{
          const active=Number(buttons.find(b=>b.getAttribute('aria-pressed')==='true')?.dataset.view);if(!Number.isFinite(active)||active===-1)return;
          const index=active===-2?0:active;
          const key=message.id+'::'+message.programs[index].id;options.states[key]={};options.onState?.(key,{});show(active);
        });
      }else menu.remove();
      const runnable=message.programs.length===1&&message.programs[0].runtimeVerified&&!(message.programs[0].inspection?.unsupported?.length);
      show(canBind?-2:runnable?0:-1);
    }
    bundle.messages.forEach((message,index)=>messageView(message,index));
    if(bundle.unboundPrograms?.length){
      const details=node(container,'details','cga-unbound');node(details,'summary','','未定位原程序：'+bundle.unboundPrograms.length+' 个');
      // Append complete programs without assigning them to guessed messages.
      for(const [index,program] of bundle.unboundPrograms.entries()){
        const before=container.lastChild;
        messageView({id:'unbound-'+index,role:'assistant',snapshot:{html:'<p>此原程序没有可核验的消息标识。请选择完整交互查看。</p>'},programs:[{...program,id:program.id||'program-'+index}]},index,true);
        details.appendChild(container.lastChild);
      }
    }
    return {dispose(){disposed=true;frames.clear();for(const dispose of disposers)dispose();container.replaceChildren();}};
  }
  const api={render,documentFor,resolve,policy};global.ChatgptArchivePlayer=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
