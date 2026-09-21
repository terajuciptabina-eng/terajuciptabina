/* TERAJU RENOVATION PLANNER V2
   Single routing layer:
   Existing room -> Renovation Planner rules/items
   New room      -> Build Planner V2 rules/items
   The Build engine supplies calculation data only; Renovation V2 owns its renderer.
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

  const roomGroups = () => typeof getRoomGroups === 'function' ? (getRoomGroups() || []) : [];
  const conditionOf = roomId =>
    document.getElementById(roomId)?.querySelector('.room-condition')?.value || 'existing';

  // Build engine consumes these two functions; no Build rules are duplicated here.
  window.__TERAJU_BUILD_ROOM_FILTER = room => conditionOf(room.roomId) === 'new';
  window.__TERAJU_BUILD_ROOM_MAP = room => ({...room, roomType:normalizeBuildRoomType(room.roomType)});

  function newRoomIds(){
    return new Set(
      roomGroups()
        .filter(room => conditionOf(room.roomId)==='new' && Number(room.area)>0)
        .map(room => room.roomId)
    );
  }

  function renovationItems(){
    const original=window.__TERAJU_RENOVATION_V1_GET_ALL_ITEMS;
    if(typeof original!=='function') return [];
    return original().filter(item => conditionOf(item.roomId)!=='new');
  }

  function buildItems(){
    const ids=newRoomIds();
    if(!ids.size || typeof window.__TERAJU_GET_BUILD_ITEMS!=='function') return [];
    return window.__TERAJU_GET_BUILD_ITEMS().filter(item => {
      const path = String(item.masterPath || "");
      const isExistingMainDoor = /DOORS\\s*\\/\\s*Type 4\\s+Double Leaf Main Door/i.test(path);
      return (ids.has(item.roomId) || String(item.roomId||'project')==='project') &&
        String(item.category||'').toLowerCase() !== 'external-work' &&
        String(item.category||'').toLowerCase() !== 'preliminaries' &&
        !isExistingMainDoor;
    });
  }

  function renovationProjectData(){
    const original=window.__TERAJU_RENOVATION_V1_GET_CURRENT_QUOTATION_DATA;
    if(typeof original!=='function') return {prelimQty:0,prelimRate:0,projectPreliminaries:0};
    const data=original() || {};
    return {
      prelimQty:Number(data.prelimQty)||0,
      prelimRate:Number(data.prelimRate)||0,
      projectPreliminaries:Number(data.projectPreliminaries)||0
    };
  }

  function allItems(){
    return [...renovationItems(),...buildItems()]
      .map(item=>{
      item.qty=typeof normalizeQuantity==='function'?normalizeQuantity(item.qty):Math.max(0,Math.ceil(Number(item.qty)||0));
      item.rate=typeof normalizeRate==='function'?normalizeRate(item.rate):Math.round((Number(item.rate)||0)*100)/100;
      item.amount=Math.round((item.qty*item.rate+Number.EPSILON)*100)/100;
      return item;
    });
  }

  function quotationData(){
    const rooms=roomGroups();
    const active=allItems().filter(item=>!(typeof excludedItems!=='undefined'&&excludedItems.has(item.id)));
    const renovationPrelim=renovationProjectData();
    const prelimQty=renovationPrelim.prelimQty;
    const prelimRate=renovationPrelim.prelimRate;
    const projectPreliminaries=renovationPrelim.projectPreliminaries;
    const itemsByRoom={},roomSubtotals={};
    rooms.forEach(room=>{itemsByRoom[room.roomId]=[];roomSubtotals[room.roomId]=0});
    active.forEach(item=>{
      if(!itemsByRoom[item.roomId])itemsByRoom[item.roomId]=[];
      itemsByRoom[item.roomId].push(item);
      roomSubtotals[item.roomId]=(roomSubtotals[item.roomId]||0)+Number(item.amount||0);
    });
    const roomTotal=Object.values(roomSubtotals).reduce((s,v)=>s+v,0);
    return {allItems:active,roomGroups:rooms,itemsByRoom,roomSubtotals,prelimQty,prelimRate,projectPreliminaries,total:projectPreliminaries+roomTotal};
  }

  function update(){
    if(typeof window.syncRenovationBuildingSpecification==='function') window.syncRenovationBuildingSpecification();
    const rooms=roomGroups();
    const items=allItems();
    const active=items.filter(item=>!(typeof excludedItems!=='undefined'&&excludedItems.has(item.id)));
    const renovationPrelim=renovationProjectData();
    const prelimQty=renovationPrelim.prelimQty;
    const prelimRate=renovationPrelim.prelimRate;
    const projectPreliminaries=renovationPrelim.projectPreliminaries;
    const roomSubtotals={};
    rooms.forEach(room=>roomSubtotals[room.roomId]=0);
    active.forEach(item=>roomSubtotals[item.roomId]=(roomSubtotals[item.roomId]||0)+Number(item.amount||0));
    const roomTotal=Object.values(roomSubtotals).reduce((s,v)=>s+v,0);
    if(typeof renderEstimate==='function')renderEstimate(active,rooms,roomSubtotals,projectPreliminaries,projectPreliminaries+roomTotal);
  }

  window.__TERAJU_RENOVATION_V2_GET_ALL_ITEMS=allItems;
  window.__TERAJU_RENOVATION_V2_GET_QUOTATION_DATA=quotationData;
  window.__TERAJU_RENOVATION_V2_UPDATE_ESTIMATE=update;
  window.__TERAJU_RENOVATION_V2_BUILD_READY=update;

  window.getAllItems=allItems;
  window.getCurrentQuotationData=quotationData;
  window.updateEstimate=update;

  document.addEventListener('change',event=>{
    if(event.target?.matches('.room-condition'))setTimeout(update,0);
  },true);
  document.addEventListener('input',event=>{
    if(event.target?.matches('.room-condition'))setTimeout(update,0);
  },true);

  const observer=new MutationObserver(()=>{
    document.querySelectorAll('#roomsContainer .room-card').forEach(card=>{
      const condition=card.querySelector('.room-condition');
      if(condition&&!condition.dataset.v2RoutingBound){
        condition.dataset.v2RoutingBound='1';
        condition.addEventListener('change',()=>setTimeout(update,0));
      }
    });
  });
  observer.observe(document.getElementById('roomsContainer')||document.body,{childList:true,subtree:true});

  const boot=()=>{
    document.querySelectorAll('#roomsContainer .room-card').forEach(card=>{
      const condition=card.querySelector('.room-condition');
      if(condition&&!condition.value)condition.value='existing';
    });
    update();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();