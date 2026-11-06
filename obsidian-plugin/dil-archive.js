/* Read only code and constants already delivered in this page's HTML. No API calls. */
globalThis.chatgptDilArchive={
  read(){
    const found=[],seen=new Set();
    for(const script of document.scripts){
      if(!script.textContent.includes('.enqueue('))continue;
      for(const match of script.textContent.matchAll(/\.enqueue\(("(?:[^"\\]|\\.)*")\)/g)){
        let graph;try{graph=JSON.parse(JSON.parse(match[1]));}catch{continue;}
        if(!Array.isArray(graph)||graph.length>300000)continue;
        const decode=(index,memo=new Map(),depth=0)=>{
          if(depth>80)throw Error('页面数据嵌套过深');
          if(index<0)return null;if(memo.has(index))return memo.get(index);
          const value=graph[index];
          if(Array.isArray(value)){const out=[];memo.set(index,out);for(const child of value)out.push(typeof child==='number'?decode(child,memo,depth+1):child);return out;}
          if(value&&typeof value==='object'){
            const out=Object.create(null);memo.set(index,out);
            for(const [key,ref] of Object.entries(value)){
              const name=key.startsWith('_')?graph[Number(key.slice(1))]:key;
              if(typeof name==='string'&&!['__proto__','constructor','prototype'].includes(name))out[name]=decode(ref,memo,depth+1);
            }return out;
          }return value;
        };
        for(const item of graph){
          if(!item||Array.isArray(item)||typeof item!=='object')continue;
          const refs={};for(const [key,value] of Object.entries(item))refs[key.startsWith('_')?graph[Number(key.slice(1))]:key]=value;
          if(typeof graph[refs.code]!=='string'||!graph[refs.code].includes('DIL.render(')||refs.constants===undefined||typeof graph[refs.fallbackMarkdown]!=='string')continue;
          const code=graph[refs.code];
          try{const constants=decode(refs.constants),fallback=graph[refs.fallbackMarkdown],identity=JSON.stringify([code,constants]);if(seen.has(identity))continue;found.push({code,constants,fallback});seen.add(identity);}catch{}
        }
      }
    }return found;
  },
  version:'2.0.0',
  liveHtml(pkg,snapshot,bindings){
    const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c');
    const options={appearance:{},capturedWidth:snapshot.width,initialState:pkg.initialState||{},appData:pkg.appData||null};
    return '<!doctype html><meta charset="utf-8"><div id="archive-view">'+snapshot.html+'</div><div id="lesson" hidden></div><section id="handoff" hidden><h3>返回 ChatGPT 继续</h3><p>以下内容由原程序生成，可复制回原对话。</p><textarea rows="6" style="width:100%"></textarea></section><script>const archiveConstants='+literal(pkg.constants)+';const archiveOptions='+literal(options)+';window.__archivePrepareView=('+bindings.prepareView.toString()+');(function '+this.runtime.toString()+')();('+bindings.install.toString()+')();</script><script>'+pkg.code.replace(/<\/script/gi,'<\\/script')+'</script>';
  },
  html(pkg){
    const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c');
    return '<!doctype html><meta charset="utf-8"><title>已归档的完整程序</title><style>'+this.css+(pkg.appearance?.fontCss||'')+'</style><div id="lesson"></div><section id="handoff" hidden><h3>返回 ChatGPT 继续</h3><p>以下内容由原演示生成；请复制到原对话发送。</p><textarea rows="6" style="width:100%"></textarea></section><script>const archiveConstants='+literal(pkg.constants)+';const archiveOptions='+literal({appearance:pkg.appearance||{},initialState:pkg.initialState||{},controls:pkg.controls||[],appData:pkg.appData||null})+';(function '+this.runtime.toString()+')();</script><script>'+pkg.code.replace(/<\/script/gi,'<\\/script')+'</script>';
  },
  css:`body{font:16px/1.65 "Microsoft YaHei UI","Microsoft YaHei","Segoe UI",sans-serif;margin:20px;color:#182331;background:#fff}*{box-sizing:border-box}h2,h3{line-height:1.35;margin:20px 0 10px}p{margin:8px 0}.dil-row{display:flex;flex-direction:row;gap:12px;align-items:flex-start;overflow-x:auto}.dil-row>*{min-width:0}.dil-segmented-control{display:flex;gap:6px}.dil-segmented-control button{flex:1}.dil-segmented-control button[aria-pressed="true"]{background:#e8edff;border-color:#6366f1;color:#3339a5}.dil-slider-marks{display:flex;justify-content:space-between;font-size:12px;color:#647080;margin-top:4px}.dil-box,.dil-col{display:flex;flex-direction:column;gap:8px}.dil-grid{display:grid;gap:12px}.dil-math{display:inline-block;font:italic 1em/1.5 serif;white-space:pre-wrap}svg{max-width:100%;height:auto}pre{overflow:auto;background:#f3f5f7;padding:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}button{cursor:pointer;padding:8px 16px;border:1px solid #bbb;border-radius:8px;background:#f6f8fa;color:#162334}button:disabled{opacity:.5;cursor:default}input[type=range]{width:100%;min-width:120px}.dil-radio{display:flex;align-items:flex-start;gap:8px;padding:8px;border:1px solid #ddd;border-radius:6px;margin:4px 0}.dil-radio input{margin-top:8px}.dil-checkbox{display:grid;grid-template-columns:20px 1fr;column-gap:8px}.dil-checkbox input{grid-row:1 / span 2;margin-top:14px}.dil-checkbox p{grid-column:2}.dil-caption{font-size:13px;color:#596575}.dil-warning{padding:10px;background:#fff4d8;color:#6b4b00}blockquote{border-left:3px solid #aaa;margin:12px 0;padding-left:14px}.dil-unsupported{border:1px dashed #c9a227;border-radius:8px;padding:8px 10px;background:#fffbe8;color:#5c4a00}.dil-degraded{margin:4px 0}.dil-degraded>.dil-caption{margin:0 0 8px}`,
  runtime(){
    const host=document.getElementById('lesson'),state=Object.assign(Object.create(null),archiveOptions.initialState||{});let root=null,pending=false,sequence=0;
    const appearance=archiveOptions.appearance||{};
    const decorate=(node,type,path)=>{
      if(node.nodeType!==1)return node;node.dataset.archiveType=String(type);
      const style=appearance.byPath?.[path]||appearance.byType?.[type];
      if(style)for(const [name,value] of Object.entries(style))if(typeof value==='string'&&!/url\(|expression|@import/i.test(value))node.style.setProperty(name,value);
      return node;
    };
    window.__archiveGetState=()=>JSON.parse(JSON.stringify(state));
    window.__archiveSetState=value=>{if(value&&typeof value==='object'&&!Array.isArray(value)){for(const key of Object.keys(state))delete state[key];Object.assign(state,value);paint();}};
    const schedule=()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;paint();});};
    window.__dil={Fragment:Symbol('fragment'),jsx:(type,props,...children)=>({type,props:props||{},children})};
    window.DIL={useConstants:()=>archiveConstants,useAppData:fn=>fn(archiveOptions.appData||{opGenui:{modelDataBindings:{}}}),
      useState:(initial,options={})=>{const key=options.key||'state-'+sequence++;if(!(key in state))state[key]=typeof initial==='function'?initial():initial;return[state[key],value=>{state[key]=typeof value==='function'?value(state[key]):value;schedule();window.dispatchEvent(new CustomEvent('archive-state',{detail:window.__archiveGetState()}));}];},
      render:node=>{root=node;paint();}};
    window.GenUI={issueNewTurn:text=>{const section=document.getElementById('handoff');section.hidden=false;section.querySelector('textarea').value=String(text);section.scrollIntoView({block:'nearest'});}};
    // Component vocabulary. Every component this runtime can build is one row
    // here; supporting a new one is a data change, not another branch. A row is
    // {tag} or {tag:(props,vnode)=>name}; control marks a form control.
    const catalog={
      svg:new Set(['svg','path','rect','circle','line','g','defs','linearGradient','radialGradient','stop','text','tspan','polyline','polygon','ellipse','clipPath','mask']),
      html:new Set(['div','p','h2','h3','strong','em','hr','span','pre','table','tr','td','th','ol','ul','li','label','input','select','option','textarea','button','code','blockquote','a','img','details','summary','h1','h4','h5','h6','section','article','figure','figcaption']),
      entries:{
        row:{tag:'div'},col:{tag:'div'},box:{tag:'div'},grid:{tag:'div'},'grid-item':{tag:'div'},
        text:{tag:'p'},caption:{tag:'p'},bold:{tag:'strong'},italic:{tag:'em'},divider:{tag:'hr'},
        icon:{tag:'span'},badge:{tag:'span'},math:{tag:'span'},
        title:{tag:p=>p.size==='xl'?'h2':'h3'},
        list:{tag:p=>p.ordered||p.marker==='number'?'ol':'ul'},'list-item':{tag:'li'},
        'table-row':{tag:'tr'},'table-cell':{tag:p=>p.header?'th':'td'},
        code:{tag:(p,v)=>p.block||String(p.code??p.value??(v.children||[]).flat().join('')).includes('\n')?'pre':'code'},
        select:{tag:'select',control:true},dropdown:{tag:'select',control:true},
        input:{tag:'input',control:true},'text-input':{tag:'input',control:true},'number-input':{tag:'input',control:true},textarea:{tag:'textarea',control:true},
        switch:{tag:'label',control:true},'segmented-control':{tag:'div',control:true},
        radio:{tag:'label'},'radio-group':{tag:'div',control:true},checkbox:{tag:'label',control:true},
        slider:{tag:'input',control:true},button:{tag:'button',control:true},pressable:{tag:'button',control:true}
      }
    };
    const describeProps=props=>{
      try{
        const text=JSON.stringify(props,(key,value)=>typeof value==='function'||key==='children'?undefined:value);
        return text&&text.length>600?text.slice(0,600)+'…':text||'';
      }catch{return '';}
    };
    // A component outside the vocabulary keeps its place and children so one
    // unknown type cannot take the whole program down. __archiveInspect reports
    // every placeholder it finds.
    function placeholder(type,props,path,svg,radio,v){
      const box=document.createElement('div');
      box.className='dil-unsupported';
      box.setAttribute('data-archive-node',path);
      box.setAttribute('data-archive-unsupported',String(type));
      const summary=describeProps(props);if(summary)box.setAttribute('data-archive-props',summary);
      const note=document.createElement('div');
      note.className='dil-caption';
      note.textContent='未支持的组件 '+String(type)+'：保留位置与内容，行为未迁移';
      box.append(note);
      (v.children||[]).forEach((child,i)=>box.append(create(child,svg,radio,path+"."+i)));
      return box;
    }
    function create(v,svg=false,radio=null,path="r"){
      if(v===null||v===undefined||v===false||v===true)return document.createTextNode('');
      if(Array.isArray(v)){const f=document.createDocumentFragment();v.forEach((x,i)=>f.append(create(x,svg,radio,path+"."+i)));return f;}
      if(typeof v!=='object')return document.createTextNode(String(v));
      if(typeof v.type==='function')return create(v.type({...v.props,children:v.children}),svg,radio,path+".f");
      if(v.type===__dil.Fragment)return create(v.children,svg,radio,path+".fragment");
      const p=v.props||{},t=v.type;
      if(t==='__chatgptClientDefinedWidget'){const e=document.createElement('div');const html=appearance.widgets?.[path];if(html){e.innerHTML=html;}else{e.className='dil-warning';e.dataset.archiveUnsupported=t;e.textContent='此处原网页外部组件未取得可执行源码；请切换到页面快照查看。';}return decorate(e,t,path);}
      const inSvg=svg||t==='svg';
      const entry=catalog.entries[t];
      let tag=null;
      if(inSvg&&catalog.svg.has(t))tag=t;
      else if(entry)tag=typeof entry.tag==='function'?entry.tag(p,v):entry.tag;
      else if(catalog.html.has(t))tag=t;
      if(!tag||(!inSvg&&!catalog.html.has(tag)))return placeholder(t,p,path,svg,radio,v);
      const e=inSvg?document.createElementNS('http://www.w3.org/2000/svg',tag):document.createElement(tag);e.setAttribute("data-archive-node",path);decorate(e,t,path);
      if(inSvg){for(const [k,val] of Object.entries(p))if(k!=='key'&&typeof val!=='function'&&k!=='children'&&k!=='style'){
        const name=k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()).replace('view-box','viewBox');
        e.setAttribute(name,String(val));e.style.removeProperty(name);
      }}
      else{
        e.className='dil-'+t;
        if(entry?.control)e.setAttribute('data-archive-control',t);
        if(t==='box'&&p.border)e.setAttribute('data-archive-panel','');
        if(p.border)e.style.border='1px solid #d4dae1';if(p.radius)e.style.borderRadius='10px';
        if(p.padding)e.style.padding=Number(p.padding)*4+'px';if(p.gap)e.style.gap=Number(p.gap)*4+'px';
        if(p.background)e.style.background=/^(#|rgb|hsl)/.test(p.background)?p.background:'#f5f7f9';
        for(const key of ['width','height','minWidth','maxWidth'])if(typeof p[key]==='string'&&/^[0-9.]+(?:px|%|em|rem)$/.test(p[key])){e.style[key]=p[key];e.style.flexShrink='0';}
        if(p.wrap==='wrap')e.style.flexWrap='wrap';if(p.grow)e.style.flexGrow=String(Number(p.grow)||1);
        if(p.justify==='between')e.style.justifyContent='space-between';
        if(p.size==='xs'&&t!=='title')e.style.fontSize='12px';if(p.size==='sm'&&t!=='title')e.style.fontSize='14px';
        if(p.align==='center')e.style.alignItems='center';if(p.justify==='center')e.style.justifyContent='center';
        if(t==='grid')e.style.gridTemplateColumns='repeat('+Math.max(1,Number(p.columns)||2)+',minmax(0,1fr))';
        if(p.weight==='medium'||p.weight==='semibold')e.style.fontWeight='600';
        if(p.color==='secondary'||p.color==='tertiary')e.style.color='#647080';
        if(t==='img'){e.src=p.src||'';e.alt=p.alt||'';}
        if(t==='a'&&typeof p.href==='string'&&/^(https?:|#)/.test(p.href)){e.href=p.href;e.target='_blank';e.rel='noreferrer';}
        if(t==='details')e.open=!!p.open;
        if(t==='button'||t==='pressable'){e.type='button';e.disabled=!!p.disabled;e.onclick=()=>p.onClick?.();}
        if(t==='segmented-control'){
          e.setAttribute('role','group');e.setAttribute('aria-label',p['aria-label']||'选项');
          for(const option of p.options||[]){const button=document.createElement('button');button.type='button';button.textContent=String(option.label??option.value);button.setAttribute('aria-pressed',String(String(option.value)===String(p.value)));button.onclick=()=>p.onChange?.(option.value);e.append(button);}return e;
        }
        if(t==='select'||t==='dropdown'){
          e.setAttribute('aria-label',p['aria-label']||p.label||'选择');
          for(const item of p.options||[]){const opt=document.createElement('option');const value=typeof item==='object'?item.value:item;opt.value=String(value);opt.textContent=String(typeof item==='object'?item.label??value:item);e.append(opt);}
          e.value=String(p.value??p.defaultValue??'');e.onchange=()=>p.onChange?.(e.value);e.disabled=!!p.disabled;return e;
        }
        if(['input','text-input','number-input','textarea'].includes(t)){
          if(t!=='textarea')e.type=t==='number-input'||p.type==='number'?'number':'text';
          e.value=p.value??p.defaultValue??'';e.placeholder=p.placeholder||'';e.disabled=!!p.disabled;e.setAttribute('aria-label',p['aria-label']||p.label||'输入');
          for(const key of ['min','max','step'])if(p[key]!==undefined)e[key]=p[key];
          const change=()=>p.onChange?.(e.type==='number'?Number(e.value):e.value);e.oninput=change;e.onchange=change;return e;
        }
        if(t==='slider'){e.type='range';e.min=p.min??0;e.max=p.max??100;e.step=p.step??1;e.value=Array.isArray(p.value)?p.value[0]:p.value??p.defaultValue??0;e.setAttribute('aria-label',p['aria-label']||'参数');e.oninput=()=>{p.onChange?.(Number(e.value));p.onValueChange?.(Number(e.value));};}
        if(t==='slider'&&Array.isArray(p.marks)){const field=document.createElement('div');field.className='dil-slider-field';field.append(e);const marks=document.createElement('div');marks.className='dil-slider-marks';for(const mark of p.marks){const label=document.createElement('span');label.textContent=String(mark.label??mark.value);marks.append(label);}field.append(marks);return field;}
        if(t==='radio-group'){radio={value:p.value,change:p.onChange,name:'radio-'+sequence++};}
        if(t==='radio'||t==='checkbox'||t==='switch'){
          const input=document.createElement('input');input.type=t==='radio'?'radio':'checkbox';if(t==='switch')input.setAttribute('role','switch');
          input.value=p.value??'';if(radio)input.name=radio.name;
          input.checked=t==='radio'?String(radio?.value)===String(p.value):!!p.checked;
          input.onchange=()=>t==='radio'?(input.checked&&radio?.change?.(String(p.value))):p.onChange?.(input.checked);e.append(input);
        }
        if(t==='math'){
          const tex=String(p.value??'');e.dataset.tex=tex;e.dataset.displayMath=String(!!p.block);
          if(window.katex){window.katex.render(tex,e,{displayMode:!!p.block,throwOnError:false,trust:false,strict:'ignore'});}
          else if(appearance.math?.[tex])e.innerHTML=appearance.math[tex];
          else{e.textContent=tex;e.classList.add('dil-warning');e.title='公式渲染器不可用，显示原始 TeX';}
          return e;}
        if(t==='code'){e.textContent=p.code??p.value??(v.children||[]).flat().join('');return e;}
        if(t==='icon'){e.textContent=p.name?.includes('arrow')?'→':p.name?.includes('check')?'✓':'•';return e;}
      }
      if(p.style&&typeof p.style==='object')for(const [key,value] of Object.entries(p.style))if(typeof value==='string'||typeof value==='number')e.style[key]=String(value);
      for(const [key,value] of Object.entries(p))if(/^on[A-Z]/.test(key)&&typeof value==='function'&&!['onChange','onValueChange','onInput'].includes(key))e['on'+key.slice(2).toLowerCase()]=value;
      (v.children||[]).forEach((child,i)=>e.append(create(child,inSvg,radio,path+"."+i)));return e;
    }
    window.__archivePanels=function(){
      const fields=[...host.querySelectorAll('input,select,textarea,button')].filter(n=>!n.closest('[data-archive-unsupported],pre,code'));
      const scopes=new Set();
      for(const field of fields){
        let scope=field.closest('[data-archive-panel]');
        if(!scope){
          for(let parent=field.parentElement;parent&&parent!==host;parent=parent.parentElement){
            if(!parent.matches('[data-archive-type="box"],[data-archive-type="col"],[data-archive-type="grid"],[data-archive-type="row"]'))continue;
            if(parent.querySelector('h2,h3,p,table,svg')&&parent.textContent.trim()){scope=parent;break;}
          }
        }
        if(!scope)scope=field.closest('[data-archive-type="radio-group"],[data-archive-type="segmented-control"],[data-archive-type="select"],[data-archive-type="dropdown"]')||field.closest('[data-archive-control]')||field.closest('[data-archive-node]');
        if(scope&&scope!==host)scopes.add(scope);
      }
      const roots=[...scopes].filter(scope=>![...scopes].some(parent=>parent!==scope&&parent.contains(scope)));
      const clean=value=>String(value||'').replace(/[\s\u200b-\u200f\ufeff]+/g,' ').trim();
      const key=field=>{const holder=field.closest('[data-archive-node]');if(!holder)return '';if(holder===field)return holder.dataset.archiveNode;const peers=[...holder.querySelectorAll('input,select,textarea,button')].filter(n=>n.closest('[data-archive-node]')===holder);return holder.dataset.archiveNode+':field:'+peers.indexOf(field);};
      const label=field=>{
        const direct=clean(field.getAttribute('aria-label')||field.labels?.[0]?.textContent||field.closest('label')?.textContent||field.textContent);
        if(direct&&!['参数','输入','选择'].includes(direct))return direct;
        for(let parent=field.parentElement;parent&&parent!==host;parent=parent.parentElement){
          if(parent.querySelectorAll('input,select,textarea').length!==1)break;
          const labels=[...parent.querySelectorAll('label')].filter(n=>!n.contains(field)&&clean(n.textContent));
          if(labels.length===1){const value=clean(labels[0].textContent);field.setAttribute('aria-label',value);return value;}
        }
        return direct;
      };
      return roots.map(scope=>{
        const anchors=[...scope.querySelectorAll('h1,h2,h3,h4,p,label,button,td,th,legend')].filter(n=>!n.closest('svg,[data-archive-type="math"],[data-archive-unsupported]')&&!n.querySelector('h1,h2,h3,h4,p,label,button,td,th,legend')).map(n=>clean(n.textContent)).filter(t=>t&&t.length<=1000);
        const controls=fields.filter(n=>scope.contains(n)).map(n=>({key:key(n),tag:n.localName,type:n.type||n.localName,label:label(n),value:n.value||'',checked:!!n.checked}));
        return {path:scope.dataset.archiveNode,anchors:anchors.length<=64?anchors:[...anchors.slice(0,32),...anchors.slice(-32)],controls,text:clean(scope.textContent),height:Math.ceil(scope.getBoundingClientRect().height)};
      });
    };
    window.__archiveInspect=function(){
      return {runtime:'dil-compat/2.0.0',wholeProgram:true,
        nodes:[...host.querySelectorAll('[data-archive-node]')].slice(0,20000).map(n=>({path:n.dataset.archiveNode,type:n.dataset.archiveType||'',control:n.dataset.archiveControl||''})),
        controls:host.querySelectorAll('input,select,textarea,button').length,panels:window.__archivePanels(),
        unsupported:[...host.querySelectorAll('[data-archive-unsupported]')].map(n=>({type:n.dataset.archiveUnsupported,path:n.dataset.archiveNode||''})),
        text:host.textContent.slice(0,1000)};
    };
    function paint(){
      sequence=0;const active=document.activeElement;const inputs=[...host.querySelectorAll('input,select,textarea')];const focused=inputs.indexOf(active);
      const full=create(root);
      host.replaceChildren(full);
      if(window.__archiveCommitView){window.__archiveCommitView();return;}
      for(const svg of host.querySelectorAll('svg[viewBox]')){
        const box=svg.viewBox.baseVal;let right=box.x+box.width,bottom=box.y+box.height;
        for(const label of svg.querySelectorAll('text')){try{const b=label.getBBox();right=Math.max(right,b.x+b.width+3);bottom=Math.max(bottom,b.y+b.height+3);}catch{}}
        if(right>box.x+box.width||bottom>box.y+box.height)svg.setAttribute('viewBox',[box.x,box.y,right-box.x,bottom-box.y].join(' '));
      }if(focused>=0)host.querySelectorAll('input,select,textarea')[focused]?.focus({preventScroll:true});
    }
  }
};




if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.chatgptDilArchive;
