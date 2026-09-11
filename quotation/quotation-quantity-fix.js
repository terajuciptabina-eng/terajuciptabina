(() => {
  'use strict';

  const qs = new URLSearchParams(location.search);
  const isV2 = /buildplanner-v2\.html/i.test(location.pathname);
  const original = 'quotation-quantity-fix-v1.js';

  const loadScript = (src, done) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => done && done();
    s.onerror = () => done && done(new Error('Unable to load ' + src));
    document.head.appendChild(s);
  };

  if (!isV2) {
    loadScript(original);
    return;
  }

  loadScript(original, async (loadErr) => {
    if (loadErr) return;

    const RULES_URL = 'https://raw.githubusercontent.com/terajuciptabina-eng/terajuciptabina/main/quotation/calculation-rules.html';
    const RATES_API = 'https://terajuciptabina.vercel.app/api/rates';

    const moneyRound = v => Math.round((Number(v) || 0) * 100) / 100;
    const ceilQty = v => Math.max(0, Math.ceil(Number(v) || 0));
    const sqftToM2 = v => (Number(v) || 0) * 0.09290304;
    const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
    const parts = path => String(path || '').split('/').map(x => x.trim()).filter(Boolean);

    let liveRules = [];
    let liveRates = null;
    let ready = false;

    function ruleKey(rule, index) {
      return 'rule_' + String(rule.path).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') + '_' + index;
    }

    function legacyRateKey(path) {
      const p = String(path || '').toLowerCase();
      if (p.startsWith('submission of building plan')) return 'permit';
      if (p === 'preliminaries, site mobilisation and project management') return 'prelim';
      const direct = [
        ['footing / concrete','footingConc'],['footing / formwork','footingFw'],['footing / rebar','footingRebar'],
        ['ground slab / concrete','slabConc'],['ground slab / brc','slabBrc'],
        ['ground beam / concrete','beamConc'],['ground beam / formwork','beamFw'],['ground beam / rebar','beamRebar'],
        ['roof beam / concrete','beamConc'],['roof beam / formwork','beamFw'],['roof beam / rebar','beamRebar'],
        ['column / concrete','colConc'],['column / formwork','colFw'],['column / rebar','colRebar'],
        ['flat roof / concrete','flatRoofConc'],['flat roof / formwork','flatRoofFw'],['flat roof / brc','flatRoofBrc'],
        ['metal roofing sheet','metalSheet'],['c-channel','cChannel'],
        ['apron / concrete','apronConc'],['apron / formwork','apronFw'],['apron / brc','apronBrc'],
        ['internal wall','internalWall'],['external wall','externalWall'],
        ['floor tiles / internal','floorTileInt'],['floor tiles / external','floorTileExt'],
        ['painting / internal','paintInt'],['painting / external','paintExt'],
        ['ceiling / internal','ceilingInt'],['ceiling / external','ceilingExt'],
        ['bathroom / wall tiles','bathWallTile'],['bathroom / floor tiles','bathFloorTile'],['bathroom / ceiling','bathCeiling'],
        ['bathroom / piping','bathPiping'],['bathroom / wc','bathWc'],['bathroom / basin','bathBasin'],
        ['bathroom / shower','bathShower'],['bathroom / tap','bathTap'],
        ['water tank','waterTank'],['septic tank','septicTank'],
        ['power point','powerPoint'],['switch','switch'],['lighting','lighting'],['fan','fan'],
        ['aircond','aircond'],['earthing','earthing'],['db box','dbBox'],['wiring','wiring'],
        ['external drain','drainage'],['drainage','drainage'],
        ['doors','door'],['door','door'],['windows','window'],['window','window']
      ];
      for (const [needle,key] of direct) if (p.includes(needle)) return key;
      return null;
    }

    function numFrom(text) {
      const m = String(text || '').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
      return m ? Number(m[0]) : 0;
    }

    function isExcludedRule(rule) {
      const text = JSON.stringify(rule).toLowerCase();
      return text.includes('retired') || text.includes('review') || String(rule.path).toLowerCase().includes('c-channel');
    }

    async function loadSource() {
      const rr = await fetch(RULES_URL, {cache:'no-store'});
      if (!rr.ok) throw new Error('Calculation Rules unavailable');
      const html = await rr.text();
      const match = html.match(/const\s+rules\s*=\s*(\[[\s\S]*?\]);/);
      if (!match) throw new Error('Calculation Rules data not found');
      liveRules = Function('return ' + match[1])().filter(r => r && r.group && r.path && r.description && r.output);
      try {
        const rrates = await fetch(RATES_API, {cache:'no-store'});
        if (rrates.ok) {
          const data = await rrates.json();
          liveRates = data.rateSet?.rates || {};
        }
      } catch (_) {}
      ready = true;
    }

    function getRate(rule,index) {
      const key = ruleKey(rule,index);
      if (liveRates && Object.prototype.hasOwnProperty.call(liveRates,key)) return moneyRound(liveRates[key]);
      const legacy = legacyRateKey(rule.path);
      if (legacy && typeof RATES !== 'undefined' && Object.prototype.hasOwnProperty.call(RATES,legacy)) return moneyRound(RATES[legacy]);
      return 0;
    }

    function context() {
      const rooms = typeof getRoomGroupsBase === 'function' ? getRoomGroupsBase().filter(r => Number(r.area) > 0) : [];
      const mainRooms = rooms.filter(r => r.roomType !== 'porch');
      const porches = rooms.filter(r => r.roomType === 'porch');
      const bathrooms = mainRooms.filter(r => r.roomType === 'bathroom');
      const bedrooms = mainRooms.filter(r => r.roomType === 'bedroom');
      const kitchens = mainRooms.filter(r => r.roomType === 'kitchen');
      const livingDining = mainRooms.filter(r => r.roomType === 'living' || r.roomType === 'dining');
      const mainArea = mainRooms.reduce((s,r) => s + Number(r.area || 0),0);
      const porchArea = porches.reduce((s,r) => s + Number(r.area || 0),0);
      const bathArea = bathrooms.reduce((s,r) => s + Number(r.area || 0),0);
      return {rooms,mainRooms,porches,bathrooms,bedrooms,kitchens,livingDining,mainArea,porchArea,bathArea,mainAreaM2:sqftToM2(mainArea),porchAreaM2:sqftToM2(porchArea),bathAreaM2:sqftToM2(bathArea)};
    }

    function itemBase(rule,index,qty,rate,extra={}) {
      const p = parts(rule.path);
      const rawHierarchy = p.slice(1,-1);
      const hierarchy = rawHierarchy.filter((name, idx) => !(idx === 0 && String(name).toUpperCase() === String(rule.group).toUpperCase()));
      return {id:'rule-item-'+index,ruleIndex:index,ruleKey:ruleKey(rule,index),category:rule.group.toLowerCase(),description:rule.description,unit:rule.output,qty:moneyRound(qty),rate:moneyRound(rate),amount:moneyRound(qty*rate),path:rule.path,hierarchy,groupKey:hierarchy.join(' / ') || rule.group,groupTitle:hierarchy.join(' / ') || rule.group,roomId:extra.roomId || 'project',room:extra.room || 'Project',rule};
    }

    function add(items,rule,index,qty,ctx,extra={}) {
      const q = Number(qty) || 0;
      if (q <= 0) return;
      const rate = getRate(rule,index);
      const item = itemBase(rule,index,q,rate,extra);
      if (typeof customQuantities !== 'undefined' && customQuantities.has(item.id)) item.qty = Number(customQuantities.get(item.id)) || item.qty;
      if (typeof customRates !== 'undefined' && customRates.has(item.id)) item.rate = Number(customRates.get(item.id)) || 0;
      if (typeof customDescriptions !== 'undefined' && customDescriptions.has(item.id)) item.description = customDescriptions.get(item.id);
      item.qty = ceilQty(item.qty);
      item.amount = moneyRound(item.qty * item.rate);
      items.push(item);
      return item;
    }

    function ruleQuantity(rule,ctx,produced) {
      const path = String(rule.path), lower = path.toLowerCase(), method = String(rule.method || '').toUpperCase(), coeff = numFrom(rule.coeff);
      if (method === 'FIXED PROJECT' || /1\s*(?:×|x)\s*project/i.test(rule.formula)) return 1;
      if (method === 'FIXED PER MAIN DOOR') return 1;
      if (method === 'FIXED PER KITCHEN') return ctx.kitchens.length;
      if (method === 'FIXED PER BEDROOM') return ctx.bedrooms.length;
      if (method === 'FIXED PER BATHROOM') return ctx.bathrooms.length;
      if (method === 'FIXED PER ROOM') return /power point|switch/i.test(path) ? ctx.mainRooms.length * coeff : ctx.mainRooms.length;
      if (method === 'FIXED PER PORCH') return ctx.porches.length;
      if (method === 'FIXED PER ELIGIBLE AREA') return ctx.mainRooms.filter(r => !['kitchen','bathroom'].includes(r.roomType)).length;
      if (method === 'FIXED PER APPLICABLE LOCATION') {
        if (/doors \/ type 1/i.test(path)) return ctx.mainRooms.filter(r => ['living','bedroom','kitchen'].includes(r.roomType)).length;
        if (/doors \/ type 2/i.test(path)) return ctx.livingDining.length;
        return 0;
      }
      if (method === 'FIXED PER DESIGNATED AREA') return 0;
      if (method === 'AREA ALLOWANCE') {
        if (/porch/i.test(path)) return ctx.porches.reduce((s,r) => s + Math.ceil(Number(r.area||0)/100),0);
        return ctx.mainRooms.reduce((s,r) => s + Math.ceil(Number(r.area||0)/100),0);
      }
      if (method === 'AREA / COEFFICIENT') return /wiring/i.test(path) ? (ctx.mainArea + ctx.porchArea) * coeff : (/porch/i.test(path) ? ctx.porchArea : ctx.mainArea) * coeff;
      if (method === 'BASELINE COEFFICIENT' || method === 'COEFFICIENT' || method === 'SAME AS MAIN BUILDING') return /porch/i.test(path) ? ctx.porchArea * coeff : ctx.mainArea * coeff;
      if (method === 'THICKNESS') {
        if (/flat roof/i.test(lower)) return 0;
        return (/porch/i.test(lower) ? ctx.porchAreaM2 : ctx.mainAreaM2) * coeff;
      }
      if (method === 'LAYER') {
        if (/flat roof|apron/i.test(lower)) return 0;
        return (/porch/i.test(lower) ? ctx.porchAreaM2 : ctx.mainAreaM2) * coeff;
      }
      if (method === 'POUNDAGE') {
        const parent = parts(path).slice(0,-1).join(' / ').toLowerCase();
        const concrete = produced.find(x => parts(x.path).slice(0,-1).join(' / ').toLowerCase() === parent && /concrete/i.test(x.path));
        return concrete ? Number(concrete._rawQty || concrete.qty) * coeff : 0;
      }
      if (method === 'DEPENDENCY') {
        if (/internal floor tiles/i.test(lower)) return Math.max(0,ctx.mainAreaM2-ctx.bathAreaM2);
        if (/internal painting/i.test(lower)) {
          const wall = produced.find(x => /brickwall \/ internal wall/i.test(String(x.path||'')));
          return wall ? Number(wall._rawQty || wall.qty) : 0;
        }
        if (/external painting/i.test(lower)) {
          const wall = produced.find(x => /brickwall \/ external wall/i.test(String(x.path||'')));
          return wall ? Number(wall._rawQty || wall.qty) : 0;
        }
        if (/internal ceiling/i.test(lower)) return Math.max(0,ctx.mainAreaM2-ctx.bathAreaM2);
        return 0;
      }
      if (method === 'AREA') return 0;
      if (method === 'PERIMETER × HEIGHT' || method === 'PERIMETER' || method === 'OVERHANG AREA × THICKNESS' || method === 'ROOF GEOMETRY') return 0;
      if (/power point/i.test(path)) return /porch/i.test(path) ? ctx.porches.length : ctx.mainRooms.length * coeff;
      if (/switch/i.test(path)) return ctx.mainRooms.length * coeff;
      if (/lighting/i.test(path)) return /porch/i.test(path) ? ctx.porches.reduce((s,r)=>s+Math.ceil(Number(r.area||0)/100),0) : ctx.mainRooms.reduce((s,r)=>s+Math.ceil(Number(r.area||0)/100),0);
      if (/fan/i.test(path)) return /porch/i.test(path) ? ctx.porches.length : ctx.mainRooms.filter(r=>!['kitchen','bathroom'].includes(r.roomType)).length;
      if (/aircond/i.test(path)) return 0;
      if (/doors \/ type 1/i.test(path)) return ctx.mainRooms.filter(r=>['living','bedroom','kitchen'].includes(r.roomType)).length;
      if (/doors \/ type 2/i.test(path)) return ctx.livingDining.length;
      if (/doors \/ type 3/i.test(path)) return ctx.bathrooms.length;
      if (/doors \/ type 4/i.test(path)) return 1;
      if (/windows \/ type 1/i.test(path)) return ctx.bedrooms.length;
      if (/windows \/ type 2/i.test(path)) return ctx.kitchens.length;
      if (/windows \/ type 3/i.test(path)) return ctx.bathrooms.length;
      return 0;
    }

    function buildItems() {
      const ctx = context(), items = [];
      liveRules.forEach((rule,index) => {
        if (isExcludedRule(rule)) return;
        const lower = String(rule.path).toLowerCase();
        const qty = ruleQuantity(rule,ctx,items);
        if (rule.group === 'ARCHITECTURES' && /bathroom \/ floor tiles|bathroom \/ ceiling/i.test(lower)) {
          ctx.bathrooms.forEach(room => { const q=sqftToM2(room.area); if(q>0) add(items,rule,index,q,ctx,{roomId:room.roomId,room:room.label}); });
          return;
        }
        if (qty > 0) { const item=add(items,rule,index,qty,ctx); if(item)item._rawQty=qty; }
      });
      if (typeof manualItems !== 'undefined') for (const [target,list] of manualItems.entries()) (list||[]).forEach(x => { const room=x.roomId&&x.roomId!=='project'?ctx.rooms.find(r=>r.roomId===x.roomId):null; items.push({...x,id:x.id,category:x.category||'custom',description:x.description,unit:x.unit||'ls',qty:ceilQty(x.qty),rate:moneyRound(x.rate),amount:moneyRound(ceilQty(x.qty)*moneyRound(x.rate)),roomId:x.roomId||'project',room:room?.label||'Project',path:'CUSTOM / '+(x.groupTitle||'Additional Item'),hierarchy:[x.groupTitle||'Additional Item']}); });
      return items;
    }

    function applyItemEdits(items) {
      return items.filter(i => !(typeof excludedItems !== 'undefined' && excludedItems.has(i.id))).map(i => {
        if (typeof customQuantities !== 'undefined' && customQuantities.has(i.id)) i.qty=ceilQty(customQuantities.get(i.id));
        if (typeof customRates !== 'undefined' && customRates.has(i.id)) i.rate=moneyRound(customRates.get(i.id));
        if (typeof customDescriptions !== 'undefined' && customDescriptions.has(i.id)) i.description=customDescriptions.get(i.id);
        i.amount=moneyRound(i.qty*i.rate); return i;
      });
    }

    function renderRuleEstimate(items) {
      const c=document.getElementById('estimateContent'); if(!c)return;
      const customer=document.getElementById('customerName')?.value||'Not specified',location=document.getElementById('projectLocation')?.value||'Not specified',declared=Number(document.getElementById('builtUpArea')?.value)||0,rooms=context().rooms,roomsArea=rooms.reduce((s,r)=>s+Number(r.area||0),0),total=items.reduce((s,i)=>s+Number(i.amount||0),0);
      document.getElementById('customerSummary').innerHTML=`<div><p class="text-gray-500">Customer</p><p class="font-medium">${esc(customer)}</p></div><div><p class="text-gray-500">Location</p><p class="font-medium">${esc(location)}</p></div><div><p class="text-gray-500">Built-up / Rooms</p><p class="font-medium">${ceilQty(declared)} sqft declared · ${ceilQty(roomsArea)} sqft rooms</p></div><div><p class="text-gray-500">Estimate Type</p><p class="font-medium">Preliminary Construction Estimate</p></div>`;
      const row=i=>`<tr class="border-b align-top"><td class="py-3 px-2">${IS_CONTRACTOR?`<textarea class="w-full border rounded-lg px-3 py-2 bg-white" onchange="editItemDescription('${i.id}',this.value)">${esc(i.description)}</textarea>`:`<div class="homeowner-locked py-2 rounded-lg">${esc(i.description)}</div>`}</td><td class="py-3 px-2">${esc(i.unit)}</td><td class="py-3 px-2"><input type="number" min="0" step="1" value="${ceilQty(i.qty)}" class="w-24 border rounded-lg px-2 py-2 text-right contractor-editable" onchange="editItemQuantity('${i.id}',this.value)"><div class="homeowner-locked text-right py-2">${ceilQty(i.qty)}</div></td><td class="py-3 px-2"><input type="number" min="0" step="0.01" value="${moneyRound(i.rate).toFixed(2)}" class="w-28 border rounded-lg px-2 py-2 text-right contractor-editable" onchange="editItemRate('${i.id}',this.value)"><div class="homeowner-locked text-right py-2">${moneyRound(i.rate).toFixed(2)}</div></td><td class="py-3 px-2 text-right font-medium">${moneyRound(i.amount).toFixed(2)}</td><td class="py-3 px-2"><button type="button" onclick="excludeItem('${i.id}')" class="text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs">Delete</button></td></tr>`;
      const sections=[];
      for(const item of items){const group=item.category.toUpperCase();let sec=sections.find(x=>x.group===group);if(!sec){sec={group,nodes:[]};sections.push(sec)}let node=sec;const hierarchy=Array.isArray(item.hierarchy)&&item.hierarchy.length?item.hierarchy:[item.groupTitle||''];hierarchy.forEach(name=>{if(!name)return;let n=node.nodes.find(x=>x.name===name);if(!n){n={name,nodes:[],items:[]};node.nodes.push(n)}node=n});node.items.push(item)}
      const heading=title=>`<tr class="quotation-section-row"><td colspan="6" class="py-3 px-2">${esc(title)}</td></tr>`,subheading=(title,level=0)=>`<tr class="quotation-subsection-row"><td colspan="6" class="py-2 px-2" style="padding-left:${8+level*18}px">${esc(title)}</td></tr>`;
      let h='<table class="w-full border-collapse text-sm detailed-quotation-table"><colgroup><col style="width:32%"><col style="width:8%"><col style="width:13%"><col style="width:15%"><col style="width:20%"><col style="width:12%"></colgroup><thead><tr class="border-b-2 text-left"><th>Description</th><th>Unit</th><th>Quantity</th><th>Rate (RM)</th><th>Amount (RM)</th><th>Action</th></tr></thead><tbody>';
      function renderNodes(nodes,level){let out='';nodes.forEach(n=>{out+=subheading(n.name,level);out+=n.items.map(row).join('');out+=renderNodes(n.nodes,level+1)});return out}
      sections.forEach(sec=>{h+=heading(sec.group);h+=renderNodes(sec.nodes,0)});
      h+=`</tbody><tfoot><tr class="border-t-2"><td colspan="4" class="py-4 px-2 text-right font-bold">TOTAL</td><td class="py-4 px-2 text-right font-bold text-lg">${moneyRound(total).toFixed(2)}</td><td class="contractor-only"></td></tr></tfoot></table>`;
      c.innerHTML=h;document.getElementById('grandTotal').textContent=moneyRound(total).toFixed(2);document.getElementById('totalBuiltArea').textContent=ceilQty(declared)+' sqft';document.getElementById('roomsTotalArea').textContent=ceilQty(roomsArea)+' sqft';
    }

    const originalGetAllItems=window.getAllItems;
    window.getAllItems=function(){if(!ready)return typeof originalGetAllItems==='function'?originalGetAllItems():[];return applyItemEdits(buildItems())};
    const originalUpdateEstimate=window.updateEstimate;
    window.updateEstimate=function(){if(!ready)return originalUpdateEstimate?.();if(typeof syncBuiltUpAreaFromRooms==='function')syncBuiltUpAreaFromRooms();const items=window.getAllItems();renderRuleEstimate(items);if(typeof saveContractorState==='function')saveContractorState()};

    try { await loadSource(); window.updateEstimate(); } catch(err) { console.error('[TERAJU V2] Calculation Rules engine failed:',err); }
  });
})();