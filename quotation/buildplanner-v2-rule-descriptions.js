(function(){
  'use strict';
  if(!/buildplanner-v2\.html$/i.test(location.pathname))return;
  if(window.__terajuV2RuleDescriptions)return;
  window.__terajuV2RuleDescriptions=true;

  let descriptions=new Map();

  function extractRules(source){
    const marker='const rules=[';
    const start=source.indexOf(marker);
    if(start<0)throw new Error('Calculation Rules array not found');
    let i=start+marker.length-1,depth=0,quote=null,escaped=false;
    for(;i<source.length;i++){
      const ch=source[i];
      if(quote){
        if(escaped)escaped=false;
        else if(ch==='\\')escaped=true;
        else if(ch===quote)quote=null;
        continue;
      }
      if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue}
      if(ch==='[')depth++;
      else if(ch===']'){
        depth--;
        if(depth===0){
          const literal=source.slice(start+marker.length-1,i+1);
          return Function('"use strict";return '+literal)();
        }
      }
    }
    throw new Error('Calculation Rules array is incomplete');
  }

  async function load(){
    const response=await fetch('calculation-rules.html?source=master&v=20260912',{cache:'no-store'});
    if(!response.ok)throw new Error('Unable to load Calculation Rules');
    const source=await response.text();
    const rules=extractRules(source);
    descriptions=new Map((rules||[]).map(r=>[String(r?.path||''),String(r?.description||'')]).filter(([path,description])=>path&&description));
  }

  function normalizePath(value){
    return String(value||'').replace(/\s+—\s+.*$/,'').trim();
  }

  function apply(){
    const container=document.getElementById('estimateContent');
    if(!container||!descriptions.size)return;
    const rows=container.querySelectorAll('tr[data-rule-item-id]');
    rows.forEach(row=>{
      const textarea=row.querySelector('textarea');
      if(!textarea)return;
      let pathRow=row.previousElementSibling;
      while(pathRow&&!pathRow.classList.contains('quotation-subsection-row'))pathRow=pathRow.previousElementSibling;
      if(!pathRow)return;
      const path=normalizePath(pathRow.textContent);
      const full=descriptions.get(path);
      if(!full)return;
      textarea.value=full;
      textarea.readOnly=true;
      textarea.setAttribute('aria-readonly','true');
      textarea.title='Description locked to Calculation Rules — Global Master Source of Truth';
      textarea.removeAttribute('onchange');
    });
  }

  async function init(){
    try{await load();apply();}catch(err){console.error('[TERAJU V2 rule descriptions]',err)}
    const container=document.getElementById('estimateContent');
    if(!container)return;
    let scheduled=false;
    const observer=new MutationObserver(()=>{
      if(scheduled)return;
      scheduled=true;
      requestAnimationFrame(()=>{scheduled=false;apply()});
    });
    observer.observe(container,{childList:true,subtree:true});
  }

  if(document.readyState!=='loading')init();
  else document.addEventListener('DOMContentLoaded',init,{once:true});
})();
