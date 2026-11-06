/* Native notes contain only component views. A complete source program runs
   once in an opaque sandbox and supplies state to every view of that program. */
(function(global){
  'use strict';
  const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c');
  const script=value=>String(value).replace(/<\/script/gi,'<\\/script');
  function workerBridge(token,captured,planningOnly){
    const model=document.getElementById('lesson');let initialized=false,restoring=false;
    const send=(type,data={})=>parent.postMessage({channel:'chatgpt-native-widgets',token,type,...data},'*');
    const fieldKey=field=>{const holder=field.closest('[data-archive-node]');if(!holder)return '';if(holder===field)return holder.dataset.archiveNode;const peers=[...holder.querySelectorAll('input,select,textarea,button')].filter(n=>n.closest('[data-archive-node]')===holder);return holder.dataset.archiveNode+':field:'+peers.indexOf(field);};
    const fields=()=>new Map([...model.querySelectorAll('input,select,textarea,button')].map(n=>[fieldKey(n),n]));
    const describe=(node,key,depth=0)=>{
      if(depth>100)throw Error('组件嵌套超过上限');
      if(node.nodeType===3)return {text:node.nodeValue,key};
      if(node.nodeType!==1)return null;
      const out={tag:node.localName,key:node.dataset.archiveNode||key,attrs:{},style:{},children:[]};
      for(const attr of node.attributes)if(!/^on/i.test(attr.name)&&!['style','src','href','srcdoc'].includes(attr.name))out.attrs[attr.name]=attr.value;
      for(const name of node.style)out.style[name]=node.style.getPropertyValue(name);
      if(node.matches('input,select,textarea,button')){out.control=fieldKey(node);out.value=node.value;out.checked=!!node.checked;out.disabled=!!node.disabled;}
      if(node.dataset.archiveType==='math'){out.math={tex:node.dataset.tex||node.textContent,display:node.dataset.displayMath==='true'};return out;}
      out.children=[...node.childNodes].map((n,i)=>describe(n,out.key+':dom:'+i,depth+1)).filter(Boolean);return out;
    };
    const publish=()=>{
      if(restoring||!model.hasChildNodes())return;
      try{
        const panels=window.__archivePanels();
        if(!initialized){
          initialized=true;restoring=true;
          for(const item of captured||[]){const all=fields();let field=all.get(item.fieldKey||item.key||item.path);if(!field&&item.path)field=[...all.values()].find(n=>n.closest('[data-archive-node]')?.dataset.archiveNode===item.path);if(!field)continue;
            if(field.matches('input[type=radio]')&&!item.checked)continue;
            if(typeof item.value==='string')field.value=item.value;if(typeof item.checked==='boolean')field.checked=item.checked;
            if(!field.matches('button'))field.dispatchEvent(new Event(field.matches('select,input[type=radio],input[type=checkbox]')?'change':'input',{bubbles:true}));
          }
          restoring=false;if(captured?.length){queueMicrotask(publish);return;}
        }
        const data={state:window.__archiveGetState(),controls:fields().size,panels:panels.map(panel=>{
          if(planningOnly)return panel;
          const node=[...model.querySelectorAll('[data-archive-node]')].find(n=>n.dataset.archiveNode===panel.path);
          return {...panel,tree:describe(node,panel.path)};
        })};
        if(JSON.stringify(data).length>4*1024*1024)throw Error('组件模型超过大小限制');send('model',data);
      }catch(error){send('error',{message:String(error.message||error)});}
    };
    window.__archiveCommitView=publish;
    GenUI.issueNewTurn=text=>send('handoff',{text:String(text).slice(0,50000)});
    addEventListener('message',event=>{
      const data=event.data;if(event.source!==parent||data?.channel!=='chatgpt-native-action'||data.token!==token)return;
      try{
        if(data.type==='sync'){publish();return;}
        if(data.type==='reset'){window.__archiveSetState(data.state||{});return;}
        const field=fields().get(data.key);if(!field||field.disabled)return;
        if(data.type==='click'){field.click();return;}
        if(!['input','change'].includes(data.type)||!field.matches('input,select,textarea'))return;
        if(typeof data.value==='string'&&data.value.length<=8192)field.value=data.value;
        if(typeof data.checked==='boolean')field.checked=data.checked;
        field.dispatchEvent(new Event(data.type,{bubbles:true}));
      }catch(error){send('error',{message:String(error.message||error)});}
    });
    addEventListener('load',publish);addEventListener('error',event=>send('error',{message:event.message||'原程序运行失败'}));
  }
  function documentFor(program,dil,token,state={},planningOnly=false){
    if(program.kind!=='dil')throw Error('此组件不是 DIL 原程序');
    const options={appearance:{},initialState:Object.keys(state||{}).length?state:program.initialState||{},appData:program.appData||null};
    const policy="default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';img-src data:;font-src data:;connect-src 'none';frame-src 'none';object-src 'none';base-uri 'none';form-action 'none'";
    return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><div id="lesson"></div><section id="handoff" hidden><textarea></textarea></section><script>const archiveConstants='+literal(program.constants)+';const archiveOptions='+literal(options)+';(function '+dil.runtime.toString()+')();('+workerBridge.toString()+')('+literal(token)+','+literal(Object.keys(state||{}).length?[]:program.controls||[])+','+literal(planningOnly)+');</script><script>'+script(program.code)+'</script>';
  }
  const tags=new Set('div span p strong b em i br hr h1 h2 h3 h4 h5 h6 ul ol li table thead tbody tr td th caption blockquote pre code label input select option textarea button svg g path rect circle ellipse line polyline polygon text tspan defs linearGradient radialGradient stop clipPath mask marker use'.split(' '));
  const attrs=new Set('id for class title role aria-label aria-labelledby aria-describedby aria-checked aria-pressed aria-expanded aria-hidden type name min max step placeholder value checked disabled selected multiple rows cols colspan rowspan viewBox d x y x1 x2 y1 y2 cx cy r rx ry points width height fill fill-opacity stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset transform text-anchor dominant-baseline preserveAspectRatio xmlns gradientUnits gradientTransform offset stop-color stop-opacity clip-path marker-start marker-mid marker-end href xlink:href'.split(' '));
  const styles=new Set('display position width height min-width min-height max-width max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left box-sizing border border-top border-right border-bottom border-left border-width border-style border-color border-radius background background-color color font font-family font-size font-weight font-style line-height letter-spacing text-align white-space overflow overflow-x overflow-y flex flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self justify-content gap grid-template-columns grid-column grid-row opacity fill stroke stroke-width'.split(' '));
  for(const name of ['transform','transform-origin','clip-path','stroke-dasharray','stroke-dashoffset','vector-effect','object-fit','object-position','vertical-align'])styles.add(name);
  const unsafeCss=value=>/url\(|expression|@import/i.test(String(value).replace(/url\(\s*(['"]?)#[\w:.-]+\1\s*\)/gi,''));
  function createView(container,options){
    const doc=container.ownerDocument,root=doc.createElement('div');root.className='cgn-inline-surface';container.append(root);
    const surrounding=doc.defaultView.getComputedStyle(container);
    root.style.fontFamily=surrounding.fontFamily;root.style.fontSize=surrounding.fontSize;root.style.lineHeight=surrounding.lineHeight;
    const shadow=root.attachShadow({mode:'open'}),style=doc.createElement('style');
    style.textContent=String(options.css||'').replace(/body\s*\{[^}]*\}/,':host{display:block;font:inherit;color:inherit}')+'\n:host{display:block;color:var(--text-normal,#222);font:16px/1.6 var(--font-text,Arial,sans-serif)}.cgn-body{min-width:0;overflow-x:auto}input,select,textarea,button{font:inherit}input[type=range]{accent-color:var(--interactive-accent,#444)}.dil-radio{border:0;padding:4px 0;margin:0}.dil-box{max-width:100%}button:focus-visible,input:focus-visible{outline:2px solid var(--interactive-accent,#777);outline-offset:2px}';shadow.append(style);
    style.textContent+='\n.dil-math{font:inherit;white-space:normal}.dil-math mjx-container{max-width:100%;overflow-x:auto}';
    const body=doc.createElement('div');body.className='cgn-body';shadow.append(body);
    const mathStyle=doc.createElement('style');shadow.append(mathStyle);
    const nodes=new Map();let lastMath=new WeakMap(),count=0;
    function patch(data,parent,inSvg=false){
      if(++count>20000)throw Error('组件节点超过上限');
      if(typeof data.text==='string'){let node=nodes.get(data.key);if(!node||node.nodeType!==3){node=doc.createTextNode(data.text);nodes.set(data.key,node);}if(node.nodeValue!==data.text)node.nodeValue=data.text;if(node.parentNode!==parent)parent.append(node);return node;}
      if(!tags.has(data.tag))return null;
      const svg=inSvg||data.tag==='svg';let node=nodes.get(data.key);
      if(!node||node.nodeType!==1||node.localName!==data.tag){node=svg?doc.createElementNS('http://www.w3.org/2000/svg',data.tag):doc.createElement(data.tag);nodes.set(data.key,node);}
      node.dataset.cgnKey=data.key;
      const wanted=new Set(['data-cgn-key']);
      for(const [name,value]of Object.entries(data.attrs||{})){
        if(!attrs.has(name)&&!['font-size','font-family','font-weight','font-style','textLength','lengthAdjust'].includes(name)||typeof value!=='string'||value.length>100000||/javascript:/i.test(value)||unsafeCss(value))continue;
        if(['href','xlink:href'].includes(name)&&!/^#[\w:.-]+$/.test(value))continue;
        if(name==='type'&&['password','file','hidden','submit'].includes(value))continue;
        node.setAttribute(name,value);wanted.add(name);
      }
      for(const attr of [...node.attributes])if(!wanted.has(attr.name)&&attr.name!=='style'&&attr.name!=='data-cgn-control')node.removeAttribute(attr.name);
      for(const name of [...node.style])if(!Object.hasOwn(data.style||{},name))node.style.removeProperty(name);
      for(const [name,value]of Object.entries(data.style||{}))if(styles.has(name)&&typeof value==='string'&&value.length<300&&!unsafeCss(value)&&!(name==='position'&&value==='fixed'))node.style.setProperty(name,value);
      if(data.math){node.classList.remove('dil-warning');node.removeAttribute('title');const key=JSON.stringify(data.math);if(lastMath.get(node)!==key){node.replaceChildren(options.renderMath(data.math.tex,!!data.math.display));lastMath.set(node,key);}if(node.parentNode!==parent)parent.append(node);return node;}
      const desired=[];for(const child of data.children||[]){const next=patch(child,node,svg);if(next)desired.push(next);}
      for(const child of [...node.childNodes])if(!desired.includes(child))child.remove();
      let cursor=node.firstChild;for(const child of desired){if(child!==cursor)node.insertBefore(child,cursor);cursor=child.nextSibling;}
      if(data.control){node.dataset.cgnControl=data.control;if('value'in node&&node.value!==data.value)node.value=data.value??'';if('checked'in node)node.checked=!!data.checked;if('disabled'in node)node.disabled=!!data.disabled;}
      if(node.parentNode!==parent)parent.append(node);return node;
    }
    const action=event=>{
      const field=event.target.closest('input,select,textarea,button');if(!field?.dataset.cgnControl)return;
      if(event.type==='click'&&!field.matches('button'))return;if(event.type!=='click'&&field.matches('button'))return;
      options.onAction({type:event.type,key:field.dataset.cgnControl,value:String(field.value||''),checked:!!field.checked});
    };
    for(const event of ['input','change','click'])shadow.addEventListener(event,action);
    return {update(tree){count=0;const rendered=patch(tree,body);for(const child of [...body.childNodes])if(child!==rendered)child.remove();Promise.resolve(options.finishMath?.()).then(()=>{const css=[...doc.head.querySelectorAll('style')].filter(n=>/MJX|MathJax|mjx-/.test(n.id+' '+n.textContent)).map(n=>n.textContent).join('\n');if(mathStyle.textContent!==css)mathStyle.textContent=css;});},dispose(){root.remove();nodes.clear();}};
  }
  function createSession(doc,program,options){
    const win=doc.defaultView,token=win.crypto.randomUUID(),views=new Set();let latest=null,lastView=null,disposed=false;
    const frame=doc.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('aria-hidden','true');frame.title='交互原程序';frame.style.cssText='position:fixed;left:-10000px;top:0;width:700px;height:1px;border:0;pointer-events:none';doc.body.append(frame);
    const send=data=>frame.contentWindow?.postMessage({channel:'chatgpt-native-action',token,...data},'*');
    const update=item=>{const panel=latest?.panels?.find(p=>p.path===item.path);if(panel?.tree){try{item.view.update(panel.tree);item.status.hidden=true;}catch(error){item.status.hidden=false;item.status.textContent='组件显示失败：'+String(error.message||error);}}else if(latest){item.status.hidden=false;item.status.textContent='原程序中暂未显示这个交互组件。';}};
    const listener=event=>{
      const data=event.data;if(disposed||event.source!==frame.contentWindow||data?.channel!=='chatgpt-native-widgets'||data.token!==token)return;
      if(data.type==='model'){
        if(!Array.isArray(data.panels)||data.panels.length>300||JSON.stringify(data).length>5*1024*1024)return;
        latest=data;options.onState?.(data.state||{});for(const item of views)update(item);
      }else if(data.type==='error'){for(const item of views){item.status.hidden=false;item.status.textContent='交互未加载：'+String(data.message).slice(0,500);}}
      else if(data.type==='handoff'&&lastView){const target=lastView.handoff;target.hidden=false;target.querySelector('textarea').value=String(data.text||'');}
    };
    win.addEventListener('message',listener);
    frame.srcdoc=documentFor(program,options.dil,token,options.state||{});
    return {
      attach(container,path){
        const status=doc.createElement('div');status.className='cgn-status';status.textContent='正在加载交互组件…';container.append(status);
        const handoff=doc.createElement('details');handoff.className='cgn-handoff';handoff.hidden=true;const title=doc.createElement('summary');title.textContent='继续对话的请求';const textarea=doc.createElement('textarea');textarea.rows=5;handoff.append(title,textarea);container.append(handoff);
        const item={path,status,handoff,view:null};item.view=createView(container,{css:options.dil.css,renderMath:options.renderMath,finishMath:options.finishMath,onAction:data=>{lastView=item;send(data);}});container.append(handoff);views.add(item);if(latest)update(item);
        return ()=>{views.delete(item);item.view.dispose();status.remove();handoff.remove();};
      },dispose(){disposed=true;win.removeEventListener('message',listener);for(const item of views)item.view.dispose();views.clear();frame.remove();}
    };
  }
  const api={documentFor,createView,createSession};global.ChatgptNativeWidgets=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
