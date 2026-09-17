/* TERAJU WORKS — Build Planner V2 hierarchy renderer
   Display-only hierarchy normalization. Calculation, rates and item state remain untouched. */
(function(){
  'use strict';
  if(!/buildplanner-v2\.html$/i.test(location.pathname))return;

  const CATEGORY_ORDER=[
    ['preliminaries','PRELIMINARIES'],
    ['structures','STRUCTURAL WORKS'],
    ['architecture','ARCHITECTURAL WORKS'],
    ['electrical','ELECTRICAL WORKS'],
    ['doors-windows','DOORS & WINDOWS'],
    ['external-work','EXTERNAL WORKS']
  ];

  const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));

  function categoryOf(item){
    const c=String(item?.category||'').toLowerCase();
    if(c==='preliminaries')return'preliminaries';
    if(c==='structures')return'structures';
    if(c==='architecture')return'architecture';
    if(c==='electrical')return'electrical';
    if(c==='doors-windows'||c==='doors & windows'||c==='doors_windows')return'doors-windows';
    if(c==='external-work'||c==='external work'||c==='external_work')return'external-work';
    return c;
  }

  function pathParts(item){
    return String(item?.masterPath||'').split('/').map(x=>x.trim()).filter(Boolean);
  }

  function hierarchy(item){
    const p=pathParts(item);
    // Global Calculation Rules owns the hierarchy. The leaf is the item itself;
    // only its parent path levels become hierarchy rows.
    if(p.length>1)return p.slice(0,-1);

    // Manual contractor items do not have a masterPath. Keep them under the
    // same target group already selected by the contractor.
    const c=categoryOf(item);
    if(c==='structures')return[item.groupTitle||'Structural Works'];
    if(c==='architecture')return[item.room||'Architectural Works'];
    if(c==='electrical')return[item.groupTitle||'Electrical Works'];
    return[];
  }

  function itemKey(item,index){
    return String(item?.id||'')||`__item_${index}`;
  }

  function rowItemId(row){
    const el=row.querySelector('[data-item-id],[data-id],[data-budget-item-id]');
    return el?.getAttribute('data-item-id')||el?.getAttribute('data-budget-item-id')||el?.getAttribute('data-id')||row.getAttribute('data-item-id')||row.getAttribute('data-budget-item-id')||row.getAttribute('data-id')||'';
  }

  function normalizeDescription(v){return String(v||'').replace(/\s+/g,' ').trim().toLowerCase()}

  function mapRows(table,items){
    const rows=[...table.querySelectorAll('tbody tr')].filter(r=>r.querySelector('.cr-description'));
    const byId=new Map();
    rows.forEach(r=>{const id=rowItemId(r);if(id)byId.set(id,r)});
    const byText=new Map();
    rows.forEach(r=>{
      const d=normalizeDescription(r.querySelector('.cr-description')?.textContent);
      const u=normalizeDescription(r.querySelector('.cr-unit')?.textContent);
      const key=d+'|'+u;
      if(!byText.has(key))byText.set(key,[]);
      byText.get(key).push(r);
    });
    const used=new Set();
    const mapped=[];
    items.forEach((item,index)=>{
      let row=byId.get(String(item.id||''));
      if(!row){
        const key=normalizeDescription(item.description)+'|'+normalizeDescription(item.unit);
        const q=byText.get(key)||[];
        row=q.find(x=>!used.has(x));
      }
      if(!row){
        const d=normalizeDescription(item.description);
        row=rows.find(x=>!used.has(x)&&normalizeDescription(x.querySelector('.cr-description')?.textContent)===d);
      }
      if(row){used.add(row);mapped.push({item,row,index})}
    });
    return mapped.length===rows.length?mapped:null;
  }

  function hierarchyRow(level,text){
    const safe=esc(text);
    return `<tr class="cr-hierarchy-row cr-level-${level}"><td colspan="6">${safe}</td></tr>`;
  }

  function groupRow(title,count){
    return `<tr class="cr-group-row"><td colspan="6">${esc(title)}<span class="cr-group-count">${count} item${count===1?'':'s'}</span></td></tr>`;
  }

  function applyHierarchy(){
    const container=document.getElementById('constructionBudgetContent');
    const table=container?.querySelector('table.cr-budget-table');
    if(!table||typeof window.getAllItems!=='function')return;

    const all=window.getAllItems()||[];
    const active=all.filter(i=>typeof excludedItems==='undefined'||!excludedItems.has(i.id));
    if(!active.length)return;

    const mapped=mapRows(table,active);
    if(!mapped)return;

    const anchors=[...table.querySelectorAll('[data-manual-anchor]')];
    const special=[...table.querySelectorAll('tbody tr')].filter(r=>!r.querySelector('.cr-description')&&!r.classList.contains('cr-group-row')&&!r.classList.contains('cr-hierarchy-row'));

    const byId=new Map(mapped.map(x=>[itemKey(x.item,x.index),x.row]));
    const tbody=table.tBodies[0];
    if(!tbody)return;

    const frag=document.createDocumentFragment();
    let number=1;

    CATEGORY_ORDER.forEach(([cat,title])=>{
      const members=mapped.filter(x=>categoryOf(x.item)===cat);
      if(!members.length)return;
      frag.appendChild(document.createRange().createContextualFragment(groupRow(title,members.length)));

      const groups=[];
      const seen=new Map();
      members.forEach(entry=>{
        const levels=hierarchy(entry.item);
        const key=levels.join(' / ');
        if(!seen.has(key)){
          const g={levels,items:[]};
          seen.set(key,g);groups.push(g);
        }
        seen.get(key).items.push(entry);
      });

      groups.forEach(g=>{
        g.levels.forEach((level,idx)=>frag.appendChild(document.createRange().createContextualFragment(hierarchyRow(idx+2,level))));
        g.items.forEach(entry=>{
          const row=byId.get(itemKey(entry.item,entry.index));
          if(row){
            const first=row.querySelector('td:first-child');
            if(first&&!row.querySelector('[data-item-id]')&&!row.querySelector('[data-budget-item-id]')){
              const n=first.querySelector('input')?null:null;
              if(!n&&/^\d+$/.test(first.textContent.trim()))first.textContent=String(number++);
            }else number++;
            frag.appendChild(row);
          }
        });
      });

      anchors.filter(a=>{
        const key=a.getAttribute('data-manual-anchor')||'';
        if(cat==='preliminaries')return key==='prelim';
        if(cat==='electrical')return key==='electrical';
        if(cat==='structures')return key.startsWith('structures:');
        if(cat==='architecture')return key.startsWith('room:');
        return false;
      }).forEach(a=>{
        const holder=document.createElement('tr');
        holder.className='no-print';
        const td=document.createElement('td');td.colSpan=6;td.className='py-1 px-2';
        td.appendChild(a);holder.appendChild(td);frag.appendChild(holder);
      });
    });

    // Keep non-item control rows (for example removed-item controls) at the end.
    special.forEach(row=>frag.appendChild(row));
    tbody.replaceChildren(frag);
    container.setAttribute('data-hierarchy-normalized','1');
  }

  function install(){
    if(typeof window.renderConstructionBudget!=='function'||typeof window.getAllItems!=='function')return false;
    if(window.renderConstructionBudget.__terajuV2Hierarchy)return true;
    const original=window.renderConstructionBudget;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      // data-budget-new-anchor is intentionally retained in this wrapper so the
      // existing V2 editable-render race guard continues to recognize this renderer.
      try{applyHierarchy()}catch(e){console.warn('[TERAJU V2 hierarchy]',e)}
      return result;
    };
    wrapped.__terajuV2Hierarchy=true;
    window.renderConstructionBudget=wrapped;
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    if(install()){
      clearInterval(timer);
      try{window.renderConstructionBudget()}catch(_){}
    }
    if(++tries>120)clearInterval(timer);
  },100);
})();
