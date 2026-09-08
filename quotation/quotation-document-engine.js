(function(){
'use strict';

const PAGE_MM={width:210,height:297,margin:10};
const CONTENT_MM={width:190,height:277};
const RENDER_WIDTH_PX=794;
const PX_PER_MM=RENDER_WIDTH_PX/CONTENT_MM.width;
const CONTENT_HEIGHT_PX=Math.floor(CONTENT_MM.height*PX_PER_MM);
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
#quotationPreview .quotation-preview-loading{width:100%;padding:32px 20px;text-align:center;border:1px dashed #d1d5db;border-radius:16px;background:#fafafa;color:#6b7280}
@media(max-width:767px){#quotationPreview.quotation-preview-stage{gap:20px!important;padding:16px 8px!important}#quotationPreview .quotation-preview-page{width:100%!important;box-shadow:0 8px 24px rgba(15,23,42,.08)!important}}
`;
 document.head.appendChild(style);
}

function loadScript(src,test){
 return new Promise((resolve,reject)=>{
  if(test())return resolve();
  const existing=document.querySelector(`script[data-tc-src="${src}"]`);
  if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
  const script=document.createElement('script');script.src=src;script.dataset.tcSrc=src;script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load quotation document component.'));document.head.appendChild(script);
 });
}
async function loadQuotationCanvas(){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>typeof window.html2canvas==='function');}
function waitForImages(root){return Promise.all(Array.from(root.querySelectorAll('img')).map(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true})})));}

function createRenderRoot(){
 const root=document.createElement('div');
 root.style.cssText=`width:${RENDER_WIDTH_PX}px;box-sizing:border-box;background:#fff;padding:0;margin:0;overflow:visible;font-family:Arial,Helvetica,sans-serif;`;
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
   const group=[row]; let j=i+1;
   while(j<rows.length&&isHeadingRow(rows[j])){group.push(rows[j]);j++;}
   if(j<rows.length)group.push(rows[j]);
   units.push(group);i=j;
  }else if(isSubtotalRow(row)&&units.length){
   units[units.length-1].push(row);
  }else{
   units.push([row]);
  }
 }
 return units;
}

function makePageShell(headerNodes,tableTemplate){
 const root=createRenderRoot();
 headerNodes.forEach(node=>root.appendChild(node.cloneNode(true)));
 const wrap=document.createElement('div');
 wrap.className=tableTemplate.wrapper.className;
 wrap.style.overflow='visible';
 wrap.style.width='100%';
 const table=tableTemplate.table.cloneNode(false);
 const thead=tableTemplate.thead?tableTemplate.thead.cloneNode(true):null;
 const tbody=document.createElement('tbody');
 if(thead)table.appendChild(thead);
 table.appendChild(tbody);
 wrap.appendChild(table);
 root.appendChild(wrap);
 return {root,wrap,table,tbody};
}

function appendUnits(page,units){
 units.forEach(unit=>unit.forEach(row=>page.tbody.appendChild(row.cloneNode(true))));
}
function pageHeight(page){return Math.ceil(page.root.scrollHeight);}
function canvasFromPage(root){
 const holder=document.createElement('div');
 holder.style.cssText=`position:fixed;left:-100000px;top:0;width:${RENDER_WIDTH_PX}px;background:#fff;padding:0;margin:0;overflow:visible;z-index:-1;visibility:visible`;
 holder.appendChild(root);
 document.body.appendChild(holder);
 return holder;
}

async function rasterizePages(pageRoots){
 const pages=[];
 for(const root of pageRoots){
  const holder=canvasFromPage(root);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  if(document.fonts?.ready)await document.fonts.ready;
  await waitForImages(holder);
  const canvas=await window.html2canvas(holder,{backgroundColor:'#fff',scale:Math.min(2,Math.max(1.5,window.devicePixelRatio||1)),useCORS:true,allowTaint:false,logging:false,imageTimeout:15000,scrollX:0,scrollY:0,windowWidth:RENDER_WIDTH_PX,windowHeight:Math.max(holder.scrollHeight,1)});
  holder.remove();
  const heightMm=canvas.height/PX_PER_MM;
  pages.push({src:canvas.toDataURL('image/jpeg',JPEG_QUALITY),heightMm});
 }
 return pages;
}

async function buildPaginatedPages(source){
 const working=source.cloneNode(true);
 working.classList.remove('quotation-render-source','quotation-locked');
 working.querySelectorAll('.no-print,#quotationPrintActions,#quotationLockOverlay').forEach(el=>el.remove());

 const children=Array.from(working.children);
 const tableWrap=children.find(el=>el.querySelector?.('table'));
 if(!tableWrap)return [working];

 const table=tableWrap.querySelector('table');
 const thead=table?.querySelector('thead');
 const tbody=table?.querySelector('tbody');
 const tfoot=table?.querySelector('tfoot');
 if(!table||!tbody)return [working];

 const tableIndex=children.indexOf(tableWrap);
 const headerNodes=children.slice(0,tableIndex);
 const footerNodes=children.slice(tableIndex+1);
 const template={wrapper:tableWrap,table,thead,tfoot};
 const units=collectPageUnits(tbody);
 const roots=[];
 let page=makePageShell(headerNodes,template);

 for(const unit of units){
  const testRows=unit.map(r=>r.cloneNode(true));
  testRows.forEach(r=>page.tbody.appendChild(r));

  if(pageHeight(page)>CONTENT_HEIGHT_PX && page.tbody.children.length>testRows.length){
   testRows.forEach(r=>r.remove());
   roots.push(page.root);
   page=makePageShell(headerNodes,template);
   appendUnits(page,[unit]);

   if(pageHeight(page)>CONTENT_HEIGHT_PX){
    console.warn('Quotation row group exceeds one A4 content page; keeping it together as far as possible.');
   }
  }
 }

 if(!page.tbody.children.length&&roots.length){
  roots.push(page.root);
  page=makePageShell(headerNodes,template);
 }

 // Keep TOTAL and the final notes/signature together on the last page when possible.
 if(tfoot)page.table.appendChild(tfoot.cloneNode(true));
 footerNodes.forEach(node=>page.root.appendChild(node.cloneNode(true)));

 if(pageHeight(page)>CONTENT_HEIGHT_PX&&(tfoot||footerNodes.length)){
  const cleanLastPage=makePageShell(headerNodes,template);
  roots.push(page.root);

  if(tfoot)cleanLastPage.table.appendChild(tfoot.cloneNode(true));
  footerNodes.forEach(node=>cleanLastPage.root.appendChild(node.cloneNode(true)));
  page=cleanLastPage;
 }

 roots.push(page.root);
 return roots;
}

async function renderQuotationPreview(){
 injectStyles();
 const source=document.getElementById('quotationContent'),stage=document.getElementById('quotationPreview');
 if(!source||!stage)return;
 stage.innerHTML='<div class="quotation-preview-loading">Preparing visual quotation preview…</div>';
 try{
  await loadQuotationCanvas();
  const pageRoots=await buildPaginatedPages(source);
  const pages=await rasterizePages(pageRoots);
  window.__quotationPreviewPages=pages.map(p=>p.src);
  window.__quotationPreviewPageMeta=pages;
  stage.innerHTML=pages.map((p,i)=>`<div class="quotation-preview-page"><img src="${p.src}" alt="Quotation page ${i+1}"><div class="quotation-preview-page-number">Page ${i+1} of ${pages.length}</div></div>`).join('');
 }catch(error){console.error(error);stage.innerHTML='<div class="quotation-preview-loading">Unable to prepare the visual preview. You can still try Download PDF.</div>';}
}

async function printQuotation(){
 const quotation=document.getElementById('quotationDocument');
 if(!quotation||quotation.classList.contains('hidden')){alert('Please generate the quotation first.');return;}
 const button=document.querySelector('#quotationPrintActions button'),originalLabel=button?button.textContent:'';
 if(button){button.disabled=true;button.textContent='Preparing PDF…';}
 try{
  if(!window.__quotationPreviewPages?.length)await renderQuotationPreview();
  const pages=window.__quotationPreviewPages||[],meta=window.__quotationPreviewPageMeta||[];
  if(!pages.length)throw new Error('Quotation preview is unavailable.');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>!!(window.jspdf&&window.jspdf.jsPDF));
  const {jsPDF}=window.jspdf,pdf=new jsPDF({orientation:'p',unit:'mm',format:'a4',compress:true});
  pages.forEach((src,index)=>{
   if(index)pdf.addPage();
   const drawHeight=Math.min(CONTENT_MM.height,Math.max(.1,meta[index]?.heightMm||CONTENT_MM.height));
   pdf.addImage(src,'JPEG',PAGE_MM.margin,PAGE_MM.margin,CONTENT_MM.width,drawHeight,undefined,'FAST');
   pdf.setFontSize(8);pdf.setTextColor(107,114,128);pdf.text(`Page ${index+1} of ${pages.length}`,PAGE_MM.width/2,PAGE_MM.height-4,{align:'center'});
  });
  const safeNumber=(typeof quotationNumber!=='undefined'&&quotationNumber?quotationNumber:'quotation').replace(/[^a-z0-9_-]+/gi,'-');
  pdf.save(`Quotation-${safeNumber}.pdf`);
 }catch(error){console.error(error);alert('Unable to create the PDF. Please check your internet connection and try again.');}
 finally{if(button){button.disabled=false;button.textContent=originalLabel||'Download PDF';}}
}

function bindQuotationTypeCards(){
 const inputs=document.querySelectorAll('input[name="quotationType"]');if(!inputs.length)return;
 const sync=()=>{document.querySelectorAll('.quotation-type-card').forEach(card=>{const input=card.querySelector('input[name="quotationType"]');if(input)card.classList.toggle('is-selected',!!input.checked);});if(typeof window.saveContractorState==='function')window.saveContractorState();};
 inputs.forEach(input=>input.addEventListener('change',sync));
 document.querySelectorAll('.quotation-type-card').forEach(card=>card.addEventListener('click',()=>{const input=card.querySelector('input[name="quotationType"]');if(!input)return;input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}));
 sync();
}
function install(){injectStyles();bindQuotationTypeCards();window.renderQuotationPreview=renderQuotationPreview;window.printQuotation=printQuotation;window.TERAJU_QUOTATION_DOCUMENT_ENGINE_VERSION='2026-09-08-page-aware-header-v2';}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();