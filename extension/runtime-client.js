
'use strict';
globalThis.inspectArchivePrograms=async sources=>{
 const records=sources.filter(source=>source.code).map((source,index)=>({id:String(index),html:chatgptDilArchive.html(source)}));
 if(!records.length)return [];
 const response=await chrome.runtime.sendNativeMessage('com.local.chatgpt_obsidian',{action:'inspect_programs',records});
 if(!response?.ok)throw Error(response?.error||'原程序离线验证未返回结果');
 if(!Array.isArray(response.results)||response.results.length!==records.length)throw Error('原程序验证结果不完整');
 return records.map(record=>{
  const result=response.results.find(r=>r.id===record.id);
  if(!result?.verified)return {verified:false,error:String(result?.error||'原程序无法运行')};
  const info=result.inspection;
  if(!info||!info.wholeProgram||!Array.isArray(info.nodes)||info.nodes.length>20000||!Array.isArray(info.unsupported))throw Error('完整程序验证结果无效');
  return {verified:true,inspection:info};
 });
};
