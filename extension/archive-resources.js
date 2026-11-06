'use strict';
// All dependency downloads enter one manifest. No live URL is needed to replay
// a successfully packed resource. Unresolved services remain explicit losses.
globalThis.createArchiveResourcePacker=function(options){
  const pending=new Map(),assets=options.assets;
  const encode=options.bytes64,missing=options.missingAssets,warnings=options.warnings;
  let resourceBytes=0;
  const report=(kind,url,error)=>{const safe=String(url).split('?')[0];missing.push({kind,title:safe,reason:String(error)});warnings.push('资源未打包：'+safe+'（'+String(error)+'）');};
  async function download(url){
    try{
      const response=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      const chunks=[];let size=0;const reader=response.body.getReader();
      try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw Error('依赖资源超过 8 MB');chunks.push(value);}}finally{await reader.cancel();}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      return {bytes,type:(response.headers.get('content-type')||'application/octet-stream').split(';')[0]};
    }catch(error){
      const response=await chrome.runtime.sendMessage({action:'fetchResource',url});
      if(!response?.ok)throw Error(response?.error||error.message);
      return {bytes:Uint8Array.from(atob(response.base64),c=>c.charCodeAt(0)),type:response.type};
    }
  }
  function absolute(value,base){const url=new URL(value,base);if(!['http:','https:','blob:','data:'].includes(url.protocol))throw Error('不支持的资源地址');return url.href;}
  async function resource(value,base,kind='dependency'){
    if(!value||value.startsWith('#')||value.startsWith('archive-resource:'))return value;
    const url=absolute(value,base);if(url.startsWith('data:'))return url;
    if(!pending.has(url))pending.set(url,(async()=>{
      try{
        const result=await download(url);resourceBytes+=result.bytes.length;
        if(resourceBytes>16*1024*1024)throw Error('依赖资源总量超过 16 MB');
        const name='resource-'+String(assets.length+1).padStart(3,'0')+'.bin';
        assets.push({name,base64:encode(result.bytes),resourceType:result.type});
        return 'archive-resource:'+name;
      }catch(error){report(kind,url,error.message);return 'data:,';}
    })());
    return await pending.get(url);
  }
  async function text(value,base){return new TextDecoder().decode((await download(absolute(value,base))).bytes);}
  async function css(source,base,depth=0){
    if(depth>6){report('stylesheet',base,'样式依赖嵌套超过上限');return '';}
    let out='',last=0;
    const imports=/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/gi;
    for(const match of source.matchAll(imports)){
      out+=source.slice(last,match.index);last=match.index+match[0].length;
      try{const url=absolute(match[1],base);const sheet=await css(await text(url,base),url,depth+1);out+=match[2].trim()?'@media '+match[2]+'{'+sheet+'}':sheet;}catch(error){report('stylesheet',match[1],error.message);}
    }
    out+=source.slice(last);source=out;out='';last=0;
    for(const match of source.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi)){
      out+=source.slice(last,match.index);last=match.index+match[0].length;
      out+='url("'+await resource(match[2].trim(),base,'css-resource')+'")';
    }
    return out+source.slice(last);
  }
  async function html(raw,base,depth=0){
    if(depth>4)throw Error('嵌套框架超过归档上限');
    const doc=new DOMParser().parseFromString(raw,'text/html');
    const declaredBase=doc.querySelector('base[href]');if(declaredBase)base=absolute(declaredBase.getAttribute('href'),base);
    for(const node of doc.querySelectorAll('base,meta[http-equiv]'))node.remove();
    for(const sheet of [...doc.querySelectorAll('link[rel="stylesheet"][href]')]){
      try{const url=absolute(sheet.getAttribute('href'),base),style=doc.createElement('style');style.textContent=await css(await text(url,base),url);sheet.replaceWith(style);}catch(error){report('stylesheet',sheet.getAttribute('href'),error.message);sheet.remove();}
    }
    for(const script of doc.querySelectorAll('script')){
      if(script.src){try{const url=absolute(script.getAttribute('src'),base);script.textContent=await text(url,base);script.removeAttribute('src');script.removeAttribute('integrity');script.removeAttribute('crossorigin');}catch(error){report('script',script.src,error.message);}}
      if(script.type==='module'&&/\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"]|\bimport\s*\(/.test(script.textContent))report('module',base,'模块导入图未取得完整解析，原源码已保存，运行依赖待核验');
      if(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/.test(script.textContent))report('service',base,'程序可能依赖在线数据或服务，离线播放器会报告实际调用失败');
    }
    for(const node of doc.querySelectorAll('style'))node.textContent=await css(node.textContent,base);
    for(const node of doc.querySelectorAll('[style]'))node.setAttribute('style',await css(node.getAttribute('style'),base));
    for(const node of doc.querySelectorAll('[src],video[poster],image[href],image[xlink\\:href]')){
      if(node.localName==='script'||node.localName==='iframe')continue;
      for(const attr of ['src','poster','href','xlink:href'])if(node.hasAttribute(attr))node.setAttribute(attr,await resource(node.getAttribute(attr),base,node.localName));
      node.removeAttribute('srcset');
    }
    for(const frame of doc.querySelectorAll('iframe')){
      try{let source=frame.getAttribute('srcdoc');const url=frame.hasAttribute('src')?absolute(frame.getAttribute('src'),base):base;if(source===null)source=await text(url,base);frame.setAttribute('srcdoc',await html(source,url,depth+1));frame.removeAttribute('src');frame.setAttribute('sandbox','allow-scripts');}catch(error){report('iframe',base,error.message);}
    }
    for(const link of doc.querySelectorAll('a[href]')){try{link.href=new URL(link.getAttribute('href'),base).href;}catch{}}
    return '<!doctype html>'+doc.documentElement.outerHTML;
  }
  return {resource,css,html,text};
};
