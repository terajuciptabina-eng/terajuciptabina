/* TERAJU RENOVATION PLANNER V2
   Single calculation source:
   Existing room -> Renovation Planner rules source
   New room      -> Build Planner V2 rules/items
   Budget + Preview consume the same V2 quotation data.
*/
(function(){
  'use strict';
  if(!/renovationplanner-v2\.html$/i.test(location.pathname)) return;

  const renovationRules = () =>
    Array.isArray(window.TerajuRenovationCalculationRules)
      ? window.TerajuRenovationCalculationRules
      : [];

  const roomGroups = () =>
    typeof getRoomGroups === 'function' ? (getRoomGroups() || []) : [];

  const conditionOf = roomId =>
    document.getElementById(roomId)?.querySelector('.room-condition')?.value || 'existing';

  const normalizeBuildRoomType = value => {
    const t=String(value||'').trim();
    if(t==='dryKitchen'||t==='wetKitchen'||t==='extensionKitchen') return 'kitchen';
    if(t==='extensionToilet') return 'bathroom';
    return t;
  };

  const RULE_GROUPS = {
    living: 'LIVING / DINING',
    bedroom: 'BEDROOM',
    dryKitchen: 'DRY KITCHEN',
    wetKitchen: 'WET KITCHEN',
    bathroom: 'BATHROOM',
    porch: 'CAR PORCH',
    balcony: 'BALCONY'
  };

  const RULE_KEYS = {
    'Plaster Ceiling':'ceiling',
    'SPC Flooring':'spc',
    'Downlight':'downlight',
    'Ceiling Fan':'fan',
    'Curtain Box LED':'curtain',
    'Bar Lamp':'barlamp',
    'Kitchen Frame':'frame',
    'Making Good':'makinggood',
    'Swing Glass Door':'glassdoor',
    'Floor Tiles':'floor',
    'Wall Tiles':'walltile',
    'Kitchen Lighting':'lamp',
    'Sanitary Accessories':'sanitary',
    'Toilet Door':'door',
    'Exhaust Fan':'exhaust',
    'Gate + Motor':'gate',
    'Brickwall Divider':'divider',
    'Front Fence':'fence',
    'Facade Wall':'facade',
    'Wall Light':'walllight'
  };

  const RULE_RATES = {
    'Plaster Ceiling':'ceiling',
    'SPC Flooring':'spc',
    'Downlight':'downlight',
    'Ceiling Fan':'ceilingFan',
    'Curtain Box LED':'curtainBoxLED',
    'Bar Lamp':'barLamp',
    'Kitchen Frame':'kitchenFrame',
    'Making Good':'kitchenMakingGood',
    'Swing Glass Door':'kitchenGlassDoor',
    'Floor Tiles':'floorTile',
    'Wall Tiles':'wallTile',
    'Kitchen Lighting':'barLamp',
    'Sanitary Accessories':'bathroomSanitary',
    'Toilet Door':'bathroomDoor',
    'Exhaust Fan':'exhaustFan',
    'Gate + Motor':'gateMotor',
    'Brickwall Divider':'brickwallDivider',
    'Front Fence':'frontFence',
    'Facade Wall':'facadeWall',
    'Wall Light':'wallLight'
  };

  const lastPathName = path => {
    const parts=String(path||'').split('/').map(v=>v.trim()).filter(Boolean);
    return parts[parts.length-1] || '';
  };

  const ruleKey = path => {
    const name=lastPathName(path);
    return RULE_KEYS[name] || name.toLowerCase().replace(/[^a-z0-9]+(.)/g,(m,c)=>c.toUpperCase()).replace(/[^a-zA-Z0-9]/g,'');
  };

  const ruleRate = (rule,index) => {
    const path=String(rule?.[1]||'').trim();
    const key=lastPathName(path);
    const legacyRateKey=RULE_RATES[key];
    const rates=typeof RATES!=='undefined' ? RATES : {};
    const master=window.TerajuRenovationRateMaster;
    const canonicalKey=master?.canonicalKey?.(rule,index);
    if(canonicalKey&&Object.prototype.hasOwnProperty.call(rates,canonicalKey)) return Number(rates[canonicalKey])||0;
    return Number(legacyRateKey ? rates[legacyRateKey] : master?.defaultRate?.(rule)) || 0;
  };

  function calculateRuleQuantity(formula, area){
    const f=String(formula||'').trim();
    const a=Number(area)||0;
    if(!a) return 0;
    if(/^Quantity\s*=\s*Room Area$/i.test(f)) return a;
    let m=f.match(/^Quantity\s*=\s*Room Area\s*[×x*]\s*([0-9.]+)$/i);
    if(m) return a*Number(m[1]);
    m=f.match(/^Quantity\s*=\s*MAX\(\s*([0-9.]+)\s*,\s*CEILING\(Room Area\s*\/\s*([0-9.]+)\)\s*\)$/i);
    if(m) return Math.max(Number(m[1]),Math.ceil(a/Number(m[2])));
    if(/^Quantity\s*=\s*1$/i.test(f)) return 1;
    return 0;
  }

  function applyOverrides(item){
    const rates=typeof RATES!=='undefined' ? RATES : {};
    if(typeof customRates!=='undefined' && customRates.has(item.id)) item.rate=customRates.get(item.id);
    if(typeof customQuantities!=='undefined' && customQuantities.has(item.id)) item.qty=customQuantities.get(item.id);
    if(typeof customDescriptions!=='undefined' && customDescriptions.has(item.id)) item.description=customDescriptions.get(item.id);
    item.qty=typeof normalizeQuantity==='function'
      ? normalizeQuantity(item.qty)
      : Math.max(0,Math.ceil(Number(item.qty)||0));
    item.rate=typeof normalizeRate==='function'
      ? normalizeRate(item.rate)
      : Math.round((Number(item.rate)||0)*100)/100;
    item.amount=Math.round((item.qty*item.rate+Number.EPSILON)*100)/100;
    return item;
  }

  // Build engine consumes these two functions; no Build rules are duplicated here.
  window.__TERAJU_BUILD_ROOM_FILTER = room => conditionOf(room.roomId) === 'new';
  window.__TERAJU_BUILD_ROOM_MAP = room => ({...room, roomType:normalizeBuildRoomType(room.roomType)});

  function renovationStandardItems(){
    const rules=renovationRules();
    if(!rules.length) return [];

    return roomGroups()
      .filter(room => conditionOf(room.roomId)==='existing' && Number(room.area)>0)
      .flatMap(room => {
        const group=RULE_GROUPS[room.roomType];
        if(!group) return [];
        return rules
          .filter(rule => String(rule?.[0]||'').trim()===group)
          .map(rule => {
            const path=String(rule?.[1]||'').trim();
            const itemName=lastPathName(path);
            const key=ruleKey(path);
            const ruleIndex=rules.indexOf(rule);
            const masterRateKey=window.TerajuRenovationRateMaster?.canonicalKey?.(rule,ruleIndex)||'';
            const qty=calculateRuleQuantity(rule?.[5],room.area);
            const globalRate=ruleRate(rule,ruleIndex);
            const item={
              id:room.roomId+'-'+key,
              roomId:room.roomId,
              room:room.label,
              roomType:room.roomType,
              description:String(rule?.[2]||itemName),
              qty,
              unit:String(rule?.[6]||''),
              rate:globalRate,
              globalRate,
              masterPath:path,
              masterRateKey,
              plannerType:'renovation',
              optional:false
            };
            return applyOverrides(item);
          })
          .filter(item => item.qty>0);
      });
  }

  function renovationManualItems(){
    const result=[];
    if(typeof manualItems==='undefined' || !manualItems?.get) return result;

    roomGroups().forEach(room => {
      if(conditionOf(room.roomId)!=='existing' || Number(room.area)<=0) return;
      (manualItems.get(room.roomId)||[]).forEach(source => {
        const item={...source,roomId:room.roomId,room:room.label,roomType:room.roomType};
        result.push(applyOverrides(item));
      });
    });

    // Contractor-added Build Planner items live in a dedicated manualItems bucket
    // per top-level construction group. They are part of the same V2 item stream.
    const buildGroupMeta = {
      'STRUCTURES': { category:'structures', room:'Project / New Construction' },
      'ARCHITECTURES': { category:'architecture', room:'Project / New Construction' },
      'ELECTRICAL': { category:'electrical', room:'Project / New Construction' },
      'DOORS & WINDOWS': { category:'doors-windows', room:'Project / New Construction' }
    };
    Object.entries(buildGroupMeta).forEach(([group, meta]) => {
      const key = '__build__:' + group;
      (manualItems.get(key)||[]).forEach(source => {
        const item = {
          ...source,
          manualKey:key,
          roomId:'project',
          room:meta.room,
          category:meta.category,
          group
        };
        result.push(applyOverrides(item));
      });
    });

    (manualItems.get('__prelim__')||[]).forEach(source => {
      const item={...source,roomId:'__prelim__',room:'Project / Preliminaries'};
      result.push(applyOverrides(item));
    });

    return result;
  }

  function renovationOptionalProjectItems(){
    if(typeof OPTIONAL_SCOPES==='undefined') return [];
    const result=[];
    document.querySelectorAll('#projectOptionalWorks .optional-scope').forEach(scopeEl=>{
      const checkbox=scopeEl.querySelector('.optional-check');
      if(!checkbox?.checked) return;
      const key=scopeEl.dataset.scope;
      const definition=OPTIONAL_SCOPES.find(scope=>scope.key===key);
      if(!definition) return;

      let rate=definition.rate;
      if(definition.custom){
        rate=parseFloat(scopeEl.querySelector('.optional-rate')?.value)||0;
        if(rate<=0) return;
      }

      result.push(applyOverrides({
        id:'project-optional-'+key,
        roomId:'project',
        room:'Project / Optional Works',
        roomType:'project',
        description:definition.label,
        qty:1,
        unit:definition.unit,
        rate,
        optional:true
      }));
    });
    return result;
  }

  function renovationItems(){
    return [
      ...renovationStandardItems(),
      ...renovationManualItems(),
      ...renovationOptionalProjectItems()
    ];
  }

  function buildItems(){
    const ids=new Set(
      roomGroups()
        .filter(room => conditionOf(room.roomId)==='new' && Number(room.area)>0)
        .map(room => room.roomId)
    );
    if(!ids.size || typeof window.__TERAJU_GET_BUILD_ITEMS!=='function') return [];

    return window.__TERAJU_GET_BUILD_ITEMS().filter(item=>{
      const path=String(item.masterPath||'');
      const isExistingMainDoor=/DOORS\s*\/\s*Type 4\s+Double Leaf Main Door/i.test(path);
      return (ids.has(item.roomId) || String(item.roomId||'project')==='project') &&
        String(item.category||'').toLowerCase()!=='external-work' &&
        String(item.category||'').toLowerCase()!=='preliminaries' &&
        !isExistingMainDoor;
    });
  }

  function renovationProjectData(){
    const hasAnyArea=roomGroups().some(room=>Number(room.area)>0);
    const excluded=typeof excludedItems!=='undefined' ? excludedItems : new Set();
    const qty=hasAnyArea && !excluded.has('project-preliminaries')
      ? (typeof customQuantities!=='undefined' && customQuantities.has('project-preliminaries')
          ? customQuantities.get('project-preliminaries') : 1)
      : 0;
    const rates=typeof RATES!=='undefined' ? RATES : {};
    const rate=hasAnyArea && !excluded.has('project-preliminaries')
      ? (typeof customRates!=='undefined' && customRates.has('project-preliminaries')
          ? customRates.get('project-preliminaries') : rates.preliminaries)
      : 0;
    const prelimQty=typeof normalizeQuantity==='function' ? normalizeQuantity(qty) : Math.max(0,Math.ceil(Number(qty)||0));
    const prelimRate=typeof normalizeRate==='function' ? normalizeRate(rate) : Math.round((Number(rate)||0)*100)/100;
    const projectPreliminaries=Math.round((prelimQty*prelimRate+Number.EPSILON)*100)/100;
    return {prelimQty,prelimRate,projectPreliminaries};
  }

  function allItems(){
    return [...renovationItems(),...buildItems()].map(item=>{
      item.qty=typeof normalizeQuantity==='function'?normalizeQuantity(item.qty):Math.max(0,Math.ceil(Number(item.qty)||0));
      item.rate=typeof normalizeRate==='function'?normalizeRate(item.rate):Math.round((Number(item.rate)||0)*100)/100;
      item.amount=Math.round((item.qty*item.rate+Number.EPSILON)*100)/100;
      return item;
    });
  }

  function quotationData(){
    const rooms=roomGroups();
    const excluded=typeof excludedItems!=='undefined' ? excludedItems : new Set();
    const active=allItems().filter(item=>!excluded.has(item.id));
    const renovationPrelim=renovationProjectData();
    const itemsByRoom={},roomSubtotals={};
    rooms.forEach(room=>{
      itemsByRoom[room.roomId]=[];
      roomSubtotals[room.roomId]=0;
    });
    active.forEach(item=>{
      if(!itemsByRoom[item.roomId]) itemsByRoom[item.roomId]=[];
      itemsByRoom[item.roomId].push(item);
      roomSubtotals[item.roomId]=(roomSubtotals[item.roomId]||0)+Number(item.amount||0);
    });
    const roomTotal=Object.values(roomSubtotals).reduce((s,v)=>s+v,0);
    return {
      allItems:active,
      roomGroups:rooms,
      itemsByRoom,
      roomSubtotals,
      prelimQty:renovationPrelim.prelimQty,
      prelimRate:renovationPrelim.prelimRate,
      projectPreliminaries:renovationPrelim.projectPreliminaries,
      total:renovationPrelim.projectPreliminaries+roomTotal
    };
  }

  function update(){
    if(typeof window.syncRenovationBuildingSpecification==='function') window.syncRenovationBuildingSpecification();

    const rooms=roomGroups();
    const items=allItems();
    const excluded=typeof excludedItems!=='undefined' ? excludedItems : new Set();
    const active=items.filter(item=>!excluded.has(item.id));
    const renovationPrelim=renovationProjectData();
    const roomSubtotals={};
    rooms.forEach(room=>roomSubtotals[room.roomId]=0);
    active.forEach(item=>{
      roomSubtotals[item.roomId]=(roomSubtotals[item.roomId]||0)+Number(item.amount||0);
    });
    const roomTotal=Object.values(roomSubtotals).reduce((s,v)=>s+v,0);
    if(typeof renderEstimate==='function'){
      renderEstimate(
        active,
        rooms,
        roomSubtotals,
        renovationPrelim.projectPreliminaries,
        renovationPrelim.projectPreliminaries+roomTotal
      );
    }
  }

  window.__TERAJU_RENOVATION_V2_GET_ALL_ITEMS=allItems;
  window.__TERAJU_RENOVATION_V2_GET_QUOTATION_DATA=quotationData;
  window.__TERAJU_RENOVATION_V2_UPDATE_ESTIMATE=update;
  window.__TERAJU_RENOVATION_V2_BUILD_READY=update;

  window.getAllItems=allItems;
  window.getCurrentQuotationData=quotationData;
  window.updateEstimate=update;

  document.addEventListener('change',event=>{
    if(event.target?.matches('.room-condition')) setTimeout(update,0);
  },true);
  document.addEventListener('input',event=>{
    if(event.target?.matches('.room-condition')) setTimeout(update,0);
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
      if(condition&&!condition.value) condition.value='existing';
    });
    update();
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();