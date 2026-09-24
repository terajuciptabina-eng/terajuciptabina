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
    s.src=src;
    s.onload=res;
    s.onerror=()=>rej(new Error('PDF component failed to load'));
    document.head.appendChild(s);
  });
}

async function deps(){
  await load(
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    ()=>typeof html2canvas==='function'
  );
  await load(
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    ()=>window.jspdf?.jsPDF
  );
}

/*
  This engine is intentionally layout-agnostic.
  Page CSS is the single source of truth.
  The PDF engine only:
  1. clones the requested source element,
  2. removes PDF-only UI,
  3. renders it at the source element's current width,
  4. paginates the rendered image into A3 landscape pages.
*/
async function captureElement(source,renderWidth){
  const clone=source.cloneNode(true);
  clone.querySelectorAll('.pdf-hide,.no-print').forEach(x=>x.remove());

  clone.style.width=renderWidth+'px';
  clone.style.maxWidth=renderWidth+'px';
  clone.style.margin='0';

  const holder=document.createElement('div');
  holder.style.cssText=[
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:'+renderWidth+'px',
    'background:#fff',
    'z-index:-999999',
    'padding:0',
    'margin:0'
  ].join(';');

  holder.appendChild(clone);
  document.body.appendChild(holder);

  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

  const canvas=await html2canvas(clone,{
    backgroundColor:'#fff',
    scale:Math.min(2,Math.max(1.5,devicePixelRatio||1)),
    useCORS:true,
    allowTaint:false,
    logging:false,
    width:renderWidth,
    windowWidth:renderWidth,
    scrollX:0,
    scrollY:0
  });

  holder.remove();
  return canvas;
}

async function save(id,filename,button){
  const source=document.getElementById(id);
  if(!source)return;

  const old=button?.textContent;
  if(button){
    button.disabled=true;
    button.textContent='Saving PDF…';
  }

  try{
    await deps();
    if(document.fonts?.ready)await document.fonts.ready;

    const pdf=new jspdf.jsPDF({
      orientation:'landscape',
      unit:'mm',
      format:'a3',
      compress:true
    });

    const sectionIds=(button?.dataset.pdfSections||'')
      .split(',')
      .map(x=>x.trim())
      .filter(Boolean);

    const targets=sectionIds.length
      ? sectionIds.map(x=>document.getElementById(x)).filter(Boolean)
      : [source];

    let added=false;

    for(const target of targets){
      const rect=target.getBoundingClientRect();
      const renderWidth=Math.max(1,Math.round(rect.width));
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

        slice.getContext('2d').drawImage(
          canvas,
          0,off,canvas.width,h,
          0,0,slice.width,slice.height
        );

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

    if(added){
      pdf.save(filename+'-'+new Date().toISOString().slice(0,10)+'.pdf');
    }
  }catch(e){
    console.error(e);
    alert('Unable to save PDF. Please try again.');
  }finally{
    if(button){
      button.disabled=false;
      button.textContent=old||'Save PDF';
    }
  }
}

window.TERAJU_CARD_PDF={save};
})();