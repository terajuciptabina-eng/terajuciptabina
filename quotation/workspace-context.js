/* TERAJU WORKS — same-origin workspace navigation context.
   This is navigation state only, not an authentication store. */
(()=> {
  const KEY='teraju.workspace.context.v1';
  const p=new URLSearchParams(location.search);
  const roleRaw=(p.get('role')||p.get('audience')||'').toLowerCase();
  const role=roleRaw==='homeowner'?'homeowner':roleRaw==='contractor'?'contractor':'';
  const id=String(p.get('id')||p.get(role==='contractor'?'contractorId':'homeownerId')||'').trim().toUpperCase();
  const typeRaw=(p.get('plannerType')||'').toLowerCase();
  const plannerType=typeRaw==='renovation'?'renovation':typeRaw==='build'?'build':'';
  const quotationId=String(p.get('quotationId')||'').trim();
  let saved=null;
  try{saved=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{}
  const context={
    role:role||saved?.role||'',
    id:id||saved?.id||'',
    plannerType:plannerType||saved?.plannerType||'',
    quotationId:quotationId||saved?.quotationId||''
  };
  if(context.id&&context.role){
    try{sessionStorage.setItem(KEY,JSON.stringify(context))}catch{}
  }
  window.TERAJU_WORKSPACE_CONTEXT=context;
})();