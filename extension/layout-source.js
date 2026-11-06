/* Serializable static layout. No script, event attributes or arbitrary CSS. */
globalThis.readObsidianLayout=async function(node,saveSvg,saveImage){
 const props=['display','flexDirection','flexWrap','alignItems','justifyContent','gap','rowGap','columnGap','flexGrow','flexShrink','flexBasis','gridTemplateColumns','alignSelf','textAlign','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','color','backgroundColor','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft'];
 let count=0;
 async function walk(el,root=false){
  if(++count>1600)throw Error('布局节点超过限制');
  if(el.nodeType===Node.TEXT_NODE)return {text:el.textContent};
  if(el.nodeType!==Node.ELEMENT_NODE||['script','style','nav'].includes(el.localName)||el.hidden)return null;
  const css=getComputedStyle(el);if(css.display==='none'||css.visibility==='hidden')return null;
  if(el.localName==='svg')return {tag:'img',src:await saveSvg(el),alt:el.getAttribute('aria-label')||'',style:{width:Math.round(el.getBoundingClientRect().width)+'px',height:Math.round(el.getBoundingClientRect().height)+'px',flexShrink:'0'}};
  if(el.localName==='img'){
   const saved=await saveImage(el);
   if(!saved)return null; // An intentionally omitted favicon is not a broken image.
   if(typeof saved==='object')return saved;
   return {tag:'img',src:saved,alt:el.alt||'',style:{maxWidth:'100%'}};
  }
  const tag=['p','span','strong','em','b','i','br','h1','h2','h3','h4','h5','h6','ul','ol','li'].includes(el.localName)?el.localName:'div';
  const style={};for(const key of props){const value=css[key];if(value&&!/url\(|expression|@import/i.test(value))style[key]=value;}
  // Computed grid tracks are pixels; preserve the number of columns responsively.
  if(css.display==='grid'){const columns=css.gridTemplateColumns.split(/\s+/).length;style.gridTemplateColumns='repeat('+columns+',minmax(0,1fr))';}
  if(root){style.width='100%';style.maxWidth='100%';}
  else if(parseFloat(css.width)>0&&parseFloat(css.width)<=80){style.width=css.width;style.minWidth=css.width;}
  style.margin='0';style.boxSizing='border-box';
  const children=[];for(const child of el.childNodes){const value=await walk(child);if(value)children.push(value);}
  return {tag,style,children};
 }
 return await walk(node,true);
};
