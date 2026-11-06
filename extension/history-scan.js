'use strict';
// Loading is generic scroll/identity accounting. It does not infer missing
// conversation text from nearby messages or invent a backend history count.
globalThis.scanLoadedConversation=async function(){
  if(document.querySelector('[data-testid="stop-button"],[data-testid="stop-generating-button"]'))throw Error('回答仍在生成，请完成后再归档');
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const roots=[...document.querySelectorAll('main,[role="main"]')].filter(n=>{const box=n.getBoundingClientRect();return box.width>0&&box.height>0;});
  const main=roots.find(n=>n.querySelector('[data-chatgpt-conversation-selection-target]'))||roots[0]||document.body;
  const root=main.querySelector('[data-chatgpt-conversation-selection-target]')||main;
  const turnMode=!!root.querySelector('[data-turn-key]');
  const selector=turnMode?'[data-turn-key]':'[data-message-id],[data-chatgpt-selection-message-id]';
  const identity=node=>turnMode?'turn:'+node.getAttribute('data-turn-key'):node.getAttribute('data-message-id')||node.getAttribute('data-chatgpt-selection-message-id');
  const active=node=>{for(let current=node;current&&current!==root;current=current.parentElement)if(current.hidden||current.getAttribute('aria-hidden')==='true'||getComputedStyle(current).display==='none')return false;return true;};
  const nodes=()=>[...root.querySelectorAll(selector)].filter(active);
  const initial=nodes();
  if(!initial.length)throw Error('页面没有可核验的消息标识，无法确认滚动采集是否遗漏，本次未写入不完整归档');
  const ancestors=[];for(let node=root.parentElement;node;node=node.parentElement)ancestors.push(node);
  const candidates=[root,...ancestors,...root.querySelectorAll('div')].filter(node=>node.clientHeight>100&&node.scrollHeight>node.clientHeight+2&&/auto|scroll/.test(getComputedStyle(node).overflowY)&&initial.every(n=>node.contains(n)));
  let scroller=candidates[0]||document.scrollingElement;
  if(!candidates.length&&root.scrollHeight>scroller.clientHeight+30&&scroller.scrollHeight<=scroller.clientHeight+2)throw Error('未能定位实际对话滚动容器，无法验证历史消息，本次未写入归档');
  const originalTop=scroller.scrollTop,initialHeight=scroller.scrollHeight;
  const seen=new Set(initial.map(identity)),firstVisible=initial.find(n=>n.getBoundingClientRect().bottom>0),anchor=firstVisible?{id:identity(firstVisible),top:firstVisible.getBoundingClientRect().top}:null;
  let topStable=0,bottomStable=0,virtualized=false,steps=0;
  const sample=()=>{const current=new Set(nodes().map(identity));for(const id of seen)if(!current.has(id))virtualized=true;for(const id of current)seen.add(id);};
  try{
    for(;steps<500&&topStable<3;steps++){
      const before=scroller.scrollHeight;scroller.scrollTop=Math.max(0,scroller.scrollTop-Math.max(200,scroller.clientHeight*.8));await sleep(scroller.scrollTop<=1?350:80);sample();
      if(scroller.scrollTop<=1&&scroller.scrollHeight===before)topStable++;else topStable=0;
      if(virtualized)break;
    }
    if(virtualized)throw Error('页面在滚动时卸载了已见消息，单次 DOM 采集无法保证完整；本次已停止，未保存残缺对话');
    if(topStable<3)throw Error('历史消息加载未稳定或超过扫描上限，本次未写入归档');
    for(;steps<1000&&bottomStable<3;steps++){
      const before=scroller.scrollHeight;scroller.scrollTop=Math.min(scroller.scrollHeight,scroller.scrollTop+Math.max(200,scroller.clientHeight*.8));await sleep(scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-2?350:80);sample();
      if(scroller.scrollTop+scroller.clientHeight>=scroller.scrollHeight-2&&scroller.scrollHeight===before)bottomStable++;else bottomStable=0;
      if(virtualized)break;
    }
    if(virtualized)throw Error('页面卸载了较早的消息，无法确认全量采集，本次未写入归档');
    if(bottomStable<3)throw Error('对话底部尚未加载稳定，本次未写入归档');
    if(root.querySelector('[aria-busy="true"],[role="progressbar"]'))throw Error('对话仍在加载，本次未写入归档');
    return {strategy:'scroll-message-identities',identityUnit:turnMode?'turn':'message',seenMessages:seen.size,retainedMessages:nodes().length,topStable:true,bottomStable:true,virtualized:false,loadedBranchStable:true,backendHistoryVerified:false,initialHeight,finalHeight:scroller.scrollHeight};
  }finally{
    if(anchor){const current=nodes().find(n=>identity(n)===anchor.id);if(current)scroller.scrollTop+=current.getBoundingClientRect().top-anchor.top;else scroller.scrollTop=originalTop;}
    else scroller.scrollTop=originalTop;
  }
};
