/* Keep the captured DOM as the view. One original program supplies the state
   and callbacks; binding never extracts or independently runs a component. */
(function(global){
  'use strict';
  function prepareView(view,capturedWidth){
    if(innerWidth<1){
      if(!view.__archiveLayoutPending){const observer=new ResizeObserver(()=>{if(innerWidth<1)return;observer.disconnect();delete view.__archiveLayoutPending;prepareView(view,capturedWidth);});view.__archiveLayoutPending=observer;observer.observe(document.documentElement);}
      return;
    }
    if(!view.id)view.id='archive-view';
    const typography=window.__archiveTypography||{
      p:{fontFamily:'Arial,"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif',fontSize:'16px',lineHeight:'24px',marginTop:'16px',marginBottom:'16px'},
      h1:{fontSize:'28.832px',fontWeight:'700',lineHeight:'36px',marginTop:'32px',marginBottom:'16px'},
      h2:{fontSize:'25.632px',fontWeight:'660',lineHeight:'33px',marginTop:'28px',marginBottom:'16px'},
      h3:{fontSize:'21.088px',fontWeight:'660',lineHeight:'27.4px',marginTop:'24px',marginBottom:'16px'},
      h4:{fontSize:'18px',fontWeight:'600',lineHeight:'25px',marginTop:'20px',marginBottom:'12px'},strong:{fontWeight:'600'}
    };
    const font=typography.p?.fontFamily||'Arial,"Microsoft YaHei",sans-serif';
    // The Apple body alias resolves to a system serif face on Windows. Replace
    // the captured UI stack as a unit; appending fallbacks leaves the alias first.
    const normalizeFonts=rules=>{for(const rule of rules){if(rule.cssRules)normalizeFonts(rule.cssRules);if(rule.style?.fontFamily&&/(?:ui-sans-serif|system-ui|-apple-system)/.test(rule.style.fontFamily))rule.style.fontFamily=font;}};
    for(const sheet of document.styleSheets){try{normalizeFonts(sheet.cssRules);}catch{}}
    document.body.style.fontFamily=font;
    document.body.style.fontSize=typography.p?.fontSize||'16px';
    document.body.style.background='transparent';
    const scope='#'+view.id;
    const chromeStyle=document.createElement('style');chromeStyle.textContent=scope+'{width:100%;max-width:100%;font-family:'+font+';color:#1f1f1f}'+scope+', '+scope+' *{scrollbar-width:thin;scrollbar-color:#ddd transparent}'+scope+' img{cursor:zoom-in}'+scope+' blockquote{border-left:3px solid #dedede;padding-left:18px}'+scope+' button:focus-visible,'+scope+' [tabindex]:focus-visible{outline:2px solid #5686db;outline-offset:3px}';document.head.append(chromeStyle);
    view.style.width='100%';view.style.zoom='1';
    // Computed widths/heights are measurements, not the source's layout rules.
    // Replay text and layout in normal flow while keeping diagrams and controls
    // in their captured coordinate systems. Never scale down the entire answer.
    // Old archives only retain generated CSS classes. Identify the standard
    // MathML/visual pair structurally, so KaTeX's vertical lists stay untouched.
    for(const math of view.querySelectorAll('math')){
      let root=math;
      const pair=math.parentElement?.parentElement;
      if(pair?.matches('span')&&[...pair.children].some(el=>el.getAttribute('aria-hidden')==='true'))root=pair;
      root.setAttribute('data-archive-math','');
      let display=null;
      const formulaText=root.textContent.replace(/\s/g,'');
      for(let p=root.parentElement;p&&p!==view;p=p.parentElement){
        if(p.querySelectorAll('math').length!==1||p.textContent.replace(/\s/g,'')!==formulaText)break;
        if(getComputedStyle(p).display==='block')display=p;
      }
      if(display){
        display.setAttribute('data-archive-equation','');display.style.overflowX='auto';display.style.maxWidth='100%';display.style.width='100%';
        for(let p=root.parentElement;p&&p!==display;p=p.parentElement){p.style.width='auto';p.style.maxWidth='100%';}
        root.style.display='block';root.style.width='max-content';root.style.margin='0 auto';
        const visual=[...root.children].find(el=>el.getAttribute('aria-hidden')==='true');
        if(visual){visual.style.display='inline-block';visual.style.width='max-content';visual.style.maxWidth='none';}
      }
    }
    for(const slider of view.querySelectorAll('[role=slider]')){
      let surface=slider.parentElement;
      while(surface&&surface!==view&&surface.getBoundingClientRect().width<Math.max(80,slider.getBoundingClientRect().width*3))surface=surface.parentElement;
      if(surface&&surface!==view){surface.setAttribute('data-archive-control-surface','');surface.style.width='100%';surface.style.maxWidth='100%';for(const track of surface.children)if(!track.contains(slider)){track.style.width='100%';}}
    }
    for(const group of view.querySelectorAll('[role=radiogroup]')){
      group.setAttribute('data-archive-control-surface','');group.style.width='100%';group.style.maxWidth='100%';group.style.height='auto';
      for(const item of group.children){item.style.width='auto';item.style.flexShrink='0';item.style.whiteSpace='nowrap';}
    }
    for(const button of view.querySelectorAll('button,input,select,textarea')){
      button.style.maxWidth='100%';
      if(button.getBoundingClientRect().width>160){button.style.width='100%';for(const child of button.children)if(!child.matches('svg,img')&&/^(?:block|flex|grid)$/.test(getComputedStyle(child).display)){child.style.width='100%';child.style.maxWidth='100%';}}
    }
    const elements=[...view.querySelectorAll('*')],measurements=new Map(elements.map(el=>{const s=getComputedStyle(el);return [el,{css:{display:s.display,position:s.position,paddingLeft:s.paddingLeft,paddingRight:s.paddingRight,flexDirection:s.flexDirection,flexGrow:s.flexGrow},rect:el.getBoundingClientRect()}];}));
    const protectedElement=el=>el.closest('svg,math,.katex,[data-archive-math],[data-archive-control-surface],[role=slider],[role=radio],[role=checkbox],[role=switch],button,input,select,textarea,[data-archive-pseudo]');
    for(const el of elements){
      if(protectedElement(el)||el.matches('style,script,br,hr'))continue;
      const {css,rect}=measurements.get(el);
      if(el.matches('img,video,canvas')){
        if(rect.width>0&&rect.height>0)el.style.aspectRatio=rect.width+'/'+rect.height;
        el.style.maxWidth='100%';el.style.height='auto';continue;
      }
      if(!/^(?:block|flex|grid|flow-root|list-item|table|table-row|table-cell|table-row-group|table-header-group)$/.test(css.display))continue;
      if(css.position==='absolute'||css.position==='fixed')continue;
      if(!el.childElementCount&&!el.textContent.trim())continue;
      el.style.height='auto';el.style.maxHeight='none';
      const parent=measurements.get(el.parentElement),available=parent?parent.rect.width-parseFloat(parent.css.paddingLeft)-parseFloat(parent.css.paddingRight):capturedWidth;
      if(css.display==='table'){el.style.width='100%';el.style.maxWidth='100%';}
      else if(!/^(?:table-row|table-cell|table-row-group|table-header-group)$/.test(css.display)){
        // Full-width blocks follow their parent. Narrow flex/grid children keep
        // their relative width so image rows and multi-column cards stay intact.
        if(!parent||rect.width>=Math.min(available,capturedWidth||available)-3){el.style.width='100%';el.style.maxWidth='100%';el.style.minWidth='0';}
        else if(parent&&parent.css.display==='flex'&&(parent.css.flexDirection==='column'||rect.width<160)){el.style.width='auto';el.style.maxWidth='100%';if(parent.css.flexDirection==='row'){el.style.flexShrink='0';el.style.whiteSpace='nowrap';}}
        else if(parent&&/^(?:flex|grid)$/.test(parent.css.display)&&rect.width>48&&available>0){el.style.width=(rect.width/available*100)+'%';el.style.minWidth='0';el.style.maxWidth='100%';}
        else el.style.maxWidth='100%';
      }
    }
    const card=el=>{for(let p=el.parentElement;p&&p!==view;p=p.parentElement){const s=getComputedStyle(p);if(parseFloat(s.borderRadius)>6&&(parseFloat(s.borderTopWidth)>0||s.backgroundColor!=='transparent'&&!/rgba\([^)]*,\s*0\)$/.test(s.backgroundColor)))return p;}return null;};
    const prose=[...view.querySelectorAll('p,h1,h2,h3,h4,blockquote,ul,ol,pre')].filter(el=>!protectedElement(el)&&!card(el));
    for(const parent of new Set(prose.map(el=>el.parentElement))){const css=getComputedStyle(parent);if(parent.matches('div,article,section')&&css.display==='flex'&&css.flexDirection==='column'&&parent.querySelector('p')&&parent.querySelector('h1,h2,h3,h4'))parent.style.display='block';}
    for(const el of prose){
      const tag=el.localName,style=typography[tag];
      if(style)for(const [key,value]of Object.entries(style))if(typeof value==='string')el.style[key]=value;
      if(tag==='p'&&el.closest('li,td,th')){el.style.marginTop='0';el.style.marginBottom='0';}
      if(el.matches('ul,ol'))el.style.lineHeight=typography.p?.lineHeight||'24px';
    }
    for(const el of view.querySelectorAll('p span,strong,b'))if(!protectedElement(el)&&!card(el)&&Number(getComputedStyle(el).fontWeight)>=600)el.style.fontWeight=typography.strong?.fontWeight||'600';
    if(document.documentElement.dataset.archiveRole==='user'){
      view.style.color='#1f1f1f';
      for(const el of elements){if(protectedElement(el)||el.matches('style,script'))continue;el.style.color='inherit';el.style.backgroundColor='transparent';el.style.borderRadius='0';el.style.padding='0';}
      const bubble=[...view.children].find(el=>!el.matches('style,script'));if(bubble){bubble.style.background='#f4f4f4';bubble.style.borderRadius='24px';bubble.style.padding='14px 20px';}
    }
    view.addEventListener('click',event=>{
      if(event.target.closest('button[data-archive-bound]'))return;
      const link=event.target.closest('a[href]');
      if(link&&/^https?:/.test(link.href)&&!event.target.closest('button[aria-label^="Open "]')){event.preventDefault();window.dispatchEvent(new CustomEvent('archive-link',{detail:{url:link.href}}));return;}
      let image=event.target.closest('img');const open=event.target.closest('button[aria-label^="Open "]');
      if(!image&&open){for(let parent=open.parentElement;parent&&parent!==view;parent=parent.parentElement){const images=parent.querySelectorAll('img');if(images.length===1){image=images[0];break;}if(images.length>1)break;}}
      if(!image)return;event.preventDefault();window.dispatchEvent(new CustomEvent('archive-image',{detail:{src:image.src,alt:image.alt||''}}));
    });
  }
  function install(){
    const view=document.getElementById('archive-view'),model=document.getElementById('lesson');
    const normalize=value=>String(value||'').replace(/[\s\u200b-\u200f\ufeff]+/g,' ').trim();
    const compact=value=>normalize(value).replace(/\s/g,'');
    const elementMap=new Map(),textBindings=new Map(),controls=[],graphics=[],maths=[];
    const initialNodes=new Map(),layoutMap=new Map(),templates=new Map(),mounted=new Map();
    let initialized=false,controlsInitialized=false,current=new Map(),report={mode:'captured-dom',controls:0,bound:0,unbound:[],textBindings:0,graphics:0};
    const path=node=>node.getAttribute('data-archive-node');
    const get=key=>current.get(key);
    const transparent=value=>value==='transparent'||/rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(value);
    const unpainted=node=>{const css=getComputedStyle(node);return transparent(css.backgroundColor)&&css.backgroundImage==='none'&&css.boxShadow==='none'&&!node.querySelector('[data-archive-pseudo]');};
    // Obsidian also renders hidden preview buffers. Bind only after a pane has
    // a real width; zero-size geometry cannot identify the original controls.
    let prepared=false;
    const layoutObserver=new ResizeObserver(()=>{if(!prepared&&innerWidth>0)window.__archiveCommitView?.();});layoutObserver.observe(document.documentElement);
    const fieldKey=field=>{const holder=field.closest('[data-archive-node]');if(!holder)return '';if(holder===field)return path(holder);const fields=[...holder.querySelectorAll('input,select,textarea,button')].filter(n=>n.closest('[data-archive-node]')===holder);return path(holder)+':field:'+fields.indexOf(field);};
    const sourceLabel=node=>{
      if(node.labels?.length)return normalize([...node.labels].map(label=>label.textContent).join(' '));
      const direct=node.getAttribute('aria-label');
      if(direct&&!['参数','输入','选择','Options','选项'].includes(direct))return normalize(direct);
      for(let parent=node.parentElement;parent&&parent!==model;parent=parent.parentElement){
        const labels=[...parent.querySelectorAll('label')].filter(label=>!label.querySelector('input'));
        if(labels.length===1)return normalize(labels[0].textContent);
        if(parent.querySelectorAll('input,select,textarea').length>1)break;
      }
      return '';
    };
    const targetLabel=node=>{
      const ids=(node.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean);
      if(ids.length)return normalize(ids.map(id=>document.getElementById(id)?.textContent||'').join(' '));
      if(node.labels?.length)return normalize([...node.labels].map(label=>label.textContent).join(' '));
      const direct=node.getAttribute('aria-label');if(direct&&!['Options','选项'].includes(direct))return normalize(direct);
      for(let parent=node.parentElement;parent&&parent!==view;parent=parent.parentElement){
        const labels=[...parent.querySelectorAll('label')].filter(label=>!label.contains(node));
        if(labels.length===1)return normalize(labels[0].textContent);
        if(parent.querySelectorAll('input,select,textarea,[role=slider],[role=radiogroup]').length>1)break;
      }
      return '';
    };
    const withoutIcons=node=>{
      const clone=node.cloneNode(true);for(const child of clone.querySelectorAll('svg,[data-archive-type="icon"],[data-archive-unsupported],[data-archive-pseudo]'))child.remove();return normalize(clone.textContent);
    };
    function unique(nodes){
      // Equivalent wrappers form one chain. Separate matching branches remain
      // ambiguous and are not assigned to an arbitrary component.
      const leaves=nodes.filter(node=>!nodes.some(other=>node!==other&&node.contains(other)));
      return leaves.length===1?leaves[0]:null;
    }
    function mapTextElements(){
      const index=new Map();
      for(const target of view.querySelectorAll('*')){
        if(target.closest('style,script,math,svg'))continue;
        const key=compact(target.textContent);if(!key||key.length>1400)continue;
        if(!index.has(key))index.set(key,[]);index.get(key).push(target);
      }
      const allowed=new Set(['text','caption','title','bold','italic','label','table-cell','list-item']);
      for(const source of model.querySelectorAll('[data-archive-node]')){
        if(!allowed.has(source.dataset.archiveType)||source.closest('svg,[data-archive-type="math"],[data-archive-control]'))continue;
        const key=compact(source.textContent);if(!key)continue;
        let candidates=index.get(key)||[];
        let scope=null;for(let parent=source.parentElement;parent&&parent!==model;parent=parent.parentElement){if(elementMap.has(path(parent))){scope=elementMap.get(path(parent));break;}}
        if(scope)candidates=candidates.filter(target=>scope.contains(target));
        const sameTag=candidates.filter(target=>target.localName===source.localName);
        const target=unique(sameTag.length?sameTag:candidates);
        if(target)elementMap.set(path(source),target);
      }
    }
    function sourceText(){
      const out=new Map(),walker=document.createTreeWalker(model,NodeFilter.SHOW_TEXT);
      for(let node=walker.nextNode();node;node=walker.nextNode()){
        if(!node.nodeValue.trim()||node.parentElement.closest('svg,[data-archive-type="math"],[data-archive-type="icon"],[data-archive-unsupported],button,select,textarea'))continue;
        let parent=node.parentElement;const steps=[];
        while(parent&&!parent.hasAttribute('data-archive-node')){steps.unshift([...parent.parentNode.childNodes].indexOf(parent));parent=parent.parentElement;}
        if(!parent)continue;steps.push([...node.parentNode.childNodes].indexOf(node));
        out.set(path(parent)+'#'+steps.join('.'),{node,owner:parent,value:node.nodeValue});
      }
      return out;
    }
    function mapTextNodes(){
      const claims=new Map();
      for(const [key,item] of sourceText()){
        let scope=null;
        for(let parent=item.owner;parent&&parent!==model;parent=parent.parentElement){if(elementMap.has(path(parent))){scope=elementMap.get(path(parent));break;}}
        if(!scope)continue;
        const matches=[],walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT),needle=item.value.trim();
        for(let target=walker.nextNode();target;target=walker.nextNode()){
          if(target.parentElement.closest('math,svg,style,script'))continue;
          let offset=-1;
          while((offset=target.nodeValue.indexOf(needle,offset+1))>=0)matches.push({target,start:offset,end:offset+needle.length});
        }
        if(matches.length!==1)continue;
        const match=matches[0],used=claims.get(match.target)||[];
        if(used.some(range=>match.start<range.end&&match.end>range.start))continue;
        used.push({...match,key,value:needle});claims.set(match.target,used);
      }
      for(const [target,segments] of claims)textBindings.set(target,{original:target.nodeValue,segments});
      report.textBindings=[...textBindings.values()].reduce((n,item)=>n+item.segments.length,0);
    }
    function bindNative(source,target,key){
      const fire=type=>{
        const field=get(key);if(!field)return;
        field.value=target.value;field.checked=target.checked;
        field.dispatchEvent(new Event(type,{bubbles:true}));
      };
      target.addEventListener('input',()=>fire('input'));target.addEventListener('change',()=>fire('change'));
      controls.push({key,target,restore(field){if(field.value!==target.value||(['checkbox','radio'].includes(field.type)&&field.checked!==target.checked)){fire(target.matches('select,input[type=checkbox],input[type=radio]')?'change':'input');return true;}return false;},update(field){target.value=field.value;if(['checkbox','radio'].includes(field.type))target.checked=field.checked;}});
    }
    function bindSlider(source,target,key){
      const native=target.matches('input[type=range]');if(native){bindNative(source,target,key);return;}
      const min=Number(source.min),max=Number(source.max),step=Number(source.step)||1;
      let track=target.parentElement;
      while(track&&track!==view&&track.getBoundingClientRect().width<Math.max(80,target.getBoundingClientRect().width*3))track=track.parentElement;
      if(!track||track===view){report.unbound.push({path:key,type:'slider',reason:'track-not-found'});return;}
      const vertical=target.getAttribute('aria-orientation')==='vertical';
      const thumb=target.parentElement!==track?target.parentElement:target;
      const fill=[...track.children].find(node=>!node.contains(target))?.firstElementChild||null;
      if(fill&&unpainted(fill))fill.style.backgroundColor=getComputedStyle(target).color;
      const initial=source.value,positionKey=vertical?'bottom':'left',sizeKey=vertical?'height':'width';
      const initialPosition=thumb.style.getPropertyValue(positionKey),initialSize=fill?.style.getPropertyValue(sizeKey)||'';
      target.tabIndex=0;track.style.touchAction='none';
      const change=value=>{
        const field=get(key);if(!field)return;
        field.value=String(Math.max(min,Math.min(max,min+Math.round((value-min)/step)*step)));
        field.dispatchEvent(new Event('input',{bubbles:true}));
      };
      const point=event=>{const rect=track.getBoundingClientRect();const fraction=vertical?1-(event.clientY-rect.top)/rect.height:(event.clientX-rect.left)/rect.width;change(min+fraction*(max-min));};
      let dragging=false;
      track.addEventListener('pointerdown',event=>{if(event.button!==0)return;dragging=true;target.focus();point(event);track.setPointerCapture?.(event.pointerId);event.preventDefault();});
      track.addEventListener('pointermove',event=>{if(dragging)point(event);});
      track.addEventListener('pointerup',()=>{dragging=false;});track.addEventListener('pointercancel',()=>{dragging=false;});
      target.addEventListener('keydown',event=>{
        const field=get(key);if(!field)return;let value=Number(field.value);
        if(['ArrowRight','ArrowUp'].includes(event.key))value+=step;
        else if(['ArrowLeft','ArrowDown'].includes(event.key))value-=step;
        else if(event.key==='Home')value=min;else if(event.key==='End')value=max;else return;
        event.preventDefault();change(value);
      });
      controls.push({key,target,restore(field){const value=target.getAttribute('aria-valuenow');if(value!==null&&Number(value)!==Number(field.value)){change(Number(value));return true;}return false;},update(field){
        const ratio=(Number(field.value)-min)/(max-min||1);
        target.setAttribute('aria-valuemin',String(min));target.setAttribute('aria-valuemax',String(max));target.setAttribute('aria-valuenow',field.value);
        thumb.style[positionKey]=100*ratio+'%';if(fill)fill.style[sizeKey]=100*ratio+'%';
      }});
    }
    function bindControls(){
      const used=new Set(),radioTemplates=new Map(),segmentStyles=new Map();
      const targets=[...view.querySelectorAll('input,select,textarea,button,[role=slider],[role=checkbox],[role=switch],[role=radio],[role=combobox]')];
      const fields=[...model.querySelectorAll('input,select,textarea,button')];
      report.controls=fields.length;
      for(const source of fields){
        const holder=source.closest('[data-archive-node]'),key=fieldKey(source);
        let candidates=[],kind=source.localName;
        if(source.matches('input[type=range]')){
          kind='slider';const label=sourceLabel(source);
          candidates=targets.filter(target=>!used.has(target)&&target.matches('input[type=range],[role=slider]')&&label&&targetLabel(target)===label);
          if(candidates.length!==1){const allSource=fields.filter(n=>n.matches('input[type=range]')),allTarget=targets.filter(n=>n.matches('input[type=range],[role=slider]'));if(allSource.length===1&&allTarget.length===1)candidates=allTarget;}
        }else if(source.matches('input[type=radio]')){
          kind='radio';const label=withoutIcons(source.closest('label')||holder);
          candidates=targets.filter(target=>!used.has(target)&&target.matches('input[type=radio],[role=radio]')&&withoutIcons(target.closest('label')||target)===label);
        }else if(source.matches('input[type=checkbox]')){
          kind='checkbox';const label=sourceLabel(source)||withoutIcons(holder);
          candidates=targets.filter(target=>!used.has(target)&&target.matches('input[type=checkbox],[role=checkbox],[role=switch]')&&(targetLabel(target)||withoutIcons(target.closest('label')||target))===label);
        }else if(source.matches('select')){
          kind='select';const label=sourceLabel(source);
          candidates=targets.filter(target=>!used.has(target)&&target.matches('select,[role=combobox]')&&label&&targetLabel(target)===label);
          if(candidates.length!==1){const allSource=fields.filter(n=>n.matches('select')),allTarget=targets.filter(n=>n.matches('select,[role=combobox]'));if(allSource.length===1&&allTarget.length===1)candidates=allTarget;}
        }else if(source.matches('button')&&holder.dataset.archiveType==='segmented-control'){
          kind='segmented';const label=withoutIcons(source);
          candidates=targets.filter(target=>!used.has(target)&&target.matches('button')&&withoutIcons(target.closest('label')||target)===label);
        }else if(source.matches('button')){
          kind='button';const label=withoutIcons(source);
          candidates=targets.filter(target=>!used.has(target)&&target.matches('button')&&!['radio','checkbox','combobox'].includes(target.getAttribute('role'))&&withoutIcons(target)===label);
        }else{
          const label=sourceLabel(source);candidates=targets.filter(target=>!used.has(target)&&target.localName===source.localName&&label&&targetLabel(target)===label);
        }
        if(candidates.length!==1){report.unbound.push({path:key,type:kind,reason:'ambiguous-or-missing-control'});continue;}
        const target=candidates[0];used.add(target);target.dataset.archiveBound=key;
        if(kind==='slider')bindSlider(source,target,key);
        else if(kind==='radio'&&!target.matches('input')){
          const group=target.closest('[role=radiogroup]')||target.parentElement;
          const indicators=()=>[...target.children].filter(node=>!node.hasAttribute('data-archive-pseudo')&&!withoutIcons(node));
          if(source.checked&&indicators().length){
            const indicator=indicators()[0];
            if(unpainted(indicator)&&!indicator.textContent.trim()&&!indicator.firstElementChild){const dot=document.createElement('span');dot.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:currentColor';indicator.append(dot);}
            radioTemplates.set(group,indicator.cloneNode(true));
          }
          target.addEventListener('click',()=>{const field=get(key);if(field){field.checked=true;field.dispatchEvent(new Event('change',{bubbles:true}));}});
          controls.push({key,target,restore(field){if(target.getAttribute('aria-checked')==='true'&&!field.checked){field.checked=true;field.dispatchEvent(new Event('change',{bubbles:true}));return true;}return false;},update(field){
            target.setAttribute('aria-checked',String(field.checked));
            const template=radioTemplates.get(group);
            if(template){if(field.checked&&!indicators().length)target.append(template.cloneNode(true));if(!field.checked)for(const node of indicators())node.remove();}
          }});
        }else if(kind==='checkbox'&&!target.matches('input')){
          const indicators=()=>[...target.children].filter(node=>!node.hasAttribute('data-archive-pseudo')&&!withoutIcons(node));
          const checkedChildren=indicators().map(n=>n.cloneNode(true));
          if(!checkedChildren.length){const tick=document.createElement('span');tick.textContent='✓';tick.setAttribute('aria-hidden','true');tick.style.cssText='display:block;line-height:1;pointer-events:none';checkedChildren.push(tick);}
          target.addEventListener('click',()=>{const field=get(key);if(field){field.checked=!field.checked;field.dispatchEvent(new Event('change',{bubbles:true}));}});
          controls.push({key,target,restore(field){const value=target.getAttribute('aria-checked');if(value!==null&&(value==='true')!==field.checked){field.checked=value==='true';field.dispatchEvent(new Event('change',{bubbles:true}));return true;}return false;},update(field){target.setAttribute('aria-checked',String(field.checked));if(checkedChildren.length){if(field.checked&&!indicators().length)target.append(...checkedChildren.map(n=>n.cloneNode(true)));else if(!field.checked)for(const node of indicators())node.remove();}}});
        }else if(kind==='select'&&!target.matches('select')){
          const overlay=document.createElement('select');for(const option of source.options)overlay.append(option.cloneNode(true));overlay.value=source.value;
          const label=source.selectedOptions[0]?.textContent||'',walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT),leaves=[];
          for(let node=walker.nextNode();node;node=walker.nextNode())if(normalize(node.nodeValue)===normalize(label))leaves.push(node);
          const caption=leaves.length===1?leaves[0]:null;
          if(getComputedStyle(target).position==='static')target.style.position='relative';
          overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer';overlay.setAttribute('aria-label',sourceLabel(source)||'选择');target.append(overlay);
          bindNative(source,overlay,key);
          controls.push({key,target,auxiliary:true,update(field){if(caption)caption.nodeValue=field.selectedOptions[0]?.textContent||'';overlay.disabled=field.disabled;}});
        }else if(kind==='segmented'){
          const group=path(holder),selected=source.getAttribute('aria-pressed')==='true';
          if(!segmentStyles.has(group))segmentStyles.set(group,{});
          const css=getComputedStyle(target),paint={};for(const name of ['background-color','color','border-color','box-shadow','font-weight'])paint[name]=css.getPropertyValue(name);
          segmentStyles.get(group)[selected?'selected':'plain']=paint;
          target.addEventListener('click',()=>get(key)?.click());
          let previous=selected;
          controls.push({key,target,restore(field){if((target.getAttribute('aria-pressed')==='true'||target.getAttribute('aria-checked')==='true')&&field.getAttribute('aria-pressed')!=='true'){field.click();return true;}return false;},update(field){const selected=field.getAttribute('aria-pressed')==='true';target.setAttribute('aria-pressed',String(selected));if(target.getAttribute('role')==='radio')target.setAttribute('aria-checked',String(selected));if(selected!==previous){const paint=segmentStyles.get(group)[selected?'selected':'plain'];if(paint)for(const [name,value] of Object.entries(paint))target.style.setProperty(name,value);previous=selected;}}});
        }else if(kind==='button'){
          if(unpainted(target)){const color=getComputedStyle(target).color,background=getComputedStyle(view).color;if(/rgb\(\s*25[0-5]\s*,\s*25[0-5]\s*,\s*25[0-5]\s*\)/.test(color))target.style.backgroundColor=background;}
          target.addEventListener('click',event=>{event.preventDefault();get(key)?.click();});
          controls.push({key,target,update(field){target.disabled=field.disabled;}});
        }else bindNative(source,target,key);
      }
      report.bound=controls.filter(control=>!control.auxiliary).length;
    }
    function svgSignature(svg){return JSON.stringify([svg.getAttribute('viewBox')||'', [...svg.querySelectorAll('*')].map(n=>n.localName).join(','),compact(svg.textContent)]);}
    function mapGraphics(){
      const targets=[...view.querySelectorAll('svg')].map(element=>({element,svg:element}));
      for(const image of view.querySelectorAll('img')){
        if(!/^data:image\/svg\+xml[;,]/.test(image.src))continue;
        try{const at=image.src.indexOf(','),header=image.src.slice(0,at),payload=image.src.slice(at+1);const raw=header.includes('base64')?new TextDecoder().decode(Uint8Array.from(atob(payload),c=>c.charCodeAt(0))):decodeURIComponent(payload);const svg=new DOMParser().parseFromString(raw,'image/svg+xml').documentElement;if(svg.localName==='svg')targets.push({element:image,svg});}catch{}
      }
      for(const source of model.querySelectorAll('svg[data-archive-node]')){
        if(source.parentElement.closest('svg'))continue;
        const matches=targets.filter(target=>svgSignature(target.svg)===svgSignature(source));
        if(matches.length===1)graphics.push({key:path(source),target:matches[0].element,original:matches[0].svg.cloneNode(true),baseline:source.cloneNode(true),last:source.outerHTML});
      }
      report.graphics=graphics.length;
    }
    function mapMath(){
      const annotations=[...view.querySelectorAll('annotation[encoding="application/x-tex"]')];
      for(const source of model.querySelectorAll('[data-archive-type="math"]')){
        const matches=annotations.filter(node=>compact(node.textContent)===compact(source.dataset.tex));
        if(matches.length!==1)continue;
        let target=matches[0].closest('math');
        while(target.parentElement&&target.parentElement!==view&&target.parentElement.querySelectorAll('math').length===1){target=target.parentElement;if(target.children.length>1)break;}
        maths.push({key:path(source),target,last:source.dataset.tex});
      }
    }
    function patchSvg(target,next,before){
      const attrs=new Set([...before.attributes,...next.attributes].map(a=>a.name));
      for(const name of attrs){if(name.startsWith('data-archive')||name==='class')continue;const value=next.getAttribute(name);if(value!==before.getAttribute(name)){if(value===null)target.removeAttribute(name);else target.setAttribute(name,value);}}
      if(next.childNodes.length!==before.childNodes.length||[...next.childNodes].some((n,i)=>n.nodeName!==before.childNodes[i].nodeName)){
        target.replaceChildren(...[...next.childNodes].map(n=>n.cloneNode(true)));return;
      }
      [...next.childNodes].forEach((node,i)=>{
        if(node.nodeType===Node.TEXT_NODE){if(node.nodeValue!==before.childNodes[i].nodeValue)target.childNodes[i].nodeValue=node.nodeValue;}
        else if(node.nodeType===Node.ELEMENT_NODE)patchSvg(target.childNodes[i],node,before.childNodes[i]);
      });
    }
    function commonAncestor(nodes){let parent=nodes[0];while(parent&&nodes.some(node=>!parent.contains(node)))parent=parent.parentElement;return parent;}
    function knownTarget(key){
      if(elementMap.has(key))return elementMap.get(key);
      if(layoutMap.has(key))return layoutMap.get(key);
      if(mounted.has(key))return mounted.get(key).element;
      const control=controls.find(item=>item.key.split(':field:')[0]===key);if(control)return control.target;
      const graphic=graphics.find(item=>item.key===key);if(graphic)return graphic.target;
      return maths.find(item=>item.key===key)?.target||null;
    }
    function recordLayout(){
      const sources=[...model.querySelectorAll('[data-archive-node]')];
      for(const source of sources){initialNodes.set(path(source),source.dataset.archiveType);const target=knownTarget(path(source));if(target&&!templates.has(source.dataset.archiveType)&&!['math','svg'].includes(source.dataset.archiveType))templates.set(source.dataset.archiveType,target);}
      for(const source of [...sources].reverse()){
        if(!['box','row','col','grid','list','list-item','table','table-row','radio-group'].includes(source.dataset.archiveType))continue;
        const anchors=[...source.querySelectorAll('[data-archive-node]')].map(node=>knownTarget(path(node))).filter(Boolean);
        if(anchors.length){const parent=commonAncestor(anchors);if(parent)layoutMap.set(path(source),anchors.length===1?parent.parentElement:parent);}
      }
      const anchors=[...elementMap.values(),...controls.map(item=>item.target),...graphics.map(item=>item.target)];
      layoutMap.set('$root',anchors.length===1?anchors[0].parentElement:anchors.length?commonAncestor(anchors):view);
    }
    function dynamicClone(source){
      const clone=source.cloneNode(true),sources=[source,...source.querySelectorAll('[data-archive-node]')],copies=[clone,...clone.querySelectorAll('[data-archive-node]')];
      sources.forEach((node,index)=>{
        const target=copies[index],template=templates.get(node.dataset.archiveType);
        if(template&&!target.closest('svg')&&node.dataset.archiveType!=='math'){
          if(node.matches('input,select,textarea')&&node.localName!==template.localName)return;
          target.className=template.className;
          for(const property of ['background-color','color','box-shadow'])if(!node.style.getPropertyValue(property)&&template.style.getPropertyValue(property))target.style.setProperty(property,template.style.getPropertyValue(property));
          if(!node.style.height&&!node.matches('button,input,select,textarea'))target.style.height='auto';if(!node.style.width)target.style.width='auto';
        }
      });
      clone.dataset.archiveDynamicRoot=path(source);
      for(const type of ['input','change','click'])clone.addEventListener(type,event=>{
        const field=event.target.closest('input,select,textarea,button');if(!field)return;
        const original=get(fieldKey(field));if(!original)return;
        if(type==='click'){if(field.matches('button'))original.click();return;}
        original.value=field.value;original.checked=field.checked;original.dispatchEvent(new Event(type,{bubbles:true}));
      });
      return clone;
    }
    function updateDynamic(){
      const sources=[...model.querySelectorAll('[data-archive-node]')],newNodes=sources.filter(node=>!initialNodes.has(path(node)));
      const newSet=new Set(newNodes);
      for(const [key,item] of mounted){if(!current.has(key)){item.element.remove();mounted.delete(key);}}
      for(const source of newNodes){
        if(newSet.has(source.parentElement))continue;
        const key=path(source),existing=mounted.get(key);
        if(existing){if(existing.html!==source.outerHTML){const next=dynamicClone(source);existing.element.replaceWith(next);mounted.set(key,{element:next,html:source.outerHTML});}continue;}
        let parent=source.parentElement;while(parent&&parent!==model&&!parent.hasAttribute('data-archive-node'))parent=parent.parentElement;
        const container=parent===model?layoutMap.get('$root'):layoutMap.get(path(parent));if(!container)continue;
        const clone=dynamicClone(source);
        let next=source.nextElementSibling,nextTarget=null;
        while(next&&!nextTarget){nextTarget=knownTarget(path(next));next=next.nextElementSibling;}
        if(nextTarget&&container.contains(nextTarget)){while(nextTarget.parentElement!==container)nextTarget=nextTarget.parentElement;container.insertBefore(clone,nextTarget);}
        else container.append(clone);
        for(let node=container;node&&node!==view;node=node.parentElement)node.style.height='auto';
        mounted.set(key,{element:clone,html:source.outerHTML});
      }
    }
    function update(){
      for(const item of controls){const source=get(item.key);if(source)item.update(source);}
      const values=sourceText();
      for(const [target,item] of textBindings){
        let value=item.original;
        for(const part of [...item.segments].sort((a,b)=>b.start-a.start)){const current=values.get(part.key);if(current)value=value.slice(0,part.start)+current.value.trim()+value.slice(part.end);}
        if(target.nodeValue!==value){target.nodeValue=value;for(let parent=target.parentElement;parent&&parent!==view;parent=parent.parentElement){parent.style.height='auto';if(parent.matches('p,td,th,li'))break;}}
      }
      for(const item of graphics){const source=get(item.key);if(!source||source.outerHTML===item.last)continue;
        const svg=item.original.cloneNode(true);patchSvg(svg,source,item.baseline);
        if(item.target.matches('img')){const bytes=new TextEncoder().encode(new XMLSerializer().serializeToString(svg));let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));item.target.src='data:image/svg+xml;base64,'+btoa(raw);}
        else {const attrs=[...svg.attributes];for(const attr of attrs)if(attr.name!=='class')item.target.setAttribute(attr.name,attr.value);item.target.replaceChildren(...[...svg.childNodes].map(n=>n.cloneNode(true)));}
        item.last=source.outerHTML;
      }
      for(const item of maths){const source=get(item.key);if(!source||source.dataset.tex===item.last)continue;
        if(window.katex){item.target.style.height='auto';item.target.style.width='auto';item.target.style.fontSize='inherit';window.katex.render(source.dataset.tex,item.target,{displayMode:source.dataset.displayMath==='true',throwOnError:false,trust:false});item.last=source.dataset.tex;}
      }
      updateDynamic();
    }
    window.__archiveCommitView=()=>{
      if(!model.hasChildNodes())return;
      current=new Map([...model.querySelectorAll('[data-archive-node]')].map(node=>[path(node),node]));
      // Native radio inputs are children of their component's labelled node.
      for(const field of model.querySelectorAll('input,select,textarea,button'))current.set(fieldKey(field),field);
      if(!prepared){if(innerWidth<1)return;window.__archivePrepareView?.(view,archiveOptions.capturedWidth);prepared=true;layoutObserver.disconnect();}
      if(!controlsInitialized){bindControls();controlsInitialized=true;let restored=false;for(const control of controls){const field=get(control.key);if(field&&control.restore?.(field))restored=true;}if(restored)return;}
      if(!initialized){mapTextElements();mapTextNodes();mapGraphics();mapMath();recordLayout();initialized=true;window.dispatchEvent(new CustomEvent('archive-bindings',{detail:report}));}
      update();
    };
    window.__archiveGetBindings=()=>JSON.parse(JSON.stringify(report));
  }
  const api={install,prepareView};global.ChatgptSnapshotBindings=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
