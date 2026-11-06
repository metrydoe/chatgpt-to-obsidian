/* Run in MAIN world: read only the document of an editor attached to this page.
   Never enumerate unattached models, read cookies, or call conversation APIs. */
globalThis.readObsidianCodeSources=function(){
  const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&!el.closest('[hidden],[aria-hidden="true"]');};
  const mains=[...document.querySelectorAll('main,[role="main"]')].filter(visible);
  const root=mains.find(el=>el.querySelector('[data-chatgpt-conversation-selection-target]'))||mains[0]||document;
  const scope=root.querySelector('[data-chatgpt-conversation-selection-target]')||root;
  const records=[];
  for(const editor of scope.querySelectorAll('.cm-editor,.CodeMirror,.monaco-editor,.ace_editor')){
    if(!visible(editor))continue;
    if(!editor.closest('[data-message-author-role],[data-user-message-bubble],[data-markdown-text-style],article[data-testid^="conversation-turn-"],.markdown,.prose'))continue;
    const id=editor.getAttribute('data-obsidian-code-id')||crypto.randomUUID();editor.setAttribute('data-obsidian-code-id',id);
    const record={id,status:'unavailable',scope:'attached_editor_model'};
    try{
      let text,lineCount,kind;
      if(editor.matches('.cm-editor')){
        const content=editor.querySelector('.cm-content');
        const view=content?.cmView?.view||content?.cmTile?.view||editor.cmView?.view||editor.cmTile?.view;
        const doc=view?.state?.doc;
        if(doc&&view.dom===editor){text=doc.toString();lineCount=doc.lines;kind='codemirror6_document';}
      }else if(editor.matches('.CodeMirror')&&editor.CodeMirror){
        const cm=editor.CodeMirror;
        if(cm.getWrapperElement()===editor){text=cm.getValue();lineCount=cm.lineCount();kind='codemirror5_document';}
      }else if(editor.matches('.monaco-editor')){
        const associated=globalThis.monaco?.editor?.getEditors?.().find(view=>view.getDomNode()===editor);
        const model=associated?.getModel();
        if(model){
          const version=model.getVersionId();text=model.getValue();lineCount=model.getLineCount();
          if(model.getVersionId()!==version)throw Error('代码在采集期间发生变化');
          kind='monaco_attached_document';
        }
      }else if(editor.matches('.ace_editor')){
        const ace=editor.env?.editor;
        if(ace?.container===editor){text=ace.getValue();lineCount=ace.session.getLength();kind='ace_attached_document';}
      }
      if(typeof text==='string'&&Number.isInteger(lineCount)){
        if(text.length>2_000_000)throw Error('代码文本超过本次限制');
        if(text.split(/\r\n|\r|\n/).length!==lineCount)throw Error('编辑器文档行数校验不一致');
        Object.assign(record,{status:'complete',text,lines:lineCount,characters:text.length,scope:kind});
      }
    }catch(error){record.status='error';record.error=String(error.message||error);}
    records.push(record);
  }
  return records;
};
