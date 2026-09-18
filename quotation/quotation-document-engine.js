(function(){
'use strict';

const PAGE_MM={width:210,height:297,margin:10};
const CONTENT_MM={width:190,height:277};
const RENDER_WIDTH_PX=794;
const PX_PER_MM=RENDER_WIDTH_PX/CONTENT_MM.width;
const CONTENT_HEIGHT_PX=Math.floor(CONTENT_MM.height*PX_PER_MM);
const PAGE_NUMBER_RESERVE_PX=Math.ceil(8*PX_PER_MM);
const PAGE_BOTTOM_SAFETY_PX=Math.ceil(8*PX_PER_MM);
const USABLE_HEIGHT_PX=CONTENT_HEIGHT_PX-PAGE_NUMBER_RESERVE_PX-PAGE_BOTTOM_SAFETY_PX;
const JPEG_QUALITY=0.94;

function injectStyles(){
 if(document.getElementById('tc-quotation-document-engine-style'))return;
 const style=document.createElement('style');
 style.id='tc-quotation-document-engine-style';
 style.textContent=`
#quotationPreview.quotation-preview-stage{width:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:28px!important;overflow-x:hidden!important;background:#e5e7eb!important;padding:28px 16px!important;border-radius:16px!important;box-sizing:border-box!important}
#quotationPreview .quotation-preview-page{position:relative!important;width:min(210mm,100%)!important;aspect-ratio:210/297!important;box-sizing:border-box!important;background:#fff!important;border:1px solid #cbd5e1!important;box-shadow:0 14px 36px rgba(15,23,42,.14)!important;overflow:hidden!important;padding:10mm!important;flex:0 0 auto!important}
#quotationPreview .quotation-preview-page img{display:block!important;width:100%!important;height:auto!important;max-width:none!important}
#quotationPreview .quotation-preview-page-number{position:absolute!important;left:0!important;right:0!important;bottom:3mm!important;text-align:center!important;font-size:10px!important;line-height:1!important;color:#6b7280!important;font-family:Arial,Helvetica,sans-serif!important;pointer-events:none!important}
#quotationPreview .quotation-preview-loading{width:100%;padding:32px 20px;text-align:center;border:1px dashed #d1d5db;border-radius:16px;background:#fafafa;color:#6b7280}#quotationPreview .quotation-preview-page{position:relative!important}#quotationPreview .tc-column-resize-layer{position:absolute!important;inset:0!important;pointer-events:none!important;z-index:20!important}#quotationPreview .tc-column-resizer{position:absolute!important;top:0!important;width:10px!important;transform:translateX(-50%)!important;height:100%!important;cursor:col-resize!important;pointer-events:auto!important;touch-action:none!important}#quotationPreview .tc-column-resizer::after{content:"";position:absolute;top:0;bottom:0;left:4px;width:2px;background:transparent}#quotationPreview .tc-column-resizer:hover::after,#quotationPreview .tc-column-resizer.is-dragging::after{background:rgba(17,24,39,.25)}body.tc-quotation-column-dragging{cursor:col-resize!important;user-select:none!important}body.tc-quotation-column-dragging *{user-select:none!important}
@media(max-width:767px){#quotationPreview.quotation-preview-stage{gap:20px!important;padding:16px 8px!important}#quotationPreview .quotation-preview-page{width:100%!important;box-shadow:0 8px 24px rgba(15,23,42,.08)!important}}

/* QUOTATION LAYOUT CONTRACT
   The quotation document follows the Construction Budget column roles and vertical alignment.
   Simple: No / Description / Amount.
   Detailed: No / Description / Unit / Quantity / Rate / Amount.
   Labels have explicit alignment rules; amounts remain numeric/right aligned.
*/
.simple-quotation-table,.detailed-quotation-table{width:100%!important;table-layout:fixed!important;border-collapse:collapse!important}
.simple-quotation-table th,.simple-quotation-table td,.detailed-quotation-table th,.detailed-quotation-table td{vertical-align:top!important}
.simple-quotation-table th:nth-child(1),.simple-quotation-table td:nth-child(1),.simple-quotation-table th:nth-child(2),.simple-quotation-table td:nth-child(2),.simple-quotation-table .quotation-section-row td,.simple-quotation-table .quotation-subsection-row td,.simple-quotation-table .quotation-subsubsection-row td,.simple-quotation-table .quotation-summary-title td,.simple-quotation-table .quotation-summary-row td:first-child,.simple-quotation-table .border-b td:first-child,.simple-quotation-table .border-b td:nth-child(2),.simple-quotation-table tfoot tr.border-t-2 td:first-child{ text-align:left!important }

/* AMOUNT COLUMN RIGHT EDGE LOCK: every Amount value and label/value row terminates on the exact same right edge. */
.simple-quotation-table th:last-child,.simple-quotation-table td:last-child,.detailed-quotation-table th:last-child,.detailed-quotation-table td:last-child{ text-align:right!important; padding-right:0!important; box-sizing:border-box!important; }

/* Simple hierarchy rows are labels, not Amount cells. Keep them at the far-left edge. */
.simple-quotation-table .quotation-section-row td,.simple-quotation-table .quotation-subsection-row td,.simple-quotation-table .quotation-subsubsection-row td,.simple-quotation-table .quotation-summary-title td{ text-align:left!important; }
.simple-quotation-table th:nth-child(3),.simple-quotation-table td:nth-child(3),.detailed-quotation-table th:nth-child(4),.detailed-quotation-table td:nth-child(4),.detailed-quotation-table th:nth-child(5),.detailed-quotation-table td:nth-child(5),.detailed-quotation-table th:nth-child(6),.detailed-quotation-table td:nth-child(6){text-align:right!important}
.detailed-quotation-table th:nth-child(1),.detailed-quotation-table td:nth-child(1),.detailed-quotation-table th:nth-child(2),.detailed-quotation-table td:nth-child(2),.detailed-quotation-table th:nth-child(3),.detailed-quotation-table td:nth-child(3){text-align:left!important}
.simple-quotation-table td:nth-child(2),.detailed-quotation-table td:nth-child(2){overflow-wrap:break-word;word-break:normal;white-space:normal}
.simple-quotation-table td:nth-child(3),.detailed-quotation-table td:nth-child(n+4){white-space:nowrap}
.detailed-quotation-table col:nth-child(1),.detailed-quotation-table th:nth-child(1),.detailed-quotation-table td:nth-child(1){width:6%!important}
.detailed-quotation-table col:nth-child(2),.detailed-quotation-table th:nth-child(2),.detailed-quotation-table td:nth-child(2){width:42%!important}
.detailed-quotation-table col:nth-child(3),.detailed-quotation-table th:nth-child(3),.detailed-quotation-table td:nth-child(3){width:9%!important}
.detailed-quotation-table col:nth-child(4),.detailed-quotation-table th:nth-child(4),.detailed-quotation-table td:nth-child(4){width:11%!important}
.detailed-quotation-table col:nth-child(5),.detailed-quotation-table th:nth-child(5),.detailed-quotation-table td:nth-child(5){width:16%!important}
.detailed-quotation-table col:nth-child(6),.detailed-quotation-table th:nth-child(6),.detailed-quotation-table td:nth-child(6){width:16%!important}
.simple-quotation-table col:nth-child(1),.simple-quotation-table th:nth-child(1),.simple-quotation-table td:nth-child(1){width:8%!important}
.simple-quotation-table col:nth-child(2),.simple-quotation-table th:nth-child(2),.simple-quotation-table td:nth-child(2){width:72%!important}
.simple-quotation-table col:nth-child(3),.simple-quotation-table th:nth-child(3),.simple-quotation-table td:nth-child(3){width:20%!important}
.simple-quotation-table .border-b td:nth-child(2),.detailed-quotation-table .border-b td:nth-child(5){white-space:nowrap!important}
/* Standard planner estimate alignment — alignment/column sizing only; typography unchanged. */
#estimateContent table th:nth-child(1),#estimateContent table td:nth-child(1){text-align:left!important}
#estimateContent table th:nth-child(2),#estimateContent table td:nth-child(2){text-align:center!important}
#estimateContent table th:nth-child(3),#estimateContent table td:nth-child(3){text-align:center!important}
#estimateContent table th:nth-child(4),#estimateContent table td:nth-child(4){text-align:right!important}
#estimateContent table th:nth-child(5),#estimateContent table td:nth-child(5){text-align:right!important}
#estimateContent table th:nth-child(6),#estimateContent table td:nth-child(6){text-align:center!important}
#estimateContent table td:nth-child(1) textarea,#estimateContent table td:nth-child(1) input,#estimateContent table td:nth-child(1) select{text-align:left!important}
#estimateContent table td:nth-child(2){text-align:center!important}
#estimateContent table td:nth-child(3) input,#estimateContent table td:nth-child(3) select,#estimateContent table td:nth-child(3) textarea,#estimateContent table td:nth-child(3) .homeowner-locked{text-align:center!important}
#estimateContent table td:nth-child(4) input,#estimateContent table td:nth-child(4) select,#estimateContent table td:nth-child(4) textarea,#estimateContent table td:nth-child(4) .homeowner-locked{text-align:right!important}
#estimateContent table td:nth-child(5){text-align:right!important}
#estimateContent table td:nth-child(6) button{text-align:center!important}
#estimateContent table .quotation-section-row td,#estimateContent table .quotation-subsection-row td{text-align:left!important}
#estimateContent table tr:has(td[colspan="5"]) td:first-child,#estimateContent table tr:has(td[colspan="4"]) td:first-child{text-align:right!important}
#estimateContent table tr:has(td[colspan="4"]) td:nth-child(5){text-align:right!important}
#estimateContent table tr:has(td[colspan="4"]) td:nth-child(6){text-align:center!important}
#estimateContent table tfoot td[colspan]{text-align:right!important}
@media(max-width:767px){
 #estimateContent table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;border-collapse:collapse!important}
 #estimateContent table col:nth-child(1){width:31%!important}
 #estimateContent table col:nth-child(2){width:7%!important}
 #estimateContent table col:nth-child(3){width:12%!important}
 #estimateContent table col:nth-child(4){width:15%!important}
 #estimateContent table col:nth-child(5){width:20%!important}
 #estimateContent table col:nth-child(6){width:15%!important}
 #estimateContent table th:nth-child(1),#estimateContent table td:nth-child(1){text-align:left!important}
 #estimateContent table th:nth-child(2),#estimateContent table td:nth-child(2){text-align:center!important}
 #estimateContent table th:nth-child(3),#estimateContent table td:nth-child(3){text-align:center!important}
 #estimateContent table th:nth-child(4),#estimateContent table td:nth-child(4){text-align:right!important}
 #estimateContent table th:nth-child(5),#estimateContent table td:nth-child(5){text-align:right!important}
 #estimateContent table th:nth-child(6),#estimateContent table td:nth-child(6){text-align:center!important}
 #estimateContent table td:nth-child(1) textarea,#estimateContent table td:nth-child(1) input,#estimateContent table td:nth-child(1) select{width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;text-align:left!important}
 #estimateContent table td:nth-child(2){text-align:center!important}
 #estimateContent table td:nth-child(3) input,#estimateContent table td:nth-child(3) select,#estimateContent table td:nth-child(3) textarea{min-width:0!important;max-width:100%!important;box-sizing:border-box!important;text-align:center!important}
 #estimateContent table td:nth-child(3) .homeowner-locked{text-align:center!important}
 #estimateContent table td:nth-child(4) input,#estimateContent table td:nth-child(4) select,#estimateContent table td:nth-child(4) textarea{min-width:0!important;max-width:100%!important;box-sizing:border-box!important;text-align:right!important}
 #estimateContent table td:nth-child(4) .homeowner-locked{text-align:right!important}
 #estimateContent table td:nth-child(5){text-align:right!important}
 #estimateContent table td:nth-child(6) button{width:100%!important;min-width:0!important;box-sizing:border-box!important;text-align:center!important}
 #estimateContent table tr:has(td[colspan="5"]) td:first-child,#estimateContent table tr:has(td[colspan="4"]) td:first-child{text-align:right!important}
 #estimateContent table tr:has(td[colspan="4"]) td:nth-child(5){text-align:right!important}
 #estimateContent table tr:has(td[colspan="4"]) td:nth-child(6){text-align:center!important}
}
`;
 document.head.appendChild(style);
}

function loadScript(src,test){
 return new Promise((resolve,reject)=>{
  if(test())return resolve();
  const existing=document.querySelector(`script[data-tc-src="${src}"]`);
  if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
  const script=document.createElement('script');
  script.src=src;script.dataset.tcSrc=src;
  script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load quotation document component.'));
  document.head.appendChild(script);
 });
}
async function loadQuotationCanvas(){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>typeof window.html2canvas==='function');}
function waitForImages(root){return Promise.all(Array.from(root.querySelectorAll('img')).map(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true})})));}

function createRenderRoot(){
 const root=document.createElement('div');
 root.style.cssText=`width:${RENDER_WIDTH_PX}px;box-sizing:border-box;background:#fff;padding:0 0 ${PAGE_BOTTOM_SAFETY_PX}px;margin:0;overflow:visible;font-family:Arial,Helvetica,sans-serif;`;
 return root;
}
function isHeadingRow(row){return row.classList.contains('quotation-section-row')||row.classList.contains('quotation-subsection-row');}
function isSubtotalRow(row){return /^subtotal\s*-/i.test((row.textContent||'').trim());}
function collectPageUnits(tbody){
 const rows=Array.from(tbody?.children||[]).filter(el=>el.tagName==='TR');
 const units=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  if(isHeadingRow(row)){
   const group=[row];let j=i+1;
   while(j<rows.length&&isHeadingRow(rows[j])){group.push(rows[j]);j++;}
   if(j<rows.length)group.push(rows[j]);
   units.push(group);i=j;
  }else if(isSubtotalRow(row)&&units.length){units[units.length-1].push(row)}else units.push([row]);
 }
 return units;
}
function makePageShell(headerNodes,tableTemplate,includeTableHeader){
 const root=createRenderRoot();headerNodes.forEach(node=>root.appendChild(node.cloneNode(true)));
 let wrap=null,table=null,tbody=null;
 if(includeTableHeader){
  wrap=document.createElement('div');wrap.className=tableTemplate.wrapper.className;wrap.style.overflow='visible';wrap.style.width='100%';
  table=tableTemplate.table.cloneNode(false);const colgroup=tableTemplate.colgroup?tableTemplate.colgroup.cloneNode(true):null;const thead=tableTemplate.thead?tableTemplate.thead.cloneNode(true):null;tbody=document.createElement('tbody');
  if(colgroup)table.appendChild(colgroup)
  if(thead)table.appendChild(thead);table.appendChild(tbody);wrap.appendChild(table);root.appendChild(wrap);
 }
 return {root,wrap,table,tbody};
}
function appendUnits(page,units){units.forEach(unit=>unit.forEach(row=>page.tbody.appendChild(row.cloneNode(true))))}
function pageHeight(page){const holder=document.createElement('div');holder.style.cssText=`position:fixed;left:-100000px;top:0;width:${RENDER_WIDTH_PX}px;background:#fff;padding:0;margin:0;overflow:visible;visibility:hidden;z-index:-1`;holder.appendChild(page.root);document.body.appendChild(holder);void page.root.offsetHeight;const height=Math.ceil(Math.max(page.root.scrollHeight,page.root.getBoundingClientRect().height));holder.remove();return height}
function canvasFromPage(root){const holder=document.createElement('div');holder.style.cssText=`position:fixed;left:-100000px;top:0;width:${RENDER_WIDTH_PX}px;background:#fff;padding:0;margin:0;overflow:visible;z-index:-1;visibility:visible`;holder.appendChild(root);document.body.appendChild(holder);return holder}
async function rasterizePages(pageRoots){const pages=[];for(const root of pageRoots){const holder=canvasFromPage(root);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(document.fonts?.ready)await document.fonts.ready;await waitForImages(holder);const measured=Math.ceil(Math.max(root.scrollHeight,root.getBoundingClientRect().height,1));const captureHeight=Math.min(USABLE_HEIGHT_PX,measured);const canvas=await window.html2canvas(holder,{backgroundColor:'#fff',scale:Math.min(2,Math.max(1.5,window.devicePixelRatio||1)),useCORS:true,allowTaint:false,logging:false,imageTimeout:15000,scrollX:0,scrollY:0,width:RENDER_WIDTH_PX,height:captureHeight,windowWidth:RENDER_WIDTH_PX,windowHeight:captureHeight});holder.remove();const heightMm=(canvas.height/Math.max(canvas.width,1))*CONTENT_MM.width;pages.push({src:canvas.toDataURL('image/jpeg',JPEG_QUALITY),heightMm})}return pages}
async function measureQuotationUnits(headerNodes,tableTemplate,units){
 const measure=makePageShell(headerNodes,tableTemplate,true);
 units.forEach(unit=>unit.forEach(row=>measure.tbody.appendChild(row.cloneNode(true))));
 const holder=document.createElement('div');
 holder.style.cssText=`position:fixed;left:-100000px;top:0;width:${RENDER_WIDTH_PX}px;background:#fff;padding:0;margin:0;overflow:visible;visibility:hidden;z-index:-1`;
 holder.appendChild(measure.root);document.body.appendChild(holder);
 void measure.root.offsetHeight;
 const heights=units.map(()=>0);let cursor=0;
 units.forEach((unit,index)=>unit.forEach(()=>{heights[index]+=Math.ceil(measure.tbody.children[cursor++].getBoundingClientRect().height)}));
 holder.remove();
 return {baseHeight:pageHeight(makePageShell(headerNodes,tableTemplate,true)),heights};
}
async function buildPaginatedPages(source){
 const working=source.cloneNode(true);
 working.classList.remove('quotation-render-source','quotation-locked');
 working.querySelectorAll('.no-print,#quotationPrintActions,#quotationLockOverlay').forEach(el=>el.remove());
 if(document.fonts?.ready)await document.fonts.ready;
 await waitForImages(working);

 const children=Array.from(working.children);
 const tableWrap=children.find(el=>el.querySelector?.('table'));
 if(!tableWrap)return[working];

 const table=tableWrap.querySelector('table');
 const colgroup=table?.querySelector('colgroup');
 const thead=table?.querySelector('thead');
 const tbody=table?.querySelector('tbody');
 const tfoot=table?.querySelector('tfoot');
 if(!table||!tbody)return[working];

 const tableIndex=children.indexOf(tableWrap);
 const headerNodes=children.slice(0,tableIndex);
 const footerNodes=children.slice(tableIndex+1);
 const template={wrapper:tableWrap,table,colgroup,thead,tfoot};
 const units=collectPageUnits(tbody);
 if(!units.length)return[working];

 const {baseHeight,heights}=await measureQuotationUnits(headerNodes,template,units);
 const pages=[];
 let page=makePageShell(headerNodes,template,true);
 let used=baseHeight;

 const pushBodyPage=()=>{if(page.tbody.children.length)pages.push(page.root)};
 const newBodyPage=()=>{page=makePageShell(headerNodes,template,true);used=baseHeight};

 for(let i=0;i<units.length;i++){
  const h=heights[i]||0;
  if(page.tbody.children.length&&used+h>USABLE_HEIGHT_PX){pushBodyPage();newBodyPage();}
  appendUnits(page,[units[i]]);used+=h;
 }

 // Summary is a first-class document section. Keep it on the last body page
 // when it fits; otherwise give it a complete page with the same document grid.
 if(tfoot){
  const summary=tfoot.cloneNode(true);
  page.table.appendChild(summary);
  if(pageHeight(page)>USABLE_HEIGHT_PX){
   summary.remove();
   pushBodyPage();
   page=makePageShell(headerNodes,template,true);
   page.table.appendChild(tfoot.cloneNode(true));
   pages.push(page.root);
   page=null;
  }
 }

 // Terms/signature follow the summary. If they do not fit, put them on their own page.
 if(footerNodes.length){
  if(page){
   const footerClones=footerNodes.map(node=>node.cloneNode(true));
   footerClones.forEach(node=>page.root.appendChild(node));
   if(pageHeight(page)<=USABLE_HEIGHT_PX){
    pages.push(page.root);
    page=null;
   }else{
    footerClones.forEach(node=>node.remove());
    pushBodyPage();
    page=null;
   }
  }
  const footerPage=makePageShell(headerNodes,template,false);
  footerNodes.forEach(node=>footerPage.root.appendChild(node.cloneNode(true)));
  pages.push(footerPage.root);
 }else if(page){
  pages.push(page.root);
 }
 return pages;
}
function quotationTableType(table){return table?.classList.contains('detailed-quotation-table')?'detailed':(table?.classList.contains('simple-quotation-table')?'simple':null)}
function quotationResizeSourceTable(source){return source?.querySelector('table.detailed-quotation-table,table.simple-quotation-table')}
function quotationReadWidths(table){const cols=Array.from(table?.querySelectorAll('colgroup col')||[]);const vals=cols.map(col=>parseFloat(col.style.width||col.getAttribute('width')||''));if(vals.length&&vals.every(v=>Number.isFinite(v)&&v>0)){const sum=vals.reduce((a,b)=>a+b,0);if(sum>0)return vals.map(v=>v/sum*100)}const rects=cols.map(col=>col.getBoundingClientRect().width),total=rects.reduce((a,b)=>a+b,0);return total?rects.map(v=>v/total*100):[]}
function quotationApplyWidths(table,widths){const cols=table?.querySelectorAll('colgroup col');if(!cols||cols.length!==widths.length)return;cols.forEach((col,i)=>col.style.setProperty('width',widths[i]+'%','important'));table.style.tableLayout='fixed'}
function typeMinWidth(type,index){return type==='detailed'?[42,150,48,55,75,82][index]||42:[42,180,82][index]||42}
function quotationBuildResizeMeta(pageRoots){return pageRoots.map(root=>{const table=root.querySelector('table.detailed-quotation-table,table.simple-quotation-table');if(!table)return null;const holder=document.createElement('div');holder.style.cssText='position:fixed;left:-100000px;top:0;width:'+RENDER_WIDTH_PX+'px;background:#fff;padding:0;margin:0;overflow:visible;visibility:hidden;z-index:-1';holder.appendChild(root);document.body.appendChild(holder);void root.offsetHeight;const type=quotationTableType(table),rr=root.getBoundingClientRect(),tr=table.getBoundingClientRect(),meta={type,top:tr.top-rr.top,left:tr.left-rr.left,width:tr.width,height:tr.height,positions:Array.from(table.querySelectorAll('colgroup col')).slice(0,-1).map(col=>col.getBoundingClientRect().right-rr.left)};holder.remove();return meta})}
function quotationInstallResizeHandles(stage,pageRoots,meta,source){const sourceTable=quotationResizeSourceTable(source);if(!sourceTable)return;const saved=window.__tcQuotationColumnWidths?.[quotationTableType(sourceTable)];if(saved)quotationApplyWidths(sourceTable,saved);stage.querySelectorAll('.tc-column-resize-layer').forEach(el=>el.remove());pageRoots.forEach((root,pi)=>{const m=meta[pi],page=stage.children[pi];if(!m||!page)return;const layer=document.createElement('div');layer.className='tc-column-resize-layer';layer.style.width='794px';layer.style.height=Math.max(1,root.getBoundingClientRect().height)+'px';m.positions.forEach((pos,index)=>{const h=document.createElement('span');h.className='tc-column-resizer no-print';h.style.left=pos+'px';h.style.top=m.top+'px';h.style.height=m.height+'px';h.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();const table=quotationResizeSourceTable(source),widths=quotationReadWidths(table),cols=table.querySelectorAll('colgroup col'),sx=event.clientX,l=cols[index].getBoundingClientRect().width,r=cols[index+1].getBoundingClientRect().width,minL=typeMinWidth(m.type,index),minR=typeMinWidth(m.type,index+1);const maxD=r-minR,minD=minL-l;h.classList.add('is-dragging');document.body.classList.add('tc-quotation-column-dragging');const move=e=>{const d=Math.max(minD,Math.min(maxD,e.clientX-sx));h.style.transform='translateX(calc(-50% + '+d+'px))'};const up=async e=>{const d=Math.max(minD,Math.min(maxD,(e?.clientX??sx)-sx)),pair=widths[index]+widths[index+1],total=l+r,next=widths.slice();next[index]=(l+d)/total*pair;next[index+1]=(r-d)/total*pair;window.__tcQuotationColumnWidths=window.__tcQuotationColumnWidths||{};window.__tcQuotationColumnWidths[m.type]=next;quotationApplyWidths(table,next);document.body.classList.remove('tc-quotation-column-dragging');h.classList.remove('is-dragging');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);await renderQuotationPreview()};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',up,{once:true})});layer.appendChild(h)});page.appendChild(layer)})}
async function renderQuotationPreview(){injectStyles();const source=document.getElementById('quotationContent'),stage=document.getElementById('quotationPreview');if(!source||!stage)return;stage.innerHTML='<div class="quotation-preview-loading">Preparing visual quotation preview…</div>';try{await loadQuotationCanvas();const pageRoots=await buildPaginatedPages(source);const meta=quotationBuildResizeMeta(pageRoots);const pages=await rasterizePages(pageRoots);window.__quotationPreviewPages=pages.map(p=>p.src);window.__quotationPreviewPageMeta=pages;stage.innerHTML=pages.map((p,k)=>'<div class="quotation-preview-page"><img src="'+p.src+'" alt="Quotation page '+(k+1)+'"><div class="quotation-preview-page-number">Page '+(k+1)+' of '+pages.length+'</div></div>').join('');quotationInstallResizeHandles(stage,pageRoots,meta,source)}catch(error){console.error(error);stage.innerHTML='<div class="quotation-preview-loading">Unable to prepare the visual quotation preview. You can still try Download PDF.</div>'}}
async function printQuotation(){const quotation=document.getElementById('quotationDocument');if(!quotation||quotation.classList.contains('hidden')){alert('Please generate the quotation first.');return}const button=document.querySelector('#quotationPrintActions button'),originalLabel=button?button.textContent:'';if(button){button.disabled=true;button.textContent='Preparing PDF…'}try{await renderQuotationPreview();const pages=window.__quotationPreviewPages||[],meta=window.__quotationPreviewPageMeta||[];if(!pages.length)throw new Error('Quotation preview is unavailable.');await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>!!(window.jspdf&&window.jspdf.jsPDF));const{jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'p',unit:'mm',format:'a4',compress:true});pages.forEach((src,index)=>{if(index)pdf.addPage();const drawHeight=Math.min(CONTENT_MM.height,Math.max(.1,meta[index]?.heightMm||CONTENT_MM.height));pdf.addImage(src,'JPEG',PAGE_MM.margin,PAGE_MM.margin,CONTENT_MM.width,drawHeight,undefined,'FAST');pdf.setFontSize(8);pdf.setTextColor(107,114,128);pdf.text(`Page ${index+1} of ${pages.length}`,PAGE_MM.width/2,PAGE_MM.height-4,{align:'center'})});const safeNumber=(typeof quotationNumber!=='undefined'&&quotationNumber?quotationNumber:'quotation').replace(/[^a-z0-9_-]+/gi,'-');pdf.save(`Quotation-${safeNumber}.pdf`)}catch(error){console.error(error);alert('Unable to create the PDF. Please check your internet connection and try again.')}finally{if(button){button.disabled=false;button.textContent=originalLabel||'Download PDF'}}}
function bindQuotationTypeCards(){const inputs=document.querySelectorAll('input[name="quotationType"]');if(!inputs.length)return;const sync=()=>{document.querySelectorAll('.quotation-type-card').forEach(card=>{const input=card.querySelector('input[name="quotationType"]');if(input)card.classList.toggle('is-selected',!!input.checked)});if(typeof window.saveContractorState==='function')window.saveContractorState()};inputs.forEach(input=>input.addEventListener('change',sync));document.querySelectorAll('.quotation-type-card').forEach(card=>card.addEventListener('click',()=>{const input=card.querySelector('input[name="quotationType"]');if(!input)return;input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}))}));sync()}
function install(){injectStyles();bindQuotationTypeCards();window.renderQuotationPreview=renderQuotationPreview;window.printQuotation=printQuotation;window.TERAJU_QUOTATION_DOCUMENT_ENGINE_VERSION='2026-09-19-excel-column-resize-v2'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();