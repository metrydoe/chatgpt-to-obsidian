// Structural metadata only: deliberately exclude text, href/src, input values,
// message IDs, arbitrary data attributes, and serialized page HTML.
globalThis.obsidianStructureDiagnostic = function () {
  const rows=[];let shadowRoots=0;
  const selected='main,[role="main"],[data-message-author-role],article,.markdown,.prose';
  function walk(root,parent=-1,depth=0){
    for(const el of root.children||[]){
      if(rows.length>=4000)return;
      const tag=el.tagName.toLowerCase();
      if(['script','style','link','meta','head','svg','path'].includes(tag))continue;
      const r=el.getBoundingClientRect();
      const index=rows.length;
      rows.push({parent,tag,depth,classes:Array.from(el.classList).slice(0,16),
        role:el.getAttribute('role'),testid:el.getAttribute('data-testid'),
        author:el.getAttribute('data-message-author-role'),
        attributes:el.getAttributeNames().filter(n=>n.startsWith('data-')),
        childCount:el.children.length,textLength:(el.textContent||'').length,
        visible:r.width>0&&r.height>0,width:Math.round(r.width),height:Math.round(r.height)});
      if(el.shadowRoot){shadowRoots++;walk(el.shadowRoot,index,depth+1);}
      walk(el,index,depth+1);
    }
  }
  walk(document.body);
  return {version:'0.1.2',readyState:document.readyState,shadowRoots,
    counts:Object.fromEntries(selected.split(',').map(s=>[s,document.querySelectorAll(s).length])),
    frames:document.querySelectorAll('iframe').length,rows,truncated:rows.length>=4000};
};
