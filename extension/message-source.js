/* MAIN world. Read serializable data belonging to visible message owners only.
   Do not inspect account stores, conversation history, fetch or cookies. */
globalThis.readObsidianMessageSources=function(){
 const records=[],byCode=new Map(),diagnostic={version:3,nodes:0,fibers:0,programs:0,texts:0,errors:[],owners:[],boundShapes:[],ambiguous:0};
 globalThis.obsidianMessageSourceDiagnostic=diagnostic;
 const blocked=new Set(['allMessages','conversation','conversations','store','stores','client','queryClient','cache','_owner','ref','stateNode','return','child','sibling','appData','modelDataBindings','searchResultSources','sidebarSourceReferences']);
 const ownedKeys=new Set(['message','item','savedContentResponse','model_dil_v2','dilProgram']);
 const descriptors=o=>Object.entries(Object.getOwnPropertyDescriptors(o)).filter(([,d])=>'value'in d).slice(0,120);
 const normalize=s=>String(s||'').replace(/[#*_`\s\\]/g,'');
 const nodes=[...document.querySelectorAll('[data-message-author-role],[data-markdown-text-style],.markdown,.prose,[data-d-component="slider"],[data-d-component="select"],[data-d-component="segmented-control"]')];
 for(const el of nodes){
  if(el.closest('[hidden],[aria-hidden="true"]')||getComputedStyle(el).display==='none')continue;
  diagnostic.nodes++;
  const owner=el.closest('[data-message-id],[data-chatgpt-selection-message-id],[data-message-author-role],[data-markdown-text-style]')||el;
  const identityOwner=el.closest('[data-message-id],[data-chatgpt-selection-message-id]');
  const messageId=identityOwner?.getAttribute('data-message-id')||identityOwner?.getAttribute('data-chatgpt-selection-message-id');
  const body=owner.matches('[data-markdown-text-style],.markdown,.prose')?owner:owner.querySelector('[data-markdown-text-style],.markdown,.prose')||owner;
  const visible=normalize(body.innerText||body.textContent);const candidates=[];let visited=0;
  const scan=(value,seen,depth=0,path='props',owned=false,boundId=null)=>{
   if(!value||typeof value!=='object'||value instanceof Node||seen.has(value)||depth>11||++visited>1600)return;
   seen.add(value);
   if(Array.isArray(value)){if(owned)for(const [i,item] of value.slice(0,160).entries())scan(item,seen,depth+1,path+'.'+i,true,boundId);return;}
   const ownId=typeof value.messageId==='string'?value.messageId:value.id;const isMessage=(value.content||value.contentReferences)&&typeof ownId==='string';
   if(isMessage&&messageId&&ownId!==messageId)return;
   const id=typeof value.messageId==='string'?value.messageId:isMessage?ownId:boundId;
   const fallback=value.fallbackMarkdown??value.fallback;
   if(typeof value.code==='string'&&value.code.includes('DIL.render(')&&value.constants&&typeof fallback==='string'){
    candidates.push({id,code:value.code,constants:value.constants,fallback,foundAt:path,score:id&&id===messageId?100:owned&&!id?80:0});return;
   }
   if(isMessage&&value.content?.content_type==='text'&&Array.isArray(value.content.parts)&&value.content.parts.every(x=>typeof x==='string'))candidates.push({id,markdown:value.content.parts.join('\n\n'),foundAt:path+'.content',score:id===messageId?100:0});
   if(owned&&diagnostic.boundShapes.length<40&&depth<5)diagnostic.boundShapes.push({node:diagnostic.nodes,path,keys:descriptors(value).map(([key])=>key).slice(0,30)});
   for(const [key,desc] of descriptors(value)){
    if(blocked.has(key)||key==='children'||key==='constants'||(!owned&&key==='messages'))continue;
    const nextOwned=owned||ownedKeys.has(key);
    if(Array.isArray(desc.value)&&!nextOwned)continue;
    // Only explicit message envelopes may carry nested arrays. General owner
    // props still use shallow object discovery for wrappers/providers.
    if(!owned&&depth>4&&!ownedKeys.has(key))continue;
    let child=desc.value;
    if(nextOwned&&typeof child==='string'&&child.length<4_000_000&&/^[\s]*[\[{]/.test(child)){
     try{child=JSON.parse(child);}catch{}
    }
    scan(child,seen,depth+1,path+'.'+key,nextOwned,id);
   }
  };
  try{
   const keys=Object.getOwnPropertyNames(el);let fiber=el[keys.find(k=>k.startsWith('__reactFiber$'))];
   for(let level=0;fiber&&level<64;level++,fiber=fiber.return){
    diagnostic.fibers++;
    if(diagnostic.owners.length<70&&level<22)diagnostic.owners.push({node:diagnostic.nodes,depth:level,keys:Object.keys(fiber.memoizedProps||{}).slice(0,30)});
    for(const props of [fiber.memoizedProps,fiber.alternate?.memoizedProps,fiber.pendingProps]){visited=0;scan(props,new Set());}
    if(candidates.some(c=>c.code&&c.score===100))break;
    if(fiber.memoizedProps?.allMessages)break;
   }
   visited=0;scan(el[keys.find(k=>k.startsWith('__reactProps$'))],new Set());
   const programs=[...new Map(candidates.filter(c=>c.code&&(c.score===100||c.score===80)).map(c=>[JSON.stringify([c.code,c.constants]),c])).values()];
   const text=candidates.find(c=>c.markdown!==undefined&&c.score===100);
   if(!programs.length&&!text)continue;
   const identity=messageId||owner.getAttribute('data-obsidian-message-source')||crypto.randomUUID();
   for(const found of programs.length?programs:[text]){
    const key=JSON.stringify([identity,found.code||null,found.constants||null]);
    let record=byCode.get(key);
    if(!record){record=JSON.parse(JSON.stringify({...(text||{}),...found,id:identity,messageId:identity}));delete record.score;
     if(JSON.stringify(record).length>4_000_000)throw Error('message_source_size_limit');byCode.set(key,record);records.push(record);
     if(record.code)diagnostic.programs++;if(record.markdown!==undefined)diagnostic.texts++;
    }
   }
   owner.setAttribute('data-obsidian-message-source',identity);el.setAttribute('data-obsidian-message-source',identity);body.setAttribute('data-obsidian-message-source',identity);
  }catch(error){if(diagnostic.errors.length<12)diagnostic.errors.push(String(error.message||error).slice(0,240));}
 }
 return records;
};
