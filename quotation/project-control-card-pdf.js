(function(){
'use strict';
if(window.__TERAJU_CARD_PDF__)return;
window.__TERAJU_CARD_PDF__=true;
const A3={w:420,h:297,margin:10},CW=A3.w-20,CH=A3.h-20,RW=1600,PPM=RW/CW;
function load(src,test){return new Promise((res,rej)=>{if(test())return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('PDF component failed to load'));document.head.appendChild(s)})}
async function deps(){await load('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>typeof html2canvas==='function');await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>window.jspdf?.jsPDF)}
async function save(id,filename,button){
 const source=document.getElementById(id);if(!source)return;
 const old=button?.textContent;if(button){button.disabled=true;button.textContent='Saving PDF…'}
 let holder=null;
 try{
  await deps();if(document.fonts?.ready)await document.fonts.ready;
  const clone=source.cloneNode(true);clone.querySelectorAll('.pdf-hide,.no-print').forEach(x=>x.remove());
  clone.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
  holder=document.createElement('div');holder.style.cssText='position:fixed;left:-10000px;top:0;width:'+RW+'px;background:#fff;z-index:-999999;padding:0;margin:0;overflow:visible';
  const style=document.createElement('style');style.textContent='*{box-sizing:border-box!important}table{width:100%!important;max-width:none!important;border-collapse:collapse!important}th,td{vertical-align:top!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}input,select{background:#fff!important;color:#111827!important}.overflow-auto,.overflow-x-auto,.overflow-y-auto,.table-wrap,.chart-wrap{overflow:visible!important}.sticky,.sticky-left{position:static!important}.wp-table,.pg-table{font-size:11px!important;line-height:1.35!important}.wp-table .item,.pg-table .item{white-space:normal!important;overflow-wrap:anywhere!important}.chart{min-width:0!important;width:100%!important}';
  holder.appendChild(style);holder.appendChild(clone);document.body.appendChild(holder);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const canvas=await html2canvas(holder,{backgroundColor:'#fff',scale:Math.min(2,Math.max(1.5,devicePixelRatio||1)),useCORS:true,allowTaint:false,logging:false,width:RW,windowWidth:RW,scrollX:0,scrollY:0});
  const pdf=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
  const pagePx=Math.floor(CH*PPM);let off=0,first=true;
  while(off<canvas.height){
   if(!first)pdf.addPage('a3','landscape');first=false;
   const h=Math.min(pagePx,canvas.height-off),slice=document.createElement('canvas');slice.width=canvas.width;slice.height=h;
   slice.getContext('2d').drawImage(canvas,0,off,canvas.width,h,0,0,slice.width,slice.height);
   pdf.addImage(slice.toDataURL('image/jpeg',.96),'JPEG',A3.margin,A3.margin,CW,Math.min(CH,h/PPM),undefined,'FAST');off+=h;
  }
  pdf.save(filename+'-'+new Date().toISOString().slice(0,10)+'.pdf');
 }catch(e){console.error(e);alert('Unable to save PDF. Please try again.')}finally{holder?.remove();if(button){button.disabled=false;button.textContent=old||'Save PDF'}}
}
window.TERAJU_CARD_PDF={save};
})();