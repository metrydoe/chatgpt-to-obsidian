/* Capture a complete message. Executable sources keep their message identity;
   rendered DOM is evidence, not a source of fabricated event handlers. */
'use strict';
globalThis.captureArchiveMessage=async function(owner,body,options){
  const warnings=options.warnings,missing=options.missingAssets;
  const styles=[],styleIds=new Map(),resources=[],frames=[];
  let count=0,cssBytes=0;
  const maxNodes=30000;
  const properties=('display position box-sizing float clear width height min-width min-height max-width max-height '+
    'margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left '+
    'font-family font-size font-style font-weight font-variant line-height letter-spacing word-spacing color background-color '+
    'text-align text-decoration text-transform text-indent white-space overflow-wrap word-break vertical-align '+
    'flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self align-content justify-content order gap row-gap column-gap '+
    'grid-template-columns grid-template-rows grid-column grid-row grid-auto-flow '+
    'border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style '+
    'border-top-color border-right-color border-bottom-color border-left-color border-radius border-collapse border-spacing '+
    'opacity overflow overflow-x overflow-y top right bottom left transform transform-origin box-shadow '+
    'object-fit object-position fill stroke stroke-width stroke-linecap stroke-linejoin visibility cursor list-style-type '+
    'table-layout caption-side direction writing-mode z-index isolation pointer-events user-select clip clip-path '+
    'outline-width outline-style outline-color outline-offset appearance accent-color background-size background-position background-repeat background-origin background-clip '+
    'scrollbar-width scrollbar-color scrollbar-gutter').split(/\s+/);
  const attributes=new Set(('id title alt colspan rowspan start reversed open viewBox d x y x1 x2 y1 y2 cx cy r rx ry points '+
    'width height fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset '+
    'opacity fill-opacity stroke-opacity transform xmlns role aria-label aria-hidden aria-labelledby aria-describedby '+
    'preserveAspectRatio gradientUnits gradientTransform offset stop-color stop-opacity text-anchor dominant-baseline '+
    'clip-path mask patternUnits marker-start marker-mid marker-end mathvariant display encoding').split(' '));
  const escaped=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function styleOf(node,pseudo=null){
    const css=getComputedStyle(node,pseudo),result={};
    for(const key of properties){const value=css.getPropertyValue(key);if(value&&!/url\(|expression|@import/i.test(value))result[key]=value;}
    // Ancestor offsets and viewport clipping are application UI, while the
    // message's own layout is kept. Children retain their computed dimensions.
    if(!pseudo&&(node===owner||node===body)){delete result.height;delete result['max-height'];result.position='relative';result.top='auto';result.left='auto';result.transform='none';result.width='100%';result['max-width']='100%';result.overflow='visible';}
    return result;
  }
  function classFor(node,pseudo=null){
    const values=styleOf(node,pseudo),classes=[];
    // Reuse groups of declarations across distinct combinations of computed
    // styles. Fixed property groups retain the original declaration order.
    for(let group=0;group<Math.ceil(properties.length/10);group++){
      const text=properties.slice(group*10,group*10+10).filter(k=>values[k]!==undefined).map(k=>k+':'+values[k]).join(';');
      if(!text)continue;
      const key=group+'|'+text;let id=styleIds.get(key);
      if(id===undefined){id=styleIds.size;styleIds.set(key,id);const rule='.s'+id+'{'+text+'}';(styles[group]||(styles[group]=[])).push(rule);cssBytes+=rule.length;if(cssBytes>4_000_000)throw Error('消息样式超过上限，本次未截断保存');}
      classes.push('s'+id);
    }
    return classes.join(' ');
  }
  const renderedElements=[];
  const excluded=node=>node.matches('script,style,link,base,meta,noscript,nav,[data-testid="copy-turn-action-button"],[data-testid="good-response-turn-action-button"],[data-testid="bad-response-turn-action-button"]');
  const mediaData=async node=>{
    const ref=await options.image(node);
    if(ref){resources.push(ref.asset);return 'archive-resource:'+ref.asset;}
    return '';
  };
  async function pseudo(node,kind){
    const css=getComputedStyle(node,kind),content=css.content;
    if(!content||content==='none'||content==='normal')return '';
    let text='';
    if(/^(['"])[\s\S]*\1$/.test(content))text=content.slice(1,-1).replace(/\\([0-9a-fA-F]{1,6})\s?/g,(_,hex)=>String.fromCodePoint(parseInt(hex,16))).replace(/\\(.)/g,'$1');
    else {missing.push({kind:'pseudo-content',message_id:options.id,reason:'未能读取生成内容：'+content.slice(0,100)});}
    const background=css.backgroundImage&&css.backgroundImage!=='none'?' style="'+escaped(await options.packer.css('background-image:'+css.backgroundImage,location.href))+'"':'';
    return '<span data-archive-pseudo="'+kind.slice(2)+'" aria-hidden="true" class="'+classFor(node,kind)+'"'+background+'>'+escaped(text)+'</span>';
  }
  async function serialize(node,depth=0){
    if(++count>maxNodes||depth>160)throw Error('消息结构超过上限，本次未截断保存');
    if(node.nodeType===Node.TEXT_NODE)return escaped(node.textContent);
    if(node.nodeType!==Node.ELEMENT_NODE||excluded(node)||node.hidden||getComputedStyle(node).display==='none')return '';
    const tag=node.localName;
    if(tag==='iframe'){
      try{let raw=node.getAttribute('srcdoc');const base=new URL(node.getAttribute('src')||location.href,location.href).href;if(raw===null)raw=await options.packer.text(base,location.href);if(raw!==null){const index=frames.length;const packed=await options.packer.html(raw,base);frames.push({id:options.id+'-frame-'+index,kind:'html',html:packed,originalHtml:raw,provenance:'iframe-source',runtimeVerified:false});return '<div class="'+classFor(node)+'" data-archive-frame="'+index+'"></div>';}}
      catch(error){warnings.push('框架源码读取失败：'+error.message);}
      missing.push({kind:'iframe',message_id:options.id,reason:'跨域或远程框架未取得独立源码'});
      return '<p>此框架未取得可离线运行的源码。</p>';
    }
    if(tag==='canvas'){
      try{return '<img class="'+classFor(node)+'" alt="画布归档画面" src="'+node.toDataURL('image/png')+'">';}
      catch(error){missing.push({kind:'canvas',reason:error.message});return '<p>画布画面未取得。</p>';}
    }
    if(!/^[a-zA-Z][\w-]*$/.test(tag))return '';
    renderedElements.push(node);
    let attrs=' class="'+classFor(node)+'"';
    const backgroundImage=getComputedStyle(node).backgroundImage;
    if(backgroundImage&&backgroundImage!=='none')attrs+=' style="'+escaped(await options.packer.css('background-image:'+backgroundImage,location.href))+'"';
    for(const attr of node.attributes){
      if((attributes.has(attr.name)||attr.name.startsWith('aria-')||['data-d-component','data-state','data-orientation'].includes(attr.name))&&!/^on/i.test(attr.name)&&!/(?:javascript:|url\(\s*['"]?(?!#))/i.test(attr.value))attrs+=' '+attr.name+'="'+escaped(attr.value)+'"';
    }
    if(tag==='a'){
      try{const url=new URL(node.getAttribute('href'),location.href);if(['https:','http:'].includes(url.protocol))attrs+=' href="'+escaped(url.href)+'" target="_blank" rel="noreferrer"';}catch{}
    }
    if(tag==='img'){
      const src=await mediaData(node);return src?'<img'+attrs+' src="'+escaped(src)+'">':'<span'+attrs+'>图片未保存：'+escaped(node.alt||'未命名')+'</span>';
    }
    if(tag==='image'){
      const value=node.getAttribute('href')||node.getAttribute('xlink:href');
      if(value)attrs+=' href="'+escaped(await options.packer.resource(value,location.href,'svg-image'))+'"';
    }
    if(['audio','video','source'].includes(tag)){
      const value=node.currentSrc||node.getAttribute('src');if(value)attrs+=' src="'+escaped(await options.packer.resource(value,location.href,tag))+'"';
      if(node.controls)attrs+=' controls';
    }
    if(tag==='input'){
      const type=node.type;
      if(['password','file','hidden'].includes(type))return '';
      attrs+=' type="'+escaped(type)+'" value="'+escaped(node.value)+'"'+(node.checked?' checked':'');
      for(const key of ['min','max','step','name'])if(node.hasAttribute(key))attrs+=' '+key+'="'+escaped(node.getAttribute(key))+'"';
    }
    if(tag==='option'&&node.selected)attrs+=' selected';
    if(tag==='details'&&node.open&&!node.hasAttribute('open'))attrs+=' open';
    let children='';
    if(tag==='textarea')children=escaped(node.value);else {children=await pseudo(node,'::before');for(const child of node.childNodes)children+=await serialize(child,depth+1);children+=await pseudo(node,'::after');}
    if(['img','input','br','hr','source','wbr','area','col','embed','param','track'].includes(tag))return '<'+tag+attrs+'>';
    return '<'+tag+attrs+'>'+children+'</'+tag+'>';
  }
  // The message owner includes galleries that can be siblings of its body.
  const html=await serialize(owner);
  const usedFamilies=new Set(renderedElements.flatMap(node=>getComputedStyle(node).fontFamily.split(',').map(value=>value.trim().replace(/^['"]|['"]$/g,''))));
  const fontRules=[],knownFonts=new Set();
  const scanFonts=async rules=>{
    for(const rule of rules){
      if(rule.type===5){const family=rule.style.fontFamily.replace(/^['"]|['"]$/g,'');if(usedFamilies.has(family)&&!/^KaTeX_/.test(family)){fontRules.push(await options.packer.css(rule.cssText,rule.parentStyleSheet?.href||location.href));knownFonts.add(family);}}
      else if(rule.cssRules)await scanFonts(rule.cssRules);
    }
  };
  for(const sheet of document.styleSheets){try{await scanFonts(sheet.cssRules);}catch{}}
  for(const face of document.fonts){const family=face.family.replace(/^['"]|['"]$/g,'');if(face.status==='loaded'&&usedFamilies.has(family)&&!knownFonts.has(family)&&!/^KaTeX_/.test(family)){
    missing.push({kind:'font',title:family,reason:'已使用的网页字体无法读取源地址，将使用本地替代字体'});
  }}
  const componentNodes=renderedElements.filter(n=>n.hasAttribute('data-d-component'));
  const normalize=type=>String(type).toLowerCase().replace(/[-_\s]/g,'');
  const programs=options.programs.map((pkg,index)=>{
    const nodes=pkg.inspection?.nodes||[],byType={},byPath={};
    for(const node of componentNodes){const type=node.getAttribute('data-d-component');const style=styleOf(node);if(!byType[type])byType[type]=style;else for(const key of Object.keys(byType[type]))if(byType[type][key]!==style[key])delete byType[type][key];}
    const sourceNodes=nodes.filter(n=>!['__chatgptClientDefinedWidget'].includes(n.type));
    // Per-node appearance is applied only after exact structural agreement.
    // A mismatch keeps type-wide common styles and the complete page snapshot.
    const exact=sourceNodes.length===componentNodes.length&&sourceNodes.every((n,i)=>normalize(n.type)===normalize(componentNodes[i].getAttribute('data-d-component')));
    if(exact)sourceNodes.forEach((n,i)=>{byPath[n.path]=styleOf(componentNodes[i]);});
    const controls=[];
    if(exact)sourceNodes.forEach((n,i)=>{const dom=componentNodes[i];const field=dom.matches('input,select,textarea')?dom:dom.querySelector('input,select,textarea');if(n.control&&field&&!['password','file','hidden'].includes(field.type))controls.push({path:n.path,value:field.value,checked:!!field.checked});});
    const appearance={byType,byPath,fontCss:fontRules.join('\n')};
    if(!exact)warnings.push('第 '+options.id+' 条消息的程序使用兼容渲染；原页面样式快照已另存，未声称视觉一致。');
    return {id:pkg.id+'-program-'+index,kind:'dil',code:pkg.code,constants:pkg.constants,fallback:pkg.fallback||'',
      appearance,controls,provenance:pkg.provenance||'message-owned-source',runtimeVerified:!!pkg.runtimeVerified,
      inspection:pkg.inspection||null,runtimeError:pkg.runtimeError||null,
      fidelity:{runtime:'compatibility',appearance:exact?'structurally-matched':'type-common-only',state:exact?'mapped-form-controls':'initial-program-state'}};
  });
  const css=getComputedStyle(owner),rect=body.getBoundingClientRect();
  let background='white';
  for(let node=owner;node;node=node.parentElement){const value=getComputedStyle(node).backgroundColor;if(value!=='transparent'&&value!=='rgba(0, 0, 0, 0)'){background=value;break;}}
  const unsupported=programs.flatMap(p=>p.inspection?.unsupported||[]);
  for(const item of unsupported)missing.push({kind:'program-component',message_id:options.id,type:item.type,path:item.path,reason:'兼容运行时未实现此组件行为'});
  for(const program of programs)if(!program.runtimeVerified)missing.push({kind:'program-runtime',message_id:options.id,reason:program.runtimeError||'程序未完成运行验证'});
  return {id:options.id,role:options.role,snapshot:{html:'<style>'+fontRules.join('\n')+styles.flat().join('\n')+'</style>'+html,width:Math.round(rect.width),height:Math.round(rect.height),color:css.color,background},
    programs:[...programs,...frames],resources:[...new Set(resources)],capture:{nodes:count,formState:programs.some(p=>p.controls.length)?'mapped':'snapshot-only',runtime:'compatibility',visualVerified:false}};
};
