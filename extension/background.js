// Fetch image hosts explicitly granted to this extension by the user.
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!['fetchImage','fetchResource'].includes(message?.action))return false;
  (async()=>{
    const caller=new URL(sender.tab?.url||'about:blank');
    const source=new URL(message.url);
    if(!['chatgpt.com','chat.openai.com'].includes(caller.hostname)||!/^\/(?:c|share)\//.test(caller.pathname))throw new Error('不是对话页面');
    if(!['https:','http:'].includes(source.protocol))throw new Error('不支持的图片地址');
    const allowed=await chrome.permissions.contains({origins:[source.origin+'/*']});
    if(!allowed)throw new Error(`图片网站未授权：${source.hostname}，请点击“允许图片网站并归档”`);
    const response=await fetch(source.href,{credentials:'omit',redirect:'follow',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const reader=response.body.getReader();let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw new Error('图片超过 8 MB');chunks.push(value);}}
    finally{await reader.cancel();}
    let raw='';for(const chunk of chunks)for(let i=0;i<chunk.length;i+=8192)raw+=String.fromCharCode(...chunk.subarray(i,i+8192));
    return {ok:true,base64:btoa(raw),type:(response.headers.get('content-type')||'').split(';')[0]};
  })().then(respond).catch(e=>respond({ok:false,error:e.message}));
  return true;
});
