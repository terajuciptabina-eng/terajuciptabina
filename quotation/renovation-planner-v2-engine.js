/* TERAJU RENOVATION PLANNER V2 ROUTER
   New room -> Build Planner V2 calculation engine
   Existing room -> Renovation Planner calculation engine
   No duplicated Build rules are stored here.
*/
(function(){
  'use strict';
  if(!/renovationplanner-v2\.html$/i.test(location.pathname)) return;

  const normalizeBuildRoomType = value => {
    const t=String(value||'').trim();
    if(t==='dryKitchen'||t==='wetKitchen'||t==='extensionKitchen') return 'kitchen';
    if(t==='extensionToilet') return 'bathroom';
    return t;
  };

  const roomIsNew = room => {
    const card=document.getElementById(room.roomId);
    return (card?.querySelector('.room-condition')?.value || 'existing') === 'new';
  };

  window.__TERAJU_BUILD_ROOM_FILTER = room => roomIsNew(room);
  window.__TERAJU_BUILD_ROOM_MAP = room => ({...room, roomType:normalizeBuildRoomType(room.roomType)});

  function buildRoomsFromDom(){
    return [...document.querySelectorAll('#roomsContainer .room-card')].map(card => {
      const type=card.querySelector('.room-type')?.value || 'other';
      const name=String(card.querySelector('.room-name')?.value||'').trim();
      const label=name || card.querySelector('.room-type')?.selectedOptions?.[0]?.textContent || 'Area';
      return {
        roomId:card.id,
        roomType:normalizeBuildRoomType(type),
        area:parseFloat(card.querySelector('.room-area')?.value)||0,
        label
      };
    }).filter(room => roomIsNew(room) && room.area>0);
  }

  function combinedQuotationData(){
    const allItems=(typeof getAllItems==='function'?getAllItems():[]);
    const rooms=typeof getRoomGroups==='function'?(getRoomGroups()||[]):buildRoomsFromDom();
    const itemsByRoom={},roomSubtotals={};
    rooms.forEach(r=>{itemsByRoom[r.roomId]=[];roomSubtotals[r.roomId]=0});
    allItems.forEach(item=>{
      if(!itemsByRoom[item.roomId]) itemsByRoom[item.roomId]=[];
      itemsByRoom[item.roomId].push(item);
      roomSubtotals[item.roomId]=(roomSubtotals[item.roomId]||0)+Number(item.amount||0);
    });
    const roomTotal=Object.values(roomSubtotals).reduce((s,v)=>s+v,0);
    const roomGroups=rooms.map(r=>({...r,label:(document.getElementById(r.roomId)?.querySelector('.room-name')?.value||r.label||'Area')}));
    const hasAnyArea=roomGroups.some(r=>r.area>0);
    const prelimRate=typeof RATES!=='undefined' ? Number(RATES.preliminaries)||8500 : 8500;
    const prelimQty=hasAnyArea && typeof excludedItems!=='undefined' && !excludedItems.has('project-preliminaries') ? 1 : 0;
    const projectPreliminaries=prelimQty*prelimRate;
    return {allItems,roomGroups,itemsByRoom,roomSubtotals,prelimQty,prelimRate,projectPreliminaries,total:projectPreliminaries+roomTotal};
  }

  function refresh(){
    try{
      if(typeof window.__TERAJU_GET_BUILD_ITEMS==='function') window.__TERAJU_GET_BUILD_ITEMS();
    }catch(e){console.error('[TERAJU RENOVATION V2 BUILD]',e)}
    try{ if(typeof window.__TERAJU_RENOVATION_V2_RENDER==='function') window.__TERAJU_RENOVATION_V2_RENDER(); }catch(e){}
    try{ if(typeof window.updateEstimate==='function' && window.updateEstimate!==refresh) window.updateEstimate(); }catch(e){}
  }

  window.__TERAJU_RENOVATION_V2_QDATA=combinedQuotationData;
  window.getCurrentQuotationData=combinedQuotationData;

  const originalWindowUpdate=window.updateEstimate;
  window.__TERAJU_RENOVATION_V2_RENDER=()=>{};
  
  document.addEventListener('change',event=>{
    if(event.target?.matches('.room-condition')) {
      const card=event.target.closest('.room-card');
      if(card){
        const label=card.querySelector('.room-name');
        const badge=card.querySelector('.room-condition');
        if(label && !label.value.trim() && event.target.value==='new') label.dispatchEvent(new Event('change',{bubbles:true}));
      }
      setTimeout(refresh,0);
    }
  },true);

  document.addEventListener('input',event=>{
    if(event.target?.matches('.room-condition')) setTimeout(refresh,0);
  },true);

  const observer=new MutationObserver(()=>{
    document.querySelectorAll('.room-card').forEach(card=>{
      const condition=card.querySelector('.room-condition');
      if(condition && !condition.dataset.v2Bound){
        condition.dataset.v2Bound='1';
        condition.addEventListener('change',()=>setTimeout(refresh,0));
      }
    });
  });
  observer.observe(document.getElementById('roomsContainer')||document.body,{childList:true,subtree:true});

  const boot=()=>{
    document.querySelectorAll('.room-card').forEach(card=>{
      const condition=card.querySelector('.room-condition');
      if(condition && !condition.value) condition.value='existing';
    });
    setTimeout(refresh,350);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();