(function(){
'use strict';
if(window.__TERAJU_CARD_PDF__)return;
window.__TERAJU_CARD_PDF__=true;

const A3={w:420,h:297,margin:10};
const CW=A3.w-(A3.margin*2),CH=A3.h-(A3.margin*2);

function load(src,test){
  return new Promise((res,rej)=>{
    if(test())return res();
    const s=document.createElement('script');
    s.src=src;s.onload=res;s.onerror=()=>rej(new Error('PDF component failed to load'));
    document.head.appendChild(s);
  });
}
async function deps(){
  await load('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>typeof html2canvas==='function');
  await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>window.jspdf?.jsPDF);
}
function pdfStyle(){
  const s=document.createElement('style');
  s.textContent='*{box-sizing:border-box!important}html,body{overflow:visible!important;width:max-content!important;max-width:none!important}table{width:max-content!important;min-width:0!important;max-width:none!important;border-collapse:collapse!important}th,td{vertical-align:top!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}input,select{background:#fff!important;color:#111827!important}.overflow-auto,.overflow-x-auto,.overflow-y-auto,.table-wrap,.chart-wrap{overflow:visible!important;width:max-content!important;max-width:none!important}.table-wrap>table,.chart-wrap>.chart{width:max-content!important;max-width:none!important}.sticky,.sticky-left{position:static!important}.wp-table,.pg-table{font-size:11px!important;line-height:1.35!important}.wp-table .item,.pg-table .item{white-space:normal!important;overflow-wrap:anywhere!important}.wp-table{min-width:1120px!important}.pg-table{min-width:1050px!important}.chart{min-width:760px!important;height:auto!important}.wp-gantt{overflow:visible!important;min-width:max-content!important}.wp-gantt-header,.wp-gantt-row{width:max-content!important;min-width:max-content!important}.wp-weeks{width:max-content!important}.s-curve-chart{overflow:visible!important}';
  return s;
}
async function captureElement(source,renderWidth){
  const clone=source.cloneNode(true);
  clone.querySelectorAll('.pdf-hide,.no-print').forEach(x=>x.remove());
  clone.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
  clone.style.width='max-content';
  clone.style.minWidth=renderWidth+'px';
  clone.style.maxWidth='none';
  clone.style.margin='0';
  clone.style.transform='none';
  clone.style.overflow='visible';

  const holder=document.createElement('div');
  holder.style.cssText='position:fixed;left:-10000px;top:0;width:'+renderWidth+'px;background:#fff;z-index:-999999;padding:0;margin:0;overflow:visible';
  holder.appendChild(pdfStyle());
  holder.appendChild(clone);
  document.body.appendChild(holder);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

  const canvas=await html2canvas(clone,{
    backgroundColor:'#fff',
    scale:Math.min(2,Math.max(1.5,devicePixelRatio||1)),
    useCORS:true,allowTaint:false,logging:false,
    width:renderWidth,windowWidth:renderWidth,scrollX:0,scrollY:0
  });
  holder.remove();
  return canvas;
}
async function save(id,filename,button){
  const source=document.getElementById(id);
  if(!source)return;
  const old=button?.textContent;
  if(button){button.disabled=true;button.textContent='Saving PDF…'}
  try{
    await deps();
    if(document.fonts?.ready)await document.fonts.ready;

    const pdf=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
    const sectionIds=(button?.dataset.pdfSections||'').split(',').map(x=>x.trim()).filter(Boolean);
    const targets=sectionIds.length
      ? sectionIds.map(x=>document.getElementById(x)).filter(Boolean)
      : [source];

    let added=false;
    for(const target of targets){
      const rect=target.getBoundingClientRect();
      const renderWidth=Math.max(900,Math.round(rect.width));
      const canvas=await captureElement(target,renderWidth);

      const pxPerMm=canvas.width/CW;
      const pagePx=Math.max(1,Math.floor(CH*pxPerMm));
      let off=0;

      while(off<canvas.height){
        if(added)pdf.addPage('a3','landscape');
        added=true;

        const h=Math.min(pagePx,canvas.height-off);
        const slice=document.createElement('canvas');
        slice.width=canvas.width;
        slice.height=h;
        slice.getContext('2d').drawImage(canvas,0,off,canvas.width,h,0,0,slice.width,slice.height);

        pdf.addImage(
          slice.toDataURL('image/jpeg',.96),
          'JPEG',
          A3.margin,A3.margin,
          CW,h/pxPerMm,
          undefined,'FAST'
        );
        off+=h;
      }
    }
    if(added)pdf.save(filename+'-'+new Date().toISOString().slice(0,10)+'.pdf');
  }catch(e){
    console.error(e);
    alert('Unable to save PDF. Please try again.');
  }finally{
    if(button){button.disabled=false;button.textContent=old||'Save PDF'}
  }
}
window.TERAJU_CARD_PDF={save};
})();