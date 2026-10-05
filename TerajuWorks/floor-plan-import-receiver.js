<style id="tc-floor-plan-import-loading">
#tcFloorPlanImportLoading{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .18s ease}
#tcFloorPlanImportLoading.is-visible{opacity:1;pointer-events:auto}
#tcFloorPlanImportLoading .tc-fp-loader-card{width:min(420px,calc(100vw - 32px));padding:28px;border-radius:22px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.28);text-align:center}
#tcFloorPlanImportLoading .tc-fp-spinner{width:42px;height:42px;margin:0 auto 16px;border:4px solid #e5e7eb;border-top-color:#172033;border-radius:50%;animation:tcFpSpin .8s linear infinite}
#tcFloorPlanImportLoading .tc-fp-title{font-size:18px;font-weight:900;color:#172033}
#tcFloorPlanImportLoading .tc-fp-detail{margin-top:7px;font-size:13px;color:#64748b;line-height:1.5}
#tcFloorPlanImportLoading .tc-fp-progress{height:6px;margin-top:18px;border-radius:999px;background:#e5e7eb;overflow:hidden}
#tcFloorPlanImportLoading .tc-fp-progress>span{display:block;height:100%;width:0;background:#172033;border-radius:999px;transition:width .18s ease}
@keyframes tcFpSpin{to{transform:rotate(360deg)}}
</style>
<script>
(function(){
  const plannerType=(new URLSearchParams(location.search).get('plannerType')||(/renovationplanner-v2\.html$/i.test(location.pathname)?'renovation':'build')).toLowerCase()==='renovation'?'renovation':'build';
  const isRenovation=plannerType==='renovation';
  const plannerName=isRenovation?'RenovationPlanner':'BuildPlanner';
  const plannerVersion=isRenovation?'RenovationPlanner V2':'BuildPlanner V2';
  let raw=null;
  try{raw=sessionStorage.getItem('teraju.floorplan.import.pending.v1')}catch(e){}
  if(!raw)return;
  let payload=null;
  try{payload=JSON.parse(raw)}catch(e){console.error('[TERAJU FLOOR PLAN IMPORT] Invalid pending payload',e);sessionStorage.removeItem('teraju.floorplan.import.pending.v1');return}
  if(!payload||payload.version!==1||!Array.isArray(payload.rooms)||!payload.rooms.length)return;

  const createLoader=()=>{
    if(document.getElementById('tcFloorPlanImportLoading'))return document.getElementById('tcFloorPlanImportLoading');
    const el=document.createElement('div');
    el.id='tcFloorPlanImportLoading';
    el.innerHTML='<div class="tc-fp-loader-card" role="status" aria-live="polite"><div class="tc-fp-spinner"></div><div class="tc-fp-title">Importing floor plan…</div><div class="tc-fp-detail" id="tcFpImportDetail">Preparing reviewed rooms for BuildPlanner.</div><div class="tc-fp-progress"><span id="tcFpImportProgress"></span></div></div>';
    document.body.appendChild(el);
    return el;
  };
  const showLoader=()=>{
    const el=createLoader();
    requestAnimationFrame(()=>el.classList.add('is-visible'));
    return el;
  };
  const updateLoader=(current,total)=>{
    const detail=document.getElementById('tcFpImportDetail');
    const progress=document.getElementById('tcFpImportProgress');
    if(detail)detail.textContent='Processing room/area '+current+' of '+total+'…';
    if(progress)progress.style.width=Math.round((current/Math.max(total,1))*100)+'%';
  };
  const hideLoader=()=>{
    const el=document.getElementById('tcFloorPlanImportLoading');
    if(!el)return;
    el.classList.remove('is-visible');
    setTimeout(()=>el.remove(),220);
  };
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  const enterReviewMode=()=>{
    if(typeof window.showBuildBudgetPending==='function')window.showBuildBudgetPending();
  };

  const wait=async()=>{
    const hasQuotation=!!new URLSearchParams(location.search).get('quotationId');
    const ready=typeof addRoom==='function'&&typeof updateEstimate==='function'&&document.getElementById('roomsContainer')&&(!hasQuotation||isRenovation?typeof window.tcQuotationRecords!=='undefined':(window.tcQuotationRecords&&typeof window.tcQuotationRecords.persistRoomSchedule==='function'));
    if(!ready){setTimeout(wait,100);return}
    const existing=document.querySelectorAll('#roomsContainer .room-card').length;
    let importContext=null;
    try{importContext=JSON.parse(sessionStorage.getItem('teraju.floorplan.import.context.v1')||'null')}catch(e){}
    const replaceBecauseStartedEmpty=importContext?.version===1&&Number(importContext.roomCount)===0;
    if(replaceBecauseStartedEmpty&&existing){
      document.getElementById('roomsContainer').innerHTML='';
      if(typeof customRoomLabels!=='undefined'&&customRoomLabels instanceof Map)customRoomLabels.clear();
      if(typeof updateRoomsEmptyState==='function')updateRoomsEmptyState();
    }else if(existing&&!window.__TERAJU_FLOORPLAN_IMPORT_CONFIRMED){
      const ok=confirm('Import '+payload.rooms.length+' reviewed room/area entries from the floor plan into the existing '+plannerName+' list?\\n\\nOK = Add to existing rooms\\nCancel = Do not import');
      if(!ok){sessionStorage.removeItem('teraju.floorplan.import.pending.v1');sessionStorage.removeItem('teraju.floorplan.import.context.v1');return}
      window.__TERAJU_FLOORPLAN_IMPORT_CONFIRMED=true;
    }

    const validRooms=payload.rooms.filter(r=>String(r.name||'').trim()&&Number(r.area)>0);
    if(!validRooms.length){
      sessionStorage.removeItem('teraju.floorplan.import.pending.v1');
      sessionStorage.removeItem('teraju.floorplan.import.context.v1');
      alert('No valid floor plan room/area entries were imported.');
      return;
    }

    if(isRenovation){ if(typeof showRenovationBudgetPending==='function')showRenovationBudgetPending('Floor plan rooms imported. Review the room type, Existing / New condition and sqft, then click Save Room / Area.'); } else if(typeof window.showBuildBudgetPending==='function'){ window.showBuildBudgetPending(); }
    showLoader();
    await nextFrame();
    await nextFrame();

    let imported=0;
    const stamp=Date.now();
    for(let index=0;index<validRooms.length;index++){
      const r=validRooms[index];
      updateLoader(index+1,validRooms.length);
      await nextFrame();
      const name=String(r.name||'').trim(),area=Number(r.area)||0,type=String(r.roomTypeKey||'other');
      const originalIndex=payload.rooms.indexOf(r);
      const id='ai-floorplan-'+stamp+'-'+originalIndex;
      try{
        if(isRenovation){ addRoom(type,area,id,name,'existing'); } else { addRoom(type,area,id,name); }
        const card=document.getElementById(id),nameInput=card?.querySelector('.room-name');
        if(nameInput){
          nameInput.value=name;
          nameInput.dataset.generated='false';
          if(typeof customRoomLabels!=='undefined'&&customRoomLabels instanceof Map)customRoomLabels.set(id,name);
        }
        imported++;
      }catch(e){console.error('[TERAJU FLOOR PLAN IMPORT] Room import failed',r,e)}
    }

    if(imported){
      try{
        updateEstimate();
        if(typeof saveContractorState==='function')saveContractorState();
        if(hasQuotation && !isRenovation){
          const importedRooms=[...document.querySelectorAll('#roomsContainer .room-card')].map(room=>({
            id:room.id,
            type:room.querySelector('.room-type')?.value||'other',
            condition:room.querySelector('.room-condition')?.value||'existing',
            name:room.querySelector('.room-name')?.value||'',
            area:room.querySelector('.room-area')?.value||''
          }));
          const persisted=await window.tcQuotationRecords.persistRoomSchedule(importedRooms);
          if(!persisted)throw new Error('Imported Room / Area could not be persisted to the existing Cost Estimate.');
        }
        if(isRenovation && typeof window.saveRenovationRoomAreaState==='function'){
          const saved=await window.saveRenovationRoomAreaState();
          if(!saved)throw new Error('Imported Room / Area could not be saved to RenovationPlanner.');
        }
      }catch(e){console.error('[TERAJU FLOOR PLAN IMPORT] Finalize failed',e);throw e}
      sessionStorage.removeItem('teraju.floorplan.import.pending.v1');
      sessionStorage.removeItem('teraju.floorplan.import.context.v1');
      const rooms=document.getElementById('roomsContainer');
      rooms?.scrollIntoView({behavior:'smooth',block:'start'});
      updateLoader(imported,imported);
      const detail=document.getElementById('tcFpImportDetail');
      const title=document.querySelector('#tcFloorPlanImportLoading .tc-fp-title');
      if(title)title.textContent='Import complete';
      if(detail)detail.textContent=imported+' room/area entries added to '+plannerName+'.';
      await new Promise(resolve=>setTimeout(resolve,500));
      hideLoader();
      setTimeout(()=>alert('Floor plan import complete: '+imported+' room/area entries added to '+plannerName+'.'),250);
    }else{
      sessionStorage.removeItem('teraju.floorplan.import.pending.v1');
      sessionStorage.removeItem('teraju.floorplan.import.context.v1');
      hideLoader();
      alert('No valid floor plan room/area entries were imported.');
    }
  };

  const hasQuotationId=!!new URLSearchParams(location.search).get('quotationId');
  if(hasQuotationId){
    const startAfterRestore=()=>{
      if(window.__TERAJU_QUOTATION_RESTORE_COMPLETE===true){setTimeout(wait,50);return}
      window.addEventListener('teraju:quotation-restore-complete',()=>setTimeout(wait,50),{once:true});
    };
    startAfterRestore();
  }else{
    setTimeout(wait,150);
  }
})();
</script>
