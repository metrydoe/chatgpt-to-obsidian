/* Reads the currently loaded DOM only. Never uses private conversation APIs. */
globalThis.collectObsidianLesson = async function (options={}) {
  const MAX_ASSET = 8 * 1024 * 1024, MAX_TOTAL = 24 * 1024 * 1024;
  const warnings = ['范围：网页已加载的当前对话分支；未验证整段历史完整性。'];
  const assets = [], sources = new Map();
  const codeBlocks=[],protectedCode=new Map(),codePrefix='\uE000'+crypto.randomUUID()+'_';
  const editorSources=new Map((options.editorSources||[]).map(item=>[item.id,item]));
  let totalBytes = 0;
  let preserveSourceMarkdown = false;
  const visitedImages=new WeakSet(), visitedMedia=new WeakSet();
  const interactions=[], layouts=[], missingAssets=[];
  let messageIndex=0, originalCodeSources=[], mathSources=[], pendingMath=new Map();
  const archiveMessages=[];
  const widgetNodes=new WeakMap(),widgetHashToken='\uE002'+crypto.randomUUID()+'\uE003';
  const textEscape = s => s.replace(/([\\`*_[\]<>])/g, '\\$1');
  const widgetText=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  function markNativeWidgets(body,view){
    const visible=[...body.querySelectorAll('h1,h2,h3,h4,p,label,button,span,td,th')].filter(node=>getComputedStyle(node).display!=='none');
    const label=node=>{
      const ids=(node.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean);
      return widgetText(ids.length?ids.map(id=>document.getElementById(id)?.textContent||'').join(' '):node.getAttribute('aria-label')||node.labels?.[0]?.textContent||node.closest('label')?.textContent||node.textContent);
    };
    for(const program of view.programs.filter(p=>p.kind==='dil')){
      const captured=[];
      for(const panel of program.inspection?.panels||[]){
        const anchors=panel.anchors.map(widgetText).filter(Boolean);if(!anchors.length)continue;
        const exact=text=>visible.filter(node=>widgetText(node.textContent)===text&&![...node.children].some(child=>widgetText(child.textContent)===text));
        const first=exact(anchors[0]),last=exact(anchors[anchors.length-1]),scopes=new Set();
        if(first.length*last.length>100)continue;
        for(const start of first)for(const end of last){
          if(start!==end&&!(start.compareDocumentPosition(end)&Node.DOCUMENT_POSITION_FOLLOWING))continue;
          let node=start;while(node&&node!==body&&!node.contains(end))node=node.parentElement;
          if(node&&node!==body&&widgetText(node.textContent).length<=Math.max(240,widgetText(panel.text).length*3))scopes.add(node);
        }
        if(scopes.size!==1)continue;const scope=[...scopes][0];
        widgetNodes.set(scope,{schema:1,asset:'assets/archive-001.json',sha256:widgetHashToken,message:view.id,program:program.id,view:panel.path});
        const targets=[...scope.querySelectorAll('input,select,textarea,button,[role=slider],[role=radio],[role=checkbox],[role=switch],[role=combobox]')];
        for(const field of panel.controls){
          if(field.tag==='button')continue;
          const selector=field.type==='range'?'input[type=range],[role=slider]':field.type==='radio'?'input[type=radio],[role=radio]':field.type==='checkbox'?'input[type=checkbox],[role=checkbox],[role=switch]':field.tag;
          const matches=targets.filter(node=>node.matches(selector)&&label(node)===widgetText(field.label));if(matches.length!==1)continue;
          const node=matches[0],value=node.getAttribute('aria-valuenow')??node.value??field.value;
          captured.push({fieldKey:field.key,value:String(value),checked:node.getAttribute('aria-checked')!==null?node.getAttribute('aria-checked')==='true':!!node.checked});
        }
      }
      if(captured.length)program.controls=captured;
    }
  }
  // The page stays the source of the note. Math is the one place the rendered
  // DOM is known to lose information, so an equation is replaced by the exact
  // TeX from the delivered source only when the two can be paired.
  function stripFencedCode(markdown){
    const kept=[];let open=null;
    for(const line of String(markdown||'').split(/\r\n|\r|\n/)){
      const fence=/^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if(open){
        if(fence&&fence[1][0]===open[0]&&fence[1].length>=open.length)open=null;
        continue;
      }
      if(fence){open=fence[1];continue;}
      kept.push(line);
    }
    return kept.join('\n');
  }
  function extractFormulas(markdown){
    const body=stripFencedCode(markdown);
    const found=[];
    for(const match of body.matchAll(/\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\\\(([\s\S]*?)\\\)/g)){
      const display=match[3]===undefined;
      found.push({display,tex:String(display?(match[1]??match[2]):match[3]).trim()});
    }
    return found;
  }
  function normalizeTex(value){
    return String(value||'').replace(/\\left|\\right/g,'').replace(/\\[,;:!]/g,'')
      .replace(/\\(?:mathrm|text|mathbf|operatorname)\s*\{([^{}]*)\}/g,'$1')
      .replace(/[{}]/g,'').replace(/\s+/g,'').toLowerCase();
  }
  function texSimilarity(a,b){
    if(!a||!b)return 0;if(a===b)return 1;
    const grams=value=>{const set=new Set();for(let i=0;i<value.length-1;i++)set.add(value.slice(i,i+2));return set;};
    const left=grams(a),right=grams(b);
    if(!left.size||!right.size)return 0;
    let shared=0;for(const gram of left)if(right.has(gram))shared++;
    return 2*shared/(left.size+right.size);
  }
  function resolveMath(markdown){
    if(!pendingMath.size)return markdown;
    // The annotation belongs to this rendered formula. A source formula with
    // a similar spelling or the same ordinal can describe a different term.
    for(const [token,item] of pendingMath)markdown=markdown.split(token).join(item.display?`$$\n${item.dom}\n$$`:`$${item.dom}$`);
    return markdown;

  }
  const bytes64 = bytes => {
    let result = ''; for(let i=0;i<bytes.length;i+=8192) result+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(result);
  };
  const packer=globalThis.createArchiveResourcePacker({assets,bytes64,missingAssets,warnings});
  function addAsset(bytes, ext, label) {
    if(bytes.length>MAX_ASSET || totalBytes+bytes.length>MAX_TOTAL) throw new Error('附件超过本次大小限制');
    totalBytes+=bytes.length;
    const name=`image-${String(assets.length+1).padStart(3,'0')}.${ext}`;
    assets.push({name,base64:bytes64(bytes)});
    return `![${String(label||'配图').replace(/[\[\]\r\n]/g,' ')}](assets/${name})`;
  }
  function decorativeImage(el){
    const src=el.currentSrc||el.src||'';
    const box=el.getBoundingClientRect();
    return !el.alt.trim()&&box.width<=32&&box.height<=32&&(/\/favicons?(?:[/?._]|$)|\/s2\/favicons/i.test(src)||el.closest('[data-testid*="citation"],[data-d-component="citation"]'));
  }
  async function image(el) {
    visitedImages.add(el);
    if(decorativeImage(el))return '';
    const src=el.currentSrc||el.src;
    if(!src) {missingAssets.push({kind:'image',title:el.alt||'未命名',reason:'没有图片地址'});warnings.push('一张图片没有可读取的地址。'); return '\n[图片缺失]\n';}
    if(sources.has(src)) return sources.get(src).replace(/^!\[[^\]]*\]/,()=>`![${String(el.alt||'配图').replace(/[\[\]\r\n]/g,' ')}]`);
    try {
      const response=await fetch(src,{credentials:'same-origin',signal:AbortSignal.timeout(12000)});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const declared=Number(response.headers.get('content-length')||0);
      if(declared>MAX_ASSET) throw new Error('图片超过 8 MB');
      const reader=response.body.getReader(); const chunks=[]; let size=0;
      try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_ASSET)throw new Error('图片超过 8 MB');chunks.push(value);}}
      finally {await reader.cancel();}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const type=(response.headers.get('content-type')||'').split(';')[0];
      const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'}[type];
      if(!ext) throw new Error(`不支持的图片类型 ${type||'未知'}`);
      const md=addAsset(bytes,ext,el.alt);sources.set(src,md);return md;
    } catch(e) {
      let retryError='';
      try {
        const remote=await chrome.runtime.sendMessage({action:'fetchImage',url:src});
        if(remote?.ok){const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg'}[remote.type];if(!ext)throw new Error('未知图片类型');const bytes=Uint8Array.from(atob(remote.base64),c=>c.charCodeAt(0));const md=addAsset(bytes,ext,el.alt);sources.set(src,md);return md;}
        retryError=remote?.error||'扩展未返回图片';
      } catch(error) {retryError=error.message;}
      missingAssets.push({kind:'image',title:el.alt||'未命名',reason:e.message+'；'+retryError});
      warnings.push(`图片未保存：${el.alt||'未命名'}（页面下载：${e.message}；扩展重试：${retryError}）`);
      return `\n[图片未保存：${textEscape(el.alt||'未命名')}；见归档报告]\n`;
    }
  }
  async function children(el) {let s='';for(const n of el.childNodes)s+=await convert(n);return s;}
  function protectCode(markdown){
    const token=codePrefix+protectedCode.size+'\uE001';protectedCode.set(token,markdown);return '\n\n'+token+'\n\n';
  }
  function codeLanguage(node,body){
    const aliases={python:'python',py:'python',javascript:'javascript',js:'javascript',typescript:'typescript',ts:'typescript',html:'html',css:'css',json:'json',svg:'svg',xml:'xml',bash:'bash',shell:'bash',powershell:'powershell',c:'c',cpp:'cpp','c++':'cpp',matlab:'matlab',sql:'sql'};
    for(const el of [body,node]){
      const declared=el.getAttribute('data-language')||el.getAttribute('data-lang')||(String(el.className).match(/language-([\w+-]+)/)||[])[1];
      if(declared)return aliases[declared.toLowerCase()]||declared.replace(/[^\w+-]/g,'');
    }
    for(const el of [...node.children].slice(0,4)){
      if(el===body||el.contains(body))continue;
      const label=el.textContent.trim().toLowerCase();if(aliases[label])return aliases[label];
    }
    return '';
  }
  function codeBody(node){
    if(node.tagName==='PRE')return node.querySelector('code')||node;
    if(node.matches('.cm-content,.view-lines,code,[data-code-content]'))return node;
    const nested=node.querySelector('.cm-content,.view-lines,pre code,pre,code,[data-code-content]');
    if(nested)return nested;
    // Modern blocks sometimes use a div with preformatted text, not pre/code.
    const candidates=[...node.children].filter(el=>!el.matches('button,header')&&!el.querySelector('button'));
    return candidates.find(el=>/pre|break-spaces/.test(getComputedStyle(el).whiteSpace))||
      candidates.find(el=>el.textContent.includes('\n'))||node;
  }
  function isCodeBlock(node){
    if(node.tagName==='PRE')return true;
    if(node.matches('.cm-editor,.CodeMirror,.monaco-editor,.ace_editor,.cm-content,.view-lines,[data-obsidian-code-id],[data-code-block],[data-codeblock],[data-code-content],[role="code"]'))return true;
    const component=(node.getAttribute('data-d-component')||'').replace(/[-_\s]/g,'').toLowerCase();
    if(component.includes('codeblock')||['code','syntaxhighlighter'].includes(component))return true;
    if(['DIV','SECTION','FIGURE'].includes(node.tagName)&&
      [...node.classList].some(c=>/^(codeblock|code-block)(?:$|[-_])|^CodeBlock(?:$|[-_])/.test(c)))return true;
    const style=getComputedStyle(node);
    if(node.tagName==='CODE'&&(/^(block|flex|grid)$/.test(style.display)||node.textContent.includes('\n')))return true;
    return ['DIV','SECTION'].includes(node.tagName)&&/pre|break-spaces/.test(style.whiteSpace)&&
      /monospace/i.test(style.fontFamily)&&(node.hasAttribute('data-language')||node.classList.contains('font-mono'));
  }
  function codeText(body){
    const raw=body.textContent;
    // Token spans may be grouped into CSS-block lines without text newlines.
    return !raw.includes('\n')&&body.innerText?.includes('\n')?body.innerText:raw;
  }
  async function readCode(node,body){
    // A source is usable only when it belongs to this matched message and the
    // rendered text identifies exactly one fenced block. Never choose by order.
    const rendered=codeText(body).replace(/\s/g,'');
    if(rendered.length>=12){
      const exact=originalCodeSources.filter(item=>item.raw.replace(/\s/g,'')===rendered);
      const matching=exact.length?exact:originalCodeSources.filter(item=>item.raw.replace(/\s/g,'').includes(rendered));
      if(matching.length===1)return {raw:matching[0].raw,partial:false,scope:'delivered_message_source',expectedLines:matching[0].raw.split(/\r\n|\r|\n/).length,language:matching[0].language};
    }
    const attached=node.matches('[data-obsidian-code-id]')?node:node.querySelector('[data-obsidian-code-id]')||body.closest('[data-obsidian-code-id]');
    const model=attached&&editorSources.get(attached.getAttribute('data-obsidian-code-id'));
    if(model?.status==='complete'){
      if(typeof model.text==='string'&&model.text.split(/\r\n|\r|\n/).length===model.lines)
        return {raw:model.text,partial:false,scope:model.scope,expectedLines:model.lines,sourceId:model.id};
      return {raw:codeText(body),partial:true,scope:'invalid_editor_model'};
    }
    const editor=node.matches('.cm-editor,.monaco-editor')?node:node.querySelector('.cm-editor,.monaco-editor')||body.closest('.cm-editor,.monaco-editor');
    const lineSelector=editor?.matches('.monaco-editor')?'.view-line':'.cm-line';
    if(!editor){
      if(node.matches('.CodeMirror,.ace_editor')||node.querySelector('.CodeMirror,.ace_editor')||body.closest('.CodeMirror,.ace_editor')||model)return {raw:codeText(body),partial:true,scope:'unreadable_editor_model'};
      // Inspect code wrappers too; their scrolling may hide virtual lines.
      // Stop at the message body so the conversation's scroll is not mistaken
      // for code scrolling. Stable rendered text alone is not proof of completeness.
      const boundary=node.closest('.markdown,.prose,[data-markdown-text-style],[data-message-content],[data-message-author-role]')||node.parentElement;
      let scroller=body;
      while(scroller&&scroller!==boundary){
        const css=getComputedStyle(scroller);
        if(scroller.scrollHeight>scroller.clientHeight+2&&/auto|scroll/.test(css.overflowY))break;
        scroller=scroller.parentElement;
      }
      if(scroller&&scroller!==boundary){
        const top=scroller.scrollTop,left=scroller.scrollLeft,raw=codeText(body);
        let changed=false,bottom=false;
        try{
          scroller.scrollTop=0;
          for(let step=0;step<180;step++){
            await new Promise(resolve=>setTimeout(resolve,40));
            if(codeText(body)!==raw){changed=true;break;}
            if(scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-2){bottom=true;break;}
            scroller.scrollTop+=Math.max(60,scroller.clientHeight*.7);
          }
        }finally{scroller.scrollTop=top;scroller.scrollLeft=left;}
        // An unchanged viewport is not evidence of completeness: rendering may
        // be deferred until after scrolling. Without a source document, stop.
        return {raw,partial:true,scope:changed?'unmapped_virtual_code':bottom?'unverified_scrolled_dom':'scroll_limit_reached'};
      }
      return {raw:codeText(body),partial:false,scope:'dom_text'};
    }
    const scroller=editor.querySelector('.cm-scroller,.monaco-scrollable-element');
    const lines=()=>[...body.querySelectorAll(lineSelector)];
    const numbered=new Map();
    const capture=()=>{
      const visibleLines=lines();
      const gutters=[...editor.querySelectorAll('.cm-lineNumbers .cm-gutterElement,.margin-view-overlays .line-numbers')]
        .filter(el=>getComputedStyle(el).visibility!=='hidden'&&/^\d+$/.test(el.textContent.trim()));
      if(visibleLines.length!==gutters.length||!visibleLines.length)return false;
      for(let i=0;i<visibleLines.length;i++)numbered.set(Number(gutters[i].textContent.trim()),visibleLines[i].textContent);
      return true;
    };
    const initial=lines().map(el=>el.textContent).join('\n')||codeText(body);
    if(!scroller||scroller.scrollHeight<=scroller.clientHeight+2){
      const hasNumbers=capture(),max=Math.max(0,...numbered.keys());
      const contiguous=hasNumbers&&numbered.size===max&&numbered.has(1);
      const partial=true; // Contiguous visible numbers do not prove the last document line.
      return {raw:contiguous?Array.from({length:max},(_,i)=>numbered.get(i+1)).join('\n'):initial,partial,scope:contiguous?'numbered_dom_lines':'editor_dom_only'};
    }
    const originalTop=scroller.scrollTop,originalLeft=scroller.scrollLeft;
    let bottom=false,hasNumbers=true;
    try{
      scroller.scrollTop=0;
      for(let step=0;step<180;step++){
        await new Promise(resolve=>setTimeout(resolve,40));
        if(!capture()){hasNumbers=false;break;}
        if(scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-2){bottom=true;break;}
        scroller.scrollTop+=Math.max(60,scroller.clientHeight*.7);
      }
    }finally{scroller.scrollTop=originalTop;scroller.scrollLeft=originalLeft;}
    const max=Math.max(0,...numbered.keys());
    const contiguous=hasNumbers&&numbered.has(1)&&numbered.size===max;
    return {raw:contiguous?Array.from({length:max},(_,i)=>numbered.get(i+1)).join('\n'):initial,
      partial:true,scope:bottom&&contiguous?'unverified_numbered_dom_lines':'partial_editor_dom'};
  }
  async function fencedCode(node){
    const body=codeBody(node),capture=await readCode(node,body),raw=capture.raw;
    const fence='`'.repeat(Math.max(2,...(raw.match(/`+/g)||[]).map(s=>s.length))+1);
    const lang=capture.language||codeLanguage(node,body);
    codeBlocks.push({language:lang,lines:raw.split(/\r\n|\r|\n/).length,characters:raw.length,partial:capture.partial,scope:capture.scope,...(capture.expectedLines?{expected_lines:capture.expectedLines}:{}),...(capture.sourceId?{source_id:capture.sourceId}:{})});
    if(capture.partial)warnings.push('代码块仅采集到部分编辑器内容，不能确认完整性；请保留本次报告并核对原代码。');
    let attachment='';
    if(lang==='html'&&!capture.partial&&/<(?:!doctype\s+html|html|script)\b/i.test(raw))attachment='\n'+await htmlSource(raw,'html_code','HTML 源码演示');
    if((lang==='svg'||lang==='xml'||raw.trimStart().startsWith('<svg'))&&raw.includes('<svg')){
      try{const xml=new DOMParser().parseFromString(raw,'image/svg+xml');if(xml.documentElement.localName==='svg')attachment='\n'+addAsset(new TextEncoder().encode(raw),'svg','SVG 源码图')+'\n';}
      catch(error){warnings.push('SVG 代码附件未保存：'+error.message);}
    }
    return protectCode(`${fence}${lang}\n${raw}${raw.endsWith('\n')?'':'\n'}${fence}\n${attachment}`);
  }
  const callout=(kind,body,metadata='')=>`\n\n> [!chatgpt-${kind}${metadata?'|'+metadata:''}]\n`+body.trim().split('\n').map(line=>'> '+line).join('\n')+'\n\n';
  function visibleChildren(node){return [...node.children].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none');}
  function mediaNodes(node){
    return [...node.querySelectorAll('img,svg')].filter(el=>{
      if(el.closest('.katex,[hidden]')||el.parentElement?.closest('svg'))return false;
      if(getComputedStyle(el).display==='none'||getComputedStyle(el).visibility==='hidden')return false;
      const r=el.getBoundingClientRect();
      return r.width>0&&r.height>0&&(el.localName!=='svg'||(!el.closest('button,[aria-hidden="true"]')&&(r.width>=48||r.height>=48)));
    });
  }
  async function imageRow(node){
    if(preserveSourceMarkdown||!['DIV','SECTION','FIGURE','SPAN'].includes(node.tagName))return null;
    if(node.querySelector('pre,code,table,input,textarea,canvas,iframe'))return null;
    const pictures=mediaNodes(node);
    if(pictures.some(p=>p.localName==='svg'&&(p.querySelector('script,animate,animateMotion,animateTransform,set')||[p,...p.querySelectorAll('*')].some(el=>[...el.attributes].some(a=>/^on/i.test(a.name))))))return null;
    if(pictures.length<2||pictures.length>12||pictures.some(img=>visitedImages.has(img)||visitedMedia.has(img)))return null;
    if([...node.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim()))return null;
    const branches=visibleChildren(node).filter(child=>pictures.some(p=>child===p||child.contains(p)));
    if(branches.length!==pictures.length||branches.some(child=>pictures.filter(p=>child===p||child.contains(p)).length!==1))return null;
    if(visibleChildren(node).some(child=>!branches.includes(child)&&!child.matches('button,[aria-hidden="true"]')&&child.textContent.trim()))return null;
    const rects=pictures.map(img=>img.getBoundingClientRect());
    const overlap=Math.min(...rects.map(r=>r.bottom))-Math.max(...rects.map(r=>r.top));
    if(overlap<Math.min(...rects.map(r=>r.height))*.5)return null;
    // Use visual order as CSS can reverse the DOM order.
    const ordered=branches.map((branch,i)=>({branch,rect:rects[i]})).sort((a,b)=>a.rect.left-b.rect.left);
    if(ordered.some((item,i)=>i&&item.rect.left<ordered[i-1].rect.right-2))return null;
    const cells=[];
    for(const {branch} of ordered){const before=new Set(pendingMath.keys());cells.push((await convert(branch)).trim().replace(/(?<!\\)\|/g,'\\|').replace(/\n+/g,'<br>'));for(const [token,item] of pendingMath)if(!before.has(token))item.display=false;}
    layouts.push({message_index:messageIndex,kind:'media_row',items:pictures.length,output:'native_table'});
    return '\n\n| '+cells.map(()=>' ').join(' | ')+' |\n| '+cells.map(()=>'---').join(' | ')+' |\n| '+cells.join(' | ')+' |\n\n';
  }
  function interaction(kind,status,reason,title=''){
    const item={id:'interaction-'+String(interactions.length+1).padStart(3,'0'),message_index:messageIndex,kind,status,reason,title:String(title).slice(0,200)};
    interactions.push(item);return item;
  }
  async function htmlSource(raw,kind,title,inline=false){
    if(!raw.trim())throw Error('原始 HTML 为空');
    const doc=new DOMParser().parseFromString(raw,'text/html');
    const dependencies=[...doc.querySelectorAll('[src],link[href],object[data],iframe,base[href]')]
      .map(el=>el.getAttribute('src')||el.getAttribute('href')||el.getAttribute('data')||'嵌套框架')
      .filter(url=>!url.startsWith('data:')&&!url.startsWith('#'));
    if(/@import|url\(\s*['"]?(?!data:|#)/i.test([...doc.querySelectorAll('style,[style]')].map(el=>el.textContent+' '+(el.getAttribute('style')||'')).join(' ')))dependencies.push('CSS 外部资源');
    if(/\b(?:fetch|XMLHttpRequest|WebSocket|import)\s*\(|\bimport\s+[\s\S]*?\bfrom\s*['"]|\b(?:localStorage|sessionStorage|indexedDB|parent|opener)\b/.test([...doc.scripts].map(el=>el.textContent).join('\n')))dependencies.push('脚本网络、模块、存储或父页面依赖（需核验）');
    const bytes=new TextEncoder().encode(raw);
    if(bytes.length>MAX_ASSET||totalBytes+bytes.length>MAX_TOTAL)throw Error('交互源码超过附件大小限制');
    const name='interactive-'+String(assets.length+1).padStart(3,'0')+'.html.txt';
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    totalBytes+=bytes.length;assets.push({name,base64:bytes64(bytes)});
    const item=interaction(kind,dependencies.length?'source_saved_dependencies_missing':'source_saved','已保存原始源码；运行效果尚未核验',title);
    item.asset=name;item.dependencies=[...new Set(dependencies)].slice(0,100);item.sha256=hash;
    const config={schema:1,asset:'assets/'+name,sha256:hash,title:title||'已归档的 HTML 演示',dependencies:item.dependencies,...(inline?{presentation:'inline'}:{})};
    return protectCode('```chatgpt-html\n'+JSON.stringify(config,null,2)+'\n```')+(inline?'\n':'\n[查看原始交互源码](assets/'+name+')\n');
  }
  async function frameSource(node){
    try{
      let raw=node.getAttribute('srcdoc');
      if(raw===null){
        const url=new URL(node.getAttribute('src')||'about:blank',location.href);
        if(!['https:','http:','data:','blob:'].includes(url.protocol))throw Error('没有可读取的原始 HTML 地址');
        const response=await fetch(url.href,{credentials:'same-origin',signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Error('HTTP '+response.status);
        if(!(response.headers.get('content-type')||'').includes('text/html'))throw Error('框架地址未返回 HTML');
        const reader=response.body.getReader(),parts=[];let size=0;
        try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_ASSET)throw Error('交互源码超过 8 MB');parts.push(value);}}finally{await reader.cancel();}
        const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}raw=new TextDecoder().decode(bytes);
      }
      return await htmlSource(raw,'iframe_source',node.title||'框架演示');
    }catch(error){
      const item=interaction('iframe','missing',error.message,node.title);
      warnings.push(item.id+'：iframe 交互源码未保存（'+error.message+'）');
      return '\n[交互未保留：'+textEscape(node.title||'iframe')+'；'+textEscape(error.message)+']\n';
    }
  }
  function staticSvg(node){
    visitedMedia.add(node);
    const cloned=node.cloneNode(true);cloned.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const originals=[node,...node.querySelectorAll('*')],copies=[cloned,...cloned.querySelectorAll('*')];
    const properties=['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','color','font-family','font-size','font-weight','text-anchor','dominant-baseline','visibility','display','paint-order','clip-path','mask','filter','marker-start','marker-mid','marker-end','stop-color','stop-opacity'];
    for(let i=0;i<originals.length;i++){
      const css=getComputedStyle(originals[i]),copy=copies[i];
      copy.removeAttribute('class');copy.removeAttribute('style');
      for(const prop of properties){
        let value=css.getPropertyValue(prop);
        value=value.replace(/url\(["']?[^)#]*#([^)'"\s]+)["']?\)/g,'url(#$1)');
        if(value&&!/url\((?!#)/.test(value))copy.style.setProperty(prop,value);
      }
      for(const attr of [...copy.attributes])if(/^on/i.test(attr.localName)||(['href','src'].includes(attr.localName)&&!attr.value.startsWith('#')))copy.removeAttributeNode(attr);
    }
    for(const el of cloned.querySelectorAll('script,style,foreignObject,iframe,animate,animateMotion,animateTransform,set'))el.remove();
    const rect=node.getBoundingClientRect();
    cloned.setAttribute('width',String(Math.round(rect.width)));cloned.setAttribute('height',String(Math.round(rect.height)));
    if(!cloned.hasAttribute('viewBox'))cloned.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    return new XMLSerializer().serializeToString(cloned);
  }
  function cardFrame(node){
    const css=getComputedStyle(node);
    const background=css.backgroundColor;
    return parseFloat(css.borderRadius)>0&&(
      (background!=='transparent'&&background!=='rgba(0, 0, 0, 0)')||
      (parseFloat(css.borderTopWidth)>0&&css.borderTopStyle!=='none'));
  }
  function arrowNode(node){
    if(/^[↓⇩⬇→]$/.test(node.textContent.trim()))return true;
    const svg=node.matches('svg')?node:node.querySelector('svg');
    if(!svg||node.textContent.trim())return false;
    const box=svg.getBoundingClientRect();
    return box.width>0&&box.height>0&&box.width<=32&&box.height<=32;
  }
  async function structuredLayout(node){
    if(preserveSourceMarkdown||!['DIV','SECTION','SPAN','FIGURE'].includes(node.tagName))return null;
    const css=getComputedStyle(node), items=visibleChildren(node);
    if(items.length<2||items.length>24||node.querySelector('input,textarea,select,canvas,iframe'))return null;
    // Only recognize groups of framed content cards. Ordinary flex rows, text,
    // galleries and math internals must keep their existing conversion path.
    const cards=items.filter(el=>cardFrame(el)&&!arrowNode(el)&&el.textContent.trim());
    const arrows=items.filter(arrowNode);
    const columns=(css.display.includes('grid')&&css.gridTemplateColumns.split(/\s+/).length>1)||
      (css.display.includes('flex')&&css.flexDirection==='row');
    if(columns&&cards.length>=2&&cards.length<=4&&cards.length===items.length){
      const parts=[];
      for(const card of cards)parts.push(callout('card',await children(card)));
      warnings.push('并排卡片已保留为 Obsidian 分栏；窄栏会按可用宽度显示。');
      return callout('columns',parts.join('\n'),String(cards.length));
    }
    if(cards.length>=3&&arrows.length&&cards.length+arrows.length===items.length){
      const parts=[];
      for(const item of items)parts.push(arrowNode(item)?'↓':callout('card',await children(item)));
      return callout('flow',parts.join('\n\n'));
    }
    return null;
  }
  function displayMath(node){
    if(node.classList.contains('katex-display'))return true;
    if(node.closest('td,th'))return false;
    let wrapper=node;
    for(let depth=0;depth<4;depth++){
      if(/^(block|flex|grid)$/.test(getComputedStyle(wrapper).display))return true;
      const parent=wrapper.parentElement;
      if(!parent||!['SPAN','DIV','P'].includes(parent.tagName)||parent.matches('[data-markdown-text-style],.markdown,.prose'))break;
      const meaningful=[...parent.childNodes].filter(n=>n.nodeType!==Node.TEXT_NODE||n.textContent.trim());
      if(meaningful.length!==1||meaningful[0]!==wrapper)break;
      wrapper=parent;
    }
    return false;
  }
  async function convert(node) {
    if(node.nodeType===Node.TEXT_NODE) {
      const whitespace=node.parentElement?getComputedStyle(node.parentElement).whiteSpace:'';
      const text=/pre|break-spaces/.test(whitespace)?node.textContent:node.textContent.replace(/\s+/g,' ');
      return preserveSourceMarkdown?text:textEscape(text);
    }
    if(node.nodeType!==Node.ELEMENT_NODE) return '';
    const tag=node.tagName.toLowerCase();
    if(['script','style','nav'].includes(tag)||node.hidden||getComputedStyle(node).display==='none')return '';
    if(widgetNodes.has(node))return protectCode('```chatgpt-widget\n'+JSON.stringify(widgetNodes.get(node),null,2)+'\n```');
    if(tag==='code'&&!node.closest('pre,[data-d-component="CodeBlock"],.cm-editor,.monaco-editor')&&!node.textContent.includes('\n')){const raw=node.textContent;const fence='`'.repeat(Math.max(0,...(raw.match(/`+/g)||[]).map(s=>s.length))+1);return fence+raw+fence;}
    if(isCodeBlock(node))return await fencedCode(node);
    if(globalThis.readObsidianLayout&&node.matches('[data-d-component="box"],[data-d-component="card"]')&&node.textContent.length<6000&&!node.querySelector('[data-d-component="favicon"],a[href],img')&&(node.querySelectorAll('[data-d-component="row"]').length>=3||[...node.querySelectorAll('[data-d-component="grid"]')].some(grid=>grid.children.length>=2&&grid.children.length<=24))&&!node.querySelector('input,select,textarea,[role="slider"],[role="radiogroup"],pre,code,.katex,[data-d-component="math"]')){
      const tree=await readObsidianLayout(node,async svg=>{
        const markdown=addAsset(new TextEncoder().encode(staticSvg(svg)),'svg',svg.getAttribute('aria-label')||'状态图标');
        return markdown.match(/\]\(([^)]+)\)/)[1];
      },async img=>{const md=await image(img);return md===''?null:(md.match(/\]\(([^)]+)\)/)?.[1]||{text:md.trim()});});
      layouts.push({message_index:messageIndex,kind:'semantic_card',rows:node.querySelectorAll('[data-d-component="row"]').length,output:'local_layout'});
      return protectCode('```chatgpt-layout\n'+JSON.stringify({schema:1,tree},null,2)+'\n```');
    }
    const galleryLayout=await imageRow(node);
    if(galleryLayout!==null)return galleryLayout;
    // Search-result galleries put actual pictures inside clickable buttons.
    // Ignore the button's UI label/icon, not its image descendants.
    if(tag==='button'||node.getAttribute('aria-hidden')==='true'){
      const pictures=[...node.querySelectorAll('img')];
      if(tag==='img')pictures.unshift(node);
      let gallery='';for(const picture of pictures)if(!visitedImages.has(picture))gallery+='\n\n'+await image(picture)+'\n\n';
      if(gallery)return gallery;
      if(tag==='button'&&node.closest('[data-d-component]')&&!/^(运行代码|run code|copy|复制|options|更多)$/i.test(node.textContent.trim()))return '\n'+(await children(node))+'\n';
      return '';
    }
    if(node.matches('.katex-display,.katex')) {
      const tex=node.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
      if(tex){
        const display=displayMath(node),token='\uE100'+pendingMath.size+'\uE101';
        pendingMath.set(token,{display,dom:tex});
        return display?`\n\n${token}\n\n`:token;
      }
    }
    if(tag==='img')return await image(node);
    if(tag==='svg') {
      if(node.closest('.katex,button')||node.getAttribute('aria-hidden')==='true')return '';
      const rect=node.getBoundingClientRect();if(rect.width<48&&rect.height<48)return '';
      try {
        const active=node.querySelector('script,animate,animateMotion,animateTransform,set')||[node,...node.querySelectorAll('*')].some(el=>[...el.attributes].some(a=>/^on/i.test(a.name)));
        let replay='';
        if(active)replay=await htmlSource('<!doctype html><meta charset="utf-8">'+new XMLSerializer().serializeToString(node),'svg_source','SVG 动画或交互（页面绑定的事件仍需核验）');
        return '\n'+addAsset(new TextEncoder().encode(staticSvg(node)),'svg',node.querySelector('title')?.textContent||node.getAttribute('aria-label')||'示意图')+'\n'+replay;
      }catch(e){warnings.push(`SVG 未保存：${e.message}`);return '\n[SVG 未保存]\n';}
    }
    if(tag==='code'){const raw=node.textContent;const fence='`'.repeat(Math.max(0,...(raw.match(/`+/g)||[]).map(s=>s.length))+1);const pad=/^`|`$|^ .* $/.test(raw)?' ':'';return `${fence}${pad}${raw}${pad}${fence}`;}
    if(tag==='iframe')return await frameSource(node);
    if(tag==='canvas'){
      interaction('canvas','missing','只可保存当前画面；未取得绘图程序',node.getAttribute('aria-label')||'画布');
      try{return '\n'+addAsset(Uint8Array.from(atob(node.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0)),'png','画布当前画面（无交互）')+'\n[画布交互未保留：未取得原始绘图程序]\n';}
      catch(error){warnings.push('画布当前画面也未保存：'+error.message);return '\n[画布及其交互未保存]\n';}
    }
    if(tag==='details'){
      interaction('details','native','保留为原生可展开区域');
      const summary=node.querySelector(':scope > summary');
      let body='';for(const child of node.childNodes)if(child!==summary)body+=await convert(child);
      const heading=(summary?.textContent||'展开详情').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '\n\n<details'+(node.open?' open':'')+'>\n<summary>'+heading+'</summary>\n\n'+body.trim()+'\n\n</details>\n\n';
    }
    if(tag==='table') {
      const rows=[];for(const row of node.querySelectorAll('tr')){const cells=[];for(const cell of row.children)cells.push((await children(cell)).trim().replace(/\|/g,'\\|').replace(/\n+/g,'<br>'));if(cells.length)rows.push(cells);}
      if(!rows.length)return '';const count=Math.max(...rows.map(r=>r.length));const line=r=>'| '+Array.from({length:count},(_,i)=>r[i]||'').join(' | ')+' |';
      return '\n\n'+[line(rows[0]),line(Array(count).fill('---')),...rows.slice(1).map(line)].join('\n')+'\n\n';
    }
    if(tag==='ul'||tag==='ol') {
      let result='\n';let i=Number(node.getAttribute('start')||1);
      for(const li of node.children){if(li.tagName!=='LI')continue;const marker=tag==='ol'?`${i++}. `:'- ';result+=marker+(await children(li)).trim().replace(/\n/g,'\n'+' '.repeat(marker.length))+'\n';}return result+'\n';
    }
    const layout=await structuredLayout(node);
    if(layout!==null)return layout;
    const content=await children(node);
    if(/^h[1-6]$/.test(tag))return `\n\n${'#'.repeat(Number(tag[1]))} ${content.trim()}\n\n`;
    if(tag==='br')return '\n';
    if(tag==='strong'||tag==='b'||node.hasAttribute('data-d-default-strong'))return `**${content}**`;
    if(tag==='em'||tag==='i')return `*${content}*`;
    if(tag==='blockquote')return '\n\n'+content.trim().split('\n').map(l=>'> '+l).join('\n')+'\n\n';
    if(tag==='a'){try{const u=new URL(node.getAttribute('href'),location.href);if(['https:','http:'].includes(u.protocol))return `[${content.replace(/\s+/g,' ').trim()||textEscape(u.hostname)}](${u.href.replace(/\(/g,'%28').replace(/\)/g,'%29')})`;}catch{}return content;}
    if(['p','div','section','article','figure','figcaption'].includes(tag)||
      /^(block|flex|grid)$/.test(getComputedStyle(node).display))return '\n\n'+content+'\n\n';
    return content;
  }
  const messages=[];
  const deliveredPrograms=(options.messageSources||[]).filter(pkg=>typeof pkg.code==='string');
  const knownPrograms=new Set(deliveredPrograms.map(pkg=>JSON.stringify([pkg.code,pkg.constants])));
  const pagePrograms=(globalThis.chatgptDilArchive?.read()||[]).filter(pkg=>{
    const identity=JSON.stringify([pkg.code,pkg.constants]);if(knownPrograms.has(identity))return false;knownPrograms.add(identity);return true;
  });
  const dilPackages=[...deliveredPrograms,...pagePrograms],usedDil=new Set();
  const plain=s=>s.replace(/[#*_`\s]/g,'');
  // Keep off-screen loaded messages, but exclude hidden alternative branches.
  const isActive=el=>{
    for(let current=el;current instanceof Element;current=current.parentElement){
      if(current.hidden||current.getAttribute('aria-hidden')==='true'||getComputedStyle(current).display==='none')return false;
    }
    return getComputedStyle(el).visibility!=='hidden';
  };
  const isShown=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&!el.closest('[hidden],[aria-hidden="true"]');};
  const mains=[...document.querySelectorAll('main,[role="main"]')].filter(isShown);
  const root=mains.find(el=>el.querySelector('[data-chatgpt-conversation-selection-target]'))||mains[0]||document;
  const scope=root.querySelector('[data-chatgpt-conversation-selection-target]')||root;
  const roleSelector='[data-message-author-role]';
  const turnSelector='[data-testid^="conversation-turn-"],article[data-turn],article';
  function roleOf(el){
    const declared=el.getAttribute('data-message-author-role')||el.getAttribute('data-turn')||el.querySelector(roleSelector)?.getAttribute('data-message-author-role');
    if(['user','assistant'].includes(declared))return declared;
    const label=[el.getAttribute('aria-label')||'',...Array.from(el.querySelectorAll('h5,h6,.sr-only')).slice(0,4).map(n=>n.textContent)].join(' ').trim();
    if(/you said|you asked|你的提问|您说|你说|你问|用户[:：]/i.test(label))return 'user';
    if(/chatgpt said|chatgpt 说|chatgpt说|助手[:：]/i.test(label))return 'assistant';
    return null;
  }
  let strategy='author-role';
  let candidates=[...scope.querySelectorAll(roleSelector)].filter(isActive).filter(el=>!el.parentElement?.closest(roleSelector)).map(el=>({el,role:roleOf(el)})).filter(x=>x.role);
  if(!candidates.length){
    strategy='chatgpt-conversation-content';
    const user='[data-user-message-bubble]';
    const answer='[data-markdown-text-style]';
    candidates=[...scope.querySelectorAll(`${user},${answer}`)].filter(isActive).filter(el=>!el.parentElement?.closest(`${user},${answer}`)).map(el=>({el,role:el.matches(user)?'user':'assistant'}));
  }
  if(!candidates.length){
    strategy='semantic-turns';
    candidates=[...scope.querySelectorAll(turnSelector)].filter(isActive).filter(el=>!el.parentElement?.closest(turnSelector)).map(el=>({el,role:roleOf(el)})).filter(x=>x.role);
  }
  if(!candidates.length){
    strategy='markdown-fallback';
    candidates=[...scope.querySelectorAll('.markdown,.prose,[data-testid="assistant-message"]')].filter(isActive).filter(el=>!el.parentElement?.closest('.markdown,.prose,[data-testid="assistant-message"]')).map(el=>({el,role:'assistant'}));
    if(candidates.length)warnings.push('页面缺少消息角色标记：仅按回答正文区域保存，可能遗漏用户提问；这不是完整问答归档。');
  }
  for(const {el,role} of candidates){
    const body=role==='user'?(el.querySelector('.whitespace-pre-wrap,[data-search-result-target]')||el):(el.querySelector('.markdown,.prose,[data-message-content]')||el);
    preserveSourceMarkdown=role==='user'&&(/(^|\n)\s*(#{1,6}\s|>\s|[-*]\s)|\*\*[^\n]+\*\*/.test(body.textContent));
    messageIndex=messages.length+1;
    const bodyText=plain(body.innerText||body.textContent);
    const boundId=body.getAttribute('data-obsidian-message-source')||body.closest('[data-obsidian-message-source]')?.getAttribute('data-obsidian-message-source')||body.querySelector('[data-obsidian-message-source]')?.getAttribute('data-obsidian-message-source');
    const delivered=(options.messageSources||[]).find(pkg=>pkg.id===boundId);
    const messageId=el.getAttribute('data-message-id')||el.getAttribute('data-chatgpt-selection-message-id')||el.closest('[data-message-id],[data-chatgpt-selection-message-id]')?.getAttribute('data-message-id')||el.closest('[data-message-id],[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id')||boundId;
    const messagePrograms=dilPackages.filter((pkg,i)=>!usedDil.has(i)&&(pkg.id===boundId||pkg.messageId===messageId||pkg.id===messageId));
    const packageIndex=messagePrograms.length===1?dilPackages.indexOf(messagePrograms[0]):-1;
    mathSources=extractFormulas(delivered?.markdown||'');
    if(!mathSources.length&&packageIndex>=0)mathSources=extractFormulas(dilPackages[packageIndex].fallback);
    pendingMath=new Map();
    originalCodeSources=[];
    if(packageIndex>=0)for(const match of String(dilPackages[packageIndex].fallback||'').matchAll(/(?:^|\n)(`{3,})([^\n]*)\n([\s\S]*?)\n\1(?=\n|$)/g))originalCodeSources.push({language:match[2].trim(),raw:match[3]});
    // Program ownership uses explicit message identities only. No title,
    // control sequence, nearest ancestor or text-length heuristic selects it.
    const view=await globalThis.captureArchiveMessage(el,body,{
      id:messageId||'message-'+messageIndex,role,programs:messagePrograms,
      image:async node=>{const md=await image(node);const name=md.match(/\]\(assets\/([^)]+)\)/)?.[1];return name?{asset:name}:null;},
      warnings,missingAssets,saveHtml:htmlSource,bytes64,packer
    });
    for(const pkg of messagePrograms)usedDil.add(dilPackages.indexOf(pkg));
    archiveMessages.push(view);
    markNativeWidgets(body,view);
    for(const program of view.programs){const item=interaction(program.kind==='dil'?'dil_program':'html_program',program.runtimeVerified&&!program.inspection?.unsupported?.length?'source_saved':'source_saved_dependencies_missing','完整原程序已保存在统一归档包；运行环境与视觉结果见完整归档视图',view.id);item.archive_program={message_id:view.id,program_id:program.id};item.dependencies=program.inspection?.unsupported?.map(u=>u.type)||[];}
    let markdown=(await convert(body)).replace(/\n{3,}/g,'\n\n').trim();
    for(const [token,code] of protectedCode){
      const placeholder=new RegExp('(^[ \\t>]*(?:(?:[-*+]|\\d+\\.)[ \\t]+)?)'+token,'gm');
      markdown=markdown.replace(placeholder,(_match,prefix)=>{
        const continuation=prefix.replace(/(?:[-*+]|\d+\.)[ \t]+$/,marker=>' '.repeat(marker.length));
        return prefix+code.replace(/\n/g,'\n'+continuation);
      });
    }
    markdown=resolveMath(markdown);
    if(!pendingMath.size&&mathSources.length&&role==='assistant')
      warnings.push(`第 ${messageIndex} 条消息的页面未渲染出公式节点，原文含 ${mathSources.length} 条；本次未做替换，请核对。`);
    // Some galleries are siblings of the Markdown body within a message.
    let extra='';
    for(const picture of mediaNodes(el))if(!visitedImages.has(picture)&&!visitedMedia.has(picture)){
      let parent=picture.parentElement,group=null;
      while(parent&&parent!==el&&!parent.contains(body)){
        const row=await imageRow(parent);
        if(row!==null){group=row;break;}
        parent=parent.parentElement;
      }
      extra+='\n\n'+(group===null?await convert(picture):group);
    }
    // Controls outside code are not executable just because their text was saved.
    const controlNodes=[...body.querySelectorAll('input,select,textarea,[role="slider"],[role="radiogroup"],[role="checkbox"],button')].filter(control=>isActive(control)&&!control.closest('pre,code,.cm-editor,.monaco-editor,.CodeMirror,.ace_editor,[data-d-component="CodeBlock"],[data-d-component="code-block"]'));
    for(const control of controlNodes){
      if(messagePrograms.some(pkg=>pkg.runtimeVerified))continue;
      const controlLabel=(control.getAttribute('aria-label')||control.textContent||'').replace(/[\s\u200b-\u200f\ufeff]+/g,' ').trim();
      if(control.matches('button')&&/^(运行代码|run code|copy(?: code)?|复制(?:代码)?|options|更多)$/i.test(controlLabel)&&!control.closest('[data-d-component="select"],[data-d-component="dropdown"]'))continue;
      if(control.matches('button')&&(!control.textContent.trim()||control.querySelector('img')||/^Open /.test(control.getAttribute('aria-label')||'')||/^(copy(?: code)?|复制(?:代码)?|运行代码|run code|options|朗读|点赞|踩|分享|重新生成|编辑)$/i.test(control.textContent.trim())))continue;
      const item=interaction('control','missing','DOM 未包含此控件的事件程序',control.getAttribute('aria-label')||control.labels?.[0]?.textContent||control.textContent.trim()||control.type||control.localName);
      warnings.push(item.id+'：控件“'+item.title+'”未保留原事件程序');
    }
    if(markdown||extra||view.snapshot?.html||view.programs.length)messages.push({role,markdown:markdown+extra,id:view.id,...(typeof delivered?.markdown==='string'?{delivered_markdown:delivered.markdown}:{})});
  }
  for(const message of messages)for(const [token,code] of protectedCode)message.markdown=message.markdown.split(token).join(code);
  if(!messages.length)throw new Error(`正文识别失败（角色节点 ${scope.querySelectorAll(roleSelector).length}，对话节点 ${scope.querySelectorAll(turnSelector).length}，正文区域 ${scope.querySelectorAll('.markdown,.prose').length}；${strategy}）。未保存空笔记。`);
  warnings.push(`正文识别方式：${strategy}；已提取 ${messages.length} 条消息。`);
  const galleryCount=[...scope.querySelectorAll('img')].filter(img=>visitedImages.has(img)).length;
  warnings.push(`已处理 ${galleryCount} 个图片元素；图库未加载的其他图片与原始大图不保证包含在内。`);
  const controls=scope.querySelectorAll('input[type="range"],input[type="radio"],[role="slider"],[role="radiogroup"],select').length;
  if(controls)warnings.push(`检测到 ${controls} 个交互控件；具体保存情况见逐项交互报告，已保存源码仍需核对运行效果。`);
  const unbound=dilPackages.filter((pkg,i)=>!usedDil.has(i));
  if(unbound.length)warnings.push(unbound.length+' 个原程序无法通过消息标识关联，已作为未定位原件保存，未按文字猜测位置。');
  for(const pkg of unbound)missingAssets.push({kind:'program-binding',title:pkg.id||'未定位程序',reason:'原件已保存，但没有可核验的消息标识关联'});
  const archive={schema:2,runtime:'dil-compat/2.0.0',title:document.title.replace(/\s*[-–|]\s*ChatGPT\s*$/,'').trim(),messages:archiveMessages,
    unboundPrograms:unbound.map(pkg=>({id:pkg.id||null,kind:'dil',code:pkg.code,constants:pkg.constants,fallback:pkg.fallback||'',provenance:pkg.provenance||'page',runtimeVerified:!!pkg.runtimeVerified,inspection:pkg.inspection||null,runtimeError:pkg.runtimeError||null})),
    scope:{branch:'current',historyComplete:false,loadedBranchScan:options.sourceCapture?.history||null,visualVerified:false},resources:[]};
  const mime={png:'image/png',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml'};
  for(const asset of assets){
    if(!asset.name.startsWith('image-')&&!asset.name.startsWith('resource-'))continue;
    const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));
    const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    archive.resources.push({name:asset.name,type:asset.resourceType||mime[asset.name.split('.').pop()],sha256});
  }
  totalBytes=assets.reduce((sum,a)=>sum+Math.floor(a.base64.length*3/4),0);
  const archiveBytes=new TextEncoder().encode(JSON.stringify(archive));
  if(archiveBytes.length>MAX_ASSET||totalBytes+archiveBytes.length>MAX_TOTAL)throw Error('完整页面归档超过大小限制，本次未截断保存');
  assets.push({name:'archive-001.json',base64:bytes64(archiveBytes)});totalBytes+=archiveBytes.length;
  const archiveHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',archiveBytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  for(const message of messages)message.markdown=message.markdown.split(widgetHashToken).join(archiveHash);
  return {collector_version:'0.8.2',archive:{schema:2,asset:'assets/archive-001.json',sha256:archiveHash},source_capture:options.sourceCapture||null,interaction_capture:interactions,layout_capture:layouts,missing_assets:missingAssets,source_url:location.origin+location.pathname,title:archive.title||'ChatGPT 学习记录',messages,assets,code_blocks:codeBlocks,warnings:[...new Set(warnings)],captured_at:new Date().toISOString()};
};
