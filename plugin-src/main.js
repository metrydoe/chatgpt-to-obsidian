'use strict';
const {Plugin, MarkdownRenderChild, renderMath, loadMathJax, finishRenderMath}=require('obsidian');
const archivePlayer=require('./archive-player');
const dilArchive=require('./dil-archive');
const snapshotBindings=require('./snapshot-bindings');
const nativeWidgets=require('./native-widgets');
function element(parent,tag,cls,text){
  const node=parent.ownerDocument.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=String(text);
  parent.appendChild(node);return node;
}
module.exports=class LearningWidgets extends Plugin{
  async onload(){
    const stored=await this.loadData();
    this.state={schema:2,widgets:stored?.widgets&&typeof stored.widgets==='object'?stored.widgets:{},archives:stored?.archives&&typeof stored.archives==='object'?stored.archives:{}};
    this.nativeSessions=new Map();this.nativeArchives=new Map();
    this.register(()=>{for(const pending of this.nativeSessions.values())pending.then(session=>session.dispose()).catch(()=>{});this.nativeSessions.clear();});
    this.registerMarkdownCodeBlockProcessor('chatgpt-widget',(source,el,ctx)=>this.renderNativeWidget(source,el,ctx));
    this.registerMarkdownCodeBlockProcessor('chatgpt-archive',(source,el,ctx)=>this.renderCompleteArchive(source,el,ctx));
    this.registerMarkdownCodeBlockProcessor('chatgpt-layout',(source,el,ctx)=>this.renderArchivedLayout(source,el,ctx));
    this.registerMarkdownCodeBlockProcessor('chatgpt-html',(source,el,ctx)=>this.renderHtmlArchive(source,el,ctx));
    this.registerMarkdownPostProcessor?.((el,ctx)=>this.collapseArchiveMetadata(el,ctx));
  }
  async renderNativeWidget(source,el,ctx){
    const child=new MarkdownRenderChild(el);ctx.addChild(child);let disposed=false,detach=null;
    child.register(()=>{disposed=true;detach?.();});
    el.classList.add('cgn-inline-widget');
    for(const event of ['mousedown','click','keydown'])child.registerDomEvent(el,event,e=>e.stopPropagation());
    try{
      if(source.length>50000)throw Error('交互引用过大');const config=JSON.parse(source);
      if(config.schema!==1||typeof config.asset!=='string'||!/(?:^|\/)archive-001\.json$/.test(config.asset)||/[\\:\x00]/.test(config.asset)||config.asset.split('/').includes('..')||! /^[a-f0-9]{64}$/.test(config.sha256)||! /^r(?:\.(?:\d+|f|fragment))*$/.test(config.view)||typeof config.message!=='string'||typeof config.program!=='string')throw Error('交互引用无效');
      const folder=ctx.sourcePath.includes('/')?ctx.sourcePath.slice(0,ctx.sourcePath.lastIndexOf('/')+1):'';
      const file=this.app.vault.getAbstractFileByPath(folder+config.asset)||this.app.vault.getAbstractFileByPath(config.asset);if(!file)throw Error('原程序归档不存在');
      const archiveKey=file.path+'::'+config.sha256;
      if(!this.nativeArchives.has(archiveKey))this.nativeArchives.set(archiveKey,(async()=>{const raw=await this.app.vault.read(file),bytes=new TextEncoder().encode(raw);if(bytes.length>8*1024*1024)throw Error('原程序归档过大');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==config.sha256)throw Error('原程序校验失败');const bundle=JSON.parse(raw);if(bundle.schema!==2||!Array.isArray(bundle.messages))throw Error('原程序归档格式无效');return bundle;})());
      const bundle=await this.nativeArchives.get(archiveKey),message=bundle.messages.find(m=>m.id===config.message),program=message?.programs.find(p=>p.id===config.program&&p.kind==='dil');if(!program)throw Error('没有找到对应的完整原程序');
      const stateKey=ctx.sourcePath+'::'+config.sha256,programKey=config.message+'::'+config.program,sessionKey=stateKey+'::'+programKey;
      if(!this.nativeSessions.has(sessionKey))this.nativeSessions.set(sessionKey,(async()=>{
        if(typeof loadMathJax==='function')await loadMathJax();if(typeof renderMath!=='function')throw Error('Obsidian 数学渲染器不可用');
        const states=this.state.archives[stateKey]||(this.state.archives[stateKey]={});
        return nativeWidgets.createSession(el.ownerDocument,program,{dil:dilArchive,state:states[programKey]||{},renderMath,finishMath:finishRenderMath,onState:state=>{if(JSON.stringify(states[programKey])===JSON.stringify(state))return;states[programKey]=state;this.scheduleSave();}});
      })());
      const session=await this.nativeSessions.get(sessionKey);if(!disposed)detach=session.attach(el,config.view);
    }catch(error){if(!disposed)element(el,'p','cgl-error','交互组件未加载：'+error.message);}
  }
  async collapseArchiveMetadata(el,ctx){
    const headings=[...el.querySelectorAll('h2')].filter(node=>node.textContent.trim()==='归档范围与缺失项'&&!node.closest('details'));
    if(!headings.length)return;
    const file=this.app.vault.getAbstractFileByPath(ctx.sourcePath);if(!file)return;
    const text=await this.app.vault.read(file);if(!text.includes('```chatgpt-archive'))return;
    for(const heading of headings){
      const list=heading.nextElementSibling;if(!list||list.tagName!=='UL'||!heading.parentNode)continue;
      const details=el.ownerDocument.createElement('details');details.className='cga-archive-info';
      const summary=el.ownerDocument.createElement('summary');summary.textContent='归档信息与缺失项';details.append(summary);
      heading.before(details);details.append(heading,list);
    }
  }
  async renderCompleteArchive(source,el,ctx){
    const child=new MarkdownRenderChild(el);ctx.addChild(child);let disposed=false,viewer=null;
    child.register(()=>{disposed=true;viewer?.dispose();});
    try{
      if(source.length>50000)throw Error('归档配置过大');
      const config=JSON.parse(source);
      if(config.schema!==2||typeof config.asset!=='string'||!/(?:^|\/)archive-001\.json$/.test(config.asset)||! /^[a-f0-9]{64}$/.test(config.sha256)||config.asset.split('/').includes('..')||/[\\:\x00]/.test(config.asset))throw Error('完整归档引用无效');
      const folder=ctx.sourcePath.includes('/')?ctx.sourcePath.slice(0,ctx.sourcePath.lastIndexOf('/')+1):'';
      const file=this.app.vault.getAbstractFileByPath(folder+config.asset)||this.app.vault.getAbstractFileByPath(config.asset);
      if(!file)throw Error('归档附件不存在');
      const raw=await this.app.vault.read(file),bytes=new TextEncoder().encode(raw);
      if(bytes.length>8*1024*1024)throw Error('归档附件超过大小限制');
      const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
      if(await digest(bytes)!==config.sha256)throw Error('归档附件校验不一致');
      const bundle=JSON.parse(raw);
      if(bundle.schema!==2||!Array.isArray(bundle.messages)||!Array.isArray(bundle.resources))throw Error('归档格式无效');
      const resources={};let total=bytes.length;
      for(const resource of bundle.resources){
        if(!/^(?:image-\d{3,6}\.(?:png|jpg|webp|gif|svg)|resource-\d{3,6}\.bin)$/.test(resource.name)||! /^(?:image|font|audio|video|application)\/[\w.+-]+$|^text\/(?:css|javascript|plain)$/.test(resource.type))throw Error('资源清单无效');
        const asset=this.app.vault.getAbstractFileByPath(file.parent.path+'/'+resource.name);
        if(!asset)throw Error('依赖资源不存在：'+resource.name);
        const data=new Uint8Array(await this.app.vault.readBinary(asset));total+=data.length;
        if(total>24*1024*1024)throw Error('归档资源超过大小限制');
        if(await digest(data)!==resource.sha256)throw Error('依赖资源校验失败：'+resource.name);
        let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
        resources[resource.name]='data:'+resource.type+';base64,'+btoa(binary);
      }
      const pluginFolder=this.manifest.dir||'.obsidian/plugins/'+this.manifest.id;
      const [js,css]=await Promise.all(['katex.min.js','katex-offline.css'].map(name=>this.app.vault.adapter.read(pluginFolder+'/vendor/'+name)));
      if(disposed)return;
      const key=ctx.sourcePath+'::'+config.sha256;
      const states=this.state.archives[key]||(this.state.archives[key]={});
      viewer=archivePlayer.render(el,bundle,{dil:dilArchive,bindings:snapshotBindings,math:{js,css},resources,states,onState:(id,state)=>{states[id]=state;this.scheduleSave();}});
      this.decorateArchiveNote(el,child);
    }catch(error){if(!disposed)element(el,'p','cgl-error','完整归档未加载：'+error.message);}
  }

  decorateArchiveNote(el,child){
    const view=el.closest('.markdown-preview-view');if(!view)return;
    const info=element(el,'details','cga-note-information');element(info,'summary','','归档信息');
    const content=element(info,'div','cga-note-information-content'),seen=new Set();
    const copy=element(el,'details','cga-copy-toggle');element(copy,'summary','','查看 Markdown 副本');copy.hidden=true;
    const copyNodes=new Set();
    copy.addEventListener('toggle',()=>view.classList.toggle('cga-show-copy',copy.open));
    const before=node=>!!(node.compareDocumentPosition(el)&4);
    const hide=node=>{
      if(!node||seen.has(node))return;seen.add(node);
      const clone=node.cloneNode(true);clone.classList.remove('cga-note-metadata');content.append(clone);
      node.classList.add('cga-note-metadata');
    };
    const update=()=>{
      if(!view.classList.contains('cga-archive-note'))view.classList.add('cga-archive-note');
      for(const node of view.querySelectorAll('p,blockquote,h2')){
        if(node.closest('.cga-note-information')||!before(node))continue;
        const text=node.textContent.trim();
        if(node.tagName==='P'&&/^(?:来源：https?:\/\/chatgpt\.com\/|采集时间：)/.test(text))hide(node);
        if(node.tagName==='BLOCKQUOTE'&&text.startsWith('本文为网页已加载内容的归档快照'))hide(node);
        if(node.tagName==='H2'&&text==='归档范围与缺失项'){
          const list=node.nextElementSibling?.matches('ul')?node.nextElementSibling:node.parentElement?.nextElementSibling?.querySelector('ul');
          hide(node);if(list&&before(list))hide(list);
        }
      }
      info.hidden=!seen.size;
      // Obsidian can split Markdown inside HTML details into sibling sections.
      // Keep that generated fallback closed instead of displaying a second copy.
      const section=el.closest('.markdown-preview-section');
      const marker=[...view.querySelectorAll('summary')].find(node=>node.textContent.startsWith('Markdown 副本（'));
      if(section&&marker){let block=marker;while(block.parentElement&&block.parentElement!==section)block=block.parentElement;
        if(block.parentElement===section){for(let item=block;item;item=item.nextElementSibling){if(item===el||item.contains(el))continue;copyNodes.add(item);item.classList.add('cga-markdown-copy');}copy.hidden=false;}
      }
    };
    const observer=new MutationObserver(update);observer.observe(view,{childList:true,subtree:true});update();
    child.register(()=>{observer.disconnect();view.classList.remove('cga-archive-note','cga-show-copy');for(const node of seen)node.classList.remove('cga-note-metadata');for(const node of copyNodes)node.classList.remove('cga-markdown-copy');});
  }

  renderArchivedLayout(source,el,ctx){
    try{
      if(source.length>500000)throw Error('布局内容过大');
      const config=JSON.parse(source);if(config.schema!==1||!config.tree)throw Error('布局格式无效');
      const child=new MarkdownRenderChild(el);ctx.addChild(child);
      const root=element(el,'section','cgl-preserved-layout');let count=0;
      const folder=ctx.sourcePath.includes('/')?ctx.sourcePath.slice(0,ctx.sourcePath.lastIndexOf('/')+1):'';
      const tags=new Set(['div','span','p','strong','b','em','i','br','h1','h2','h3','h4','h5','h6','ul','ol','li','img']);
      const styles=new Set(['display','flexDirection','flexWrap','alignItems','justifyContent','gap','rowGap','columnGap','flexGrow','flexShrink','flexBasis','gridTemplateColumns','alignSelf','textAlign','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','color','backgroundColor','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft','width','height','maxWidth','minWidth','margin','boxSizing']);
      const create=(value,parent,depth=0)=>{
        if(++count>1800||depth>70||!value||typeof value!=='object')throw Error('布局节点无效');
        if(typeof value.text==='string'){parent.appendChild(el.ownerDocument.createTextNode(value.text));return;}
        if(!tags.has(value.tag))throw Error('不支持的布局标签');
        const node=element(parent,value.tag,'');
        for(const [key,val] of Object.entries(value.style||{}))if(styles.has(key)&&typeof val==='string'&&val.length<160&&!/url\(|expression|@import|javascript:/i.test(val))node.style[key]=val;
        if(value.tag==='img'){
          // Legacy collectors emitted an empty path when intentionally skipping
          // a citation favicon. Do not let one image abort all following text.
          if(value.src===''){node.remove();return;}
          const safe=typeof value.src==='string'&&!/[\\:\x00]/.test(value.src)&&!value.src.split('/').includes('..')&&/(?:^|\/)image-\d{3,6}\.(?:svg|png|jpg|webp|gif)$/.test(value.src);
          const file=safe&&(this.app.vault.getAbstractFileByPath(folder+value.src)||this.app.vault.getAbstractFileByPath(value.src));
          if(!file){node.replaceWith(element(el.ownerDocument.createElement('span'),'span','cgl-error',value.alt?'图片未加载：'+value.alt:'图片未加载'));return;}
          node.src=this.app.vault.getResourcePath(file);node.alt=typeof value.alt==='string'?value.alt:'';
        }
        for(const item of value.children||[])create(item,node,depth+1);
      };
      create(config.tree,root);
      for(const event of ['mousedown','click'])child.registerDomEvent(root,event,e=>e.stopPropagation());
    }catch(error){element(el,'p','cgl-error','布局未加载：'+error.message);}
  }

  async renderHtmlArchive(source,el,ctx){
    const child=new MarkdownRenderChild(el);ctx.addChild(child);
    let disposed=false;child.register(()=>{disposed=true;});
    try{
      if(source.length>50000)throw Error('交互配置过大');
      const config=JSON.parse(source);
      if(config.schema!==1||typeof config.asset!=='string'||!/(?:^|\/)interactive-\d{3,6}\.html\.txt$/.test(config.asset)||! /^[a-f0-9]{64}$/.test(config.sha256)||config.asset.split('/').some(part=>part==='..')||/[\\:\x00]/.test(config.asset))throw Error('交互源码引用无效');
      const folder=ctx.sourcePath.includes('/')?ctx.sourcePath.slice(0,ctx.sourcePath.lastIndexOf('/')+1):'';
      const file=this.app.vault.getAbstractFileByPath(folder+config.asset)||this.app.vault.getAbstractFileByPath(config.asset);
      if(!file||file.extension!=='txt')throw Error('交互源码附件不存在');
      const raw=await this.app.vault.read(file);
      const bytes=new TextEncoder().encode(raw);
      if(bytes.length>8*1024*1024)throw Error('交互源码超过 8 MB');
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
      if(hash!==config.sha256)throw Error('交互源码已变化，校验不一致');
      if(disposed)return;
      const root=element(el,'section','cgl-widget cgl-html-widget');root.dataset.widgetType='html';
      const inline=config.presentation==='inline';if(inline)root.classList.add('cgl-inline-widget');
      for(const event of ['mousedown','click','keydown'])child.registerDomEvent(root,event,e=>e.stopPropagation());
      element(root,'strong','cgl-title',config.title||'已归档的 HTML 演示');
      const status=element(root,'p','cgl-html-status','原始源码已保存。点击运行后，可检查滑块、按钮及显示结果。');
      if(config.dependencies?.length)element(root,'p','cgl-error','有依赖尚未打包：'+config.dependencies.join('、')+'。演示可能无法完整运行。');
      const run=element(root,'button','cgl-html-run','运行已保存交互');run.type='button';
      const reset=element(root,'button','cgl-html-reset','清除控件记录并重新运行');reset.type='button';reset.hidden=true;
      const key=ctx.sourcePath+'::html::'+hash;
      let frame=null,token='';
      child.registerDomEvent(window,'message',event=>{
        if(!frame||event.source!==frame.contentWindow||event.data?.channel!=='chatgpt-archive-html'||event.data.token!==token)return;
        const data=event.data;
        if(data.type==='ready')status.textContent='已加载原始源码。请操作核对效果；文本输入、选项及滑块会保存，演示内部状态取决于原程序。';
        if(data.type==='height'&&inline&&Number.isFinite(data.height)){frame.style.height=Math.max(140,Math.min(4000,data.height))+'px';}
        if(data.type==='error'){status.hidden=false;}
        if(data.type==='error')status.textContent='运行存在问题：'+String(data.message||'未知错误').slice(0,500);
        if(data.type==='state'&&Array.isArray(data.controls)&&data.controls.length<=300){
          const controls=data.controls.filter(item=>item&&Number.isInteger(item.index)&&item.index>=0&&item.index<300&&typeof item.value==='string'&&item.value.length<=2000&&typeof item.checked==='boolean').map(item=>({index:item.index,value:item.value,checked:item.checked}));
          this.state.widgets[key]={controls};this.scheduleSave();
        }
      });
      const start=()=>{
        if(frame)frame.remove();token=crypto.randomUUID();
        const saved=this.state.widgets[key]?.controls||[];
        const bootstrap=`(()=>{
          const token=${JSON.stringify(token)},saved=${JSON.stringify(saved).replace(/</g,'\\u003c')};
          const send=(type,data={})=>parent.postMessage({channel:'chatgpt-archive-html',token,type,...data},'*');
          let failed=false;
          let lastHeight=0;
          const size=()=>{const nodes=[...document.body.children].filter(el=>!['SCRIPT','STYLE'].includes(el.tagName)&&!el.hidden);const height=Math.ceil(Math.max(0,...nodes.map(el=>el.getBoundingClientRect().bottom+scrollY))+20);if(height!==lastHeight){lastHeight=height;send('height',{height});}};
          addEventListener('load',()=>{new MutationObserver(()=>requestAnimationFrame(size)).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','style']});size();});addEventListener('resize',size);
          addEventListener('error',event=>{failed=true;send('error',{message:event.message||'资源加载失败'});});
          addEventListener('unhandledrejection',event=>{failed=true;send('error',{message:String(event.reason)});});
          addEventListener('securitypolicyviolation',event=>{failed=true;send('error',{message:'未打包的资源或不支持的运行依赖：'+event.violatedDirective});});
          const fields=()=>Array.from(document.querySelectorAll('input,select,textarea')).filter(el=>!['password','file','hidden','submit','button'].includes(el.type)).slice(0,300);
          let ready=false,timer;
          const save=()=>{if(!ready)return;clearTimeout(timer);timer=setTimeout(()=>send('state',{controls:fields().map((el,index)=>({index,value:el.value.slice(0,2000),checked:!!el.checked}))}),100);};
          document.addEventListener('input',save);document.addEventListener('change',save);
          addEventListener('load',()=>setTimeout(()=>{
            const controls=fields();
            for(const item of saved){const el=controls[item.index];if(!el)continue;el.value=item.value;if(['checkbox','radio'].includes(el.type))el.checked=item.checked;if(el.type!=='radio'||el.checked){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}}
            ready=true;if(!failed)send('ready');
          },0));
        })();`;
        frame=el.ownerDocument.createElement('iframe');frame.className='cgl-html-frame';
        frame.title=config.title||'已归档交互';frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');
        frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
        const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
        // Policy and bridge precede all source bytes. Original source stays untouched on disk.
        frame.srcdoc='<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><script>'+bootstrap+'</script>'+raw;
        root.appendChild(frame);if(inline){frame.style.resize='none';frame.style.minHeight='0';}run.textContent='重新运行';reset.hidden=false;status.textContent='正在运行已保存的源码…';
      };
      child.registerDomEvent(run,'click',start);
      child.registerDomEvent(reset,'click',()=>{delete this.state.widgets[key];this.scheduleSave();start();});
      if(inline){root.querySelector('.cgl-title').hidden=true;status.hidden=true;const menu=element(root,'details','cgl-inline-options');element(menu,'summary','','演示选项');menu.append(run,reset);start();}
    }catch(error){if(!disposed)element(el,'p','cgl-error','交互未加载：'+error.message);}
  }

  scheduleSave(){
    if(this.saveTimer)window.clearTimeout(this.saveTimer);
    this.saveTimer=window.setTimeout(()=>{this.saveTimer=null;this.saveData(this.state).catch(console.error);},200);
  }
  onunload(){if(this.saveTimer){window.clearTimeout(this.saveTimer);this.saveTimer=null;this.saveData(this.state).catch(console.error);}}
};
