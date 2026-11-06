const HOST = 'com.local.chatgpt_obsidian';
const save = document.querySelector('#save');
const status = document.querySelector('#connection');
let vaultReady = false;
const VERSION=chrome.runtime.getManifest?.().version||'0.8.2';
const versionLabel=document.querySelector('#version');if(versionLabel)versionLabel.textContent='v'+VERSION;
const versionParts=value=>String(value||'0').split('.').map(Number);
function olderVersion(current,required){const a=versionParts(current),b=versionParts(required);for(let i=0;i<3;i++){if((a[i]||0)!==(b[i]||0))return (a[i]||0)<(b[i]||0);}return false;}
const grantImages=document.querySelector('#grant-images');
let missingOrigins=[];
async function inspectImagePermissions(){
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab?.url||''))return;
    const [scan]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
      const roots=[...document.querySelectorAll('main,[role="main"]')].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0);
      const root=roots.find(el=>el.querySelector('[data-chatgpt-conversation-selection-target]'))||roots[0]||document;
      return [...new Set([...root.querySelectorAll('img')].map(el=>{try{const u=new URL(el.currentSrc||el.src);return ['https:','http:'].includes(u.protocol)?u.origin+'/*':null;}catch{return null;}}).filter(Boolean))];
    }});
    for(const origin of scan.result||[])if(!await chrome.permissions.contains({origins:[origin]}))missingOrigins.push(origin);
    grantImages.hidden=!missingOrigins.length;
    const label=document.querySelector('#image-sites');label.hidden=!missingOrigins.length;
    label.textContent='需要访问图片网站：'+missingOrigins.map(o=>new URL(o).hostname).join('、')+'。仅用于下载当前对话配图。';
    grantImages.disabled=!vaultReady;
  }catch{}
}
grantImages.addEventListener('click',()=>{
  chrome.permissions.request({origins:missingOrigins}).then(granted=>{
    if(granted){grantImages.hidden=true;document.querySelector('#image-sites').hidden=true;save.click();}
    else show('图片网站尚未授权','仍可使用普通归档；受跨域限制的图片可能缺失。');
  }).catch(e=>show('图片授权未完成',e.message));
});
inspectImagePermissions();
async function native(message) {
  const result = await chrome.runtime.sendNativeMessage(HOST, message);
  if (!result?.ok) throw new Error(result?.error || '本地接收程序没有返回结果');
  return result;
}
function show(summary, details, uri) {
  document.querySelector('#result').hidden = false;
  document.querySelector('#summary').textContent = summary;
  document.querySelector('#details').textContent = details;
  const link = document.querySelector('#open');
  link.hidden = !uri;
  if (uri) link.href = uri;
}
native({action: 'status'}).then(r => {
  if(r.minimum_collector_version&&olderVersion(VERSION,r.minimum_collector_version))throw Error('请在 Chrome 扩展管理页重新加载 ChatGPT → Obsidian，以使用最新采集与排版修复');
  vaultReady = true; save.disabled = false;
  grantImages.disabled=false;
  status.textContent = `已连接 · ${r.vault_name}`;
}).catch(e => {status.textContent = /重新加载/.test(e.message)?e.message:`接收程序尚未就绪：${e.message}。请运行安装程序。`;});
async function saveCodeDiagnostic(tab,codeBlocks){
  try{
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['diagnose.js']});
    const [diagnostic]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.obsidianStructureDiagnostic()});
    diagnostic.result.code_capture=codeBlocks||[];
    diagnostic.result.collector_version=VERSION;
    await native({action:'diagnose',structure:diagnostic.result});
    return '\n页面结构与代码采集诊断已保存（不含聊天文字或代码正文）。反馈问题时请提供脱敏后的诊断和扩展版本。';
  }catch(e){return '\n诊断未保存：'+e.message;}
}
save.addEventListener('click', async () => {
  save.disabled = true; save.textContent = '正在采集对话与配图…';
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const url = new URL(tab.url || 'about:blank');
    if (!['chatgpt.com','chat.openai.com'].includes(url.hostname) || !/\/(?:c|share)\/[^/]+/.test(url.pathname)) {
      throw new Error('请在 Chrome 中打开具体的 ChatGPT 对话，再点击归档。');
    }
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['dil-archive.js','layout-source.js','archive-resources.js','archive-capture.js','history-scan.js','collector.js']});
    save.textContent='正在加载并核对对话消息…';
    const [history]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.scanLoadedConversation()});
    if(history.error)throw Error(history.error.message);
    save.textContent='正在读取完整代码与配图…';
    let editorSources=[],messageSources=[],sourceCapture={errors:[],history:history.result};
    try{
      await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['code-source.js']});
      const [models]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>globalThis.readObsidianCodeSources()});
      if(models.error)throw Error(models.error.message);
      editorSources=Array.isArray(models.result)?models.result:[];
    }catch(error){sourceCapture.errors.push('editor: '+String(error.message||error));}
    try{
      await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['dil-archive.js','message-source.js']});
      const [messages]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>{
        try{const records=globalThis.readObsidianMessageSources(),seen=new Set(records.map(r=>JSON.stringify([r.code,r.constants])));for(const [i,pkg] of (globalThis.chatgptDilArchive?.read()||[]).entries())if(!seen.has(JSON.stringify([pkg.code,pkg.constants]))){records.push({id:'page-source-'+i,...pkg});seen.add(JSON.stringify([pkg.code,pkg.constants]));}return {records,diagnostic:globalThis.obsidianMessageSourceDiagnostic};}
        catch(error){return {records:[],diagnostic:{errors:[String(error.message||error)]}};}
      }});
      if(messages.error)throw Error(messages.error.message);
      messageSources=Array.isArray(messages.result?.records)?messages.result.records:[];
      sourceCapture.message=messages.result?.diagnostic||{errors:['no_result']};
    }catch(error){sourceCapture.errors.push('messages: '+String(error.message||error));}
    try{
      const recovered=await native({action:'read_sources',source_url:url.origin+url.pathname});
      if(recovered.ok&&Array.isArray(recovered.records)&&recovered.records.length){
        const live=new Set(messageSources.filter(s=>s.code).map(s=>JSON.stringify([s.code,s.constants])));
        const extra=recovered.records.filter(s=>!live.has(JSON.stringify([s.code,s.constants])));messageSources.push(...extra);
        sourceCapture.recovered={programs:extra.length,origin:recovered.origin,scope:recovered.scope};
      }
    }catch(error){sourceCapture.errors.push('registered_sources: '+String(error.message||error));}
    save.textContent='正在验证原交互程序…';
    const validated=messageSources.filter(source=>!source.code);sourceCapture.runtime=[];
    sourceCapture.runner='native-chrome-offline';
    const programs=messageSources.filter(source=>source.code);
    const unsupportedTypes=new Set();
    try{
      const results=await inspectArchivePrograms(programs);
      for(const [index,source] of programs.entries()){
        const result=results[index];
        if(result.verified){
          const unsupported=[...new Set(result.inspection.unsupported.map(item=>item.type))];
          for(const type of unsupported)unsupportedTypes.add(type);
          validated.push({...source,inspection:result.inspection,runtimeVerified:true});
          sourceCapture.runtime.push({id:source.id,whole_program:true,verified:true,unsupported});
        }else{
          validated.push({...source,runtimeVerified:false,runtimeError:result.error});
          sourceCapture.runtime.push({id:source.id,verified:false,error:result.error});sourceCapture.errors.push('runtime: '+result.error);
        }
      }
    }catch(error){
      const reason=String(error.message||error);sourceCapture.errors.push('runtime: '+reason);
      for(const source of programs){validated.push({...source,runtimeVerified:false,runtimeError:reason});sourceCapture.runtime.push({id:source.id,verified:false,error:reason});}
    }
    messageSources=validated;
    const [result] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:async(options)=>{
      try {return await globalThis.collectObsidianLesson(options);}
      catch(e){return {collection_error:String(e?.message||e)};}
    },args:[{editorSources,messageSources,sourceCapture}]} );
    if(result?.result?.collection_error){
      let diagnosticStatus='';
      try{
        await chrome.scripting.executeScript({target:{tabId:tab.id},files:['diagnose.js']});
        const [diagnostic]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.obsidianStructureDiagnostic()});
        await native({action:'diagnose',structure:diagnostic.result});
        diagnosticStatus='\n页面结构诊断已保存到本地（不包含聊天文字）。反馈问题时请提供脱敏后的诊断和扩展版本。';
      }catch(e){diagnosticStatus='\n诊断未保存：'+e.message;}
      throw new Error(result.result.collection_error+diagnosticStatus);
    }
    if(result?.error)throw new Error(String(result.error.message||result.error));
    if(unsupportedTypes.size&&Array.isArray(result?.result?.warnings))
      result.result.warnings.push('原程序含未支持的组件：'+[...unsupportedTypes].slice(0,10).join('、')+'。这些位置显示为占位，已保留位置与文字，行为未迁移。');
    if (!result?.result?.messages?.length) throw new Error('未识别到对话正文。页面结构可能已变化；本次没有保存空笔记。');
    if(history.result?.seenMessages>result.result.messages.length)throw Error('扫描发现的消息数多于实际采集数，本次未写入残缺对话，请保留页面结构诊断。');
    const incomplete=(result.result.code_blocks||[]).filter(block=>block.partial);
    if(incomplete.length){
      const diagnostic=await saveCodeDiagnostic(tab,result.result.code_blocks);
      throw new Error(`${incomplete.length} 个代码块尚未完整采集，本次未写入笔记。需要滚动的代码不能只保存当前可见行。`+diagnostic);
    }
    const usedModels=(result.result.code_blocks||[]).filter(block=>block.source_id);
    if(usedModels.length){
      const [current]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>globalThis.readObsidianCodeSources()});
      const latest=new Map((current.result||[]).map(item=>[item.id,item]));
      const captured=new Map(editorSources.map(item=>[item.id,item]));
      if(usedModels.some(block=>latest.get(block.source_id)?.status!=='complete'||latest.get(block.source_id)?.text!==captured.get(block.source_id)?.text))
        throw new Error('代码在采集过程中发生变化，本次未写入笔记。请等回答完成后再归档。'+await saveCodeDiagnostic(tab,result.result.code_blocks));
    }
    save.textContent = '正在写入 Obsidian…';
    const archived = await native({action:'archive',bundle:result.result});
    if(!archived.verified)throw new Error('接收程序未返回文件校验结果，尚不能确认保存成功。');
    const fidelity=archived.fidelity||{};
    const summary=fidelity.status==='partial'?`部分保存：${fidelity.interaction_losses||0} 项交互未保留，${fidelity.failed_assets||0} 项资源或关联未完整迁移`:(fidelity.source_saved?'原生笔记和交互组件已保存，请在 Obsidian 中核对':(archived.reused?'已有归档已校验，可直接打开':'笔记和附件已保存并校验'));
    show(summary,
      `${archived.messages} 条消息 · ${archived.assets} 个附件\n笔记位于库顶层：\n${archived.path}\n\n已核对正文、附件及本地资源引用。Obsidian 界面显示尚未验证。\n\n${archived.warnings.slice(0,6).join('\n')}${archived.warnings.length>6?'\n其余 '+(archived.warnings.length-6)+' 项详情见笔记中的归档报告。':''}`, archived.uri);
  } catch (e) {show('未完成归档', e.message);}
  finally {save.disabled = !vaultReady; save.textContent = '归档到 Obsidian';}
});
