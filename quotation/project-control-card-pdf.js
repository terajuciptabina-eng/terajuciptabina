(function(){
'use strict';
if(window.__TERAJU_CARD_PDF__)return;
window.__TERAJU_CARD_PDF__=true;

const A3={w:420,h:297,margin:5};
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
  await load('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>typeof html2canvas==='function');
  await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>window.jspdf?.jsPDF);
}

/*
  Layout-agnostic export engine.
  The live page CSS remains the single source of truth.
  This file only handles cloning, rendering and pagination.
*/
function prepareClone(source,renderWidth){
  const clone=source.cloneNode(true);
  clone.querySelectorAll('.pdf-hide,.no-print').forEach(x=>x.remove());
  clone.style.width=renderWidth+'px';
  clone.style.maxWidth=renderWidth+'px';
  clone.style.margin='0';
  return clone;
}

function mount(clone,renderWidth){
  const holder=document.createElement('div');
  holder.style.cssText=[
    'position:fixed','left:-10000px','top:0',
    'width:'+renderWidth+'px','background:#fff',
    'z-index:-999999','padding:0','margin:0'
  ].join(';');
  holder.appendChild(clone);
  document.body.appendChild(holder);
  return holder;
}

async function waitPaint(){
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}

async function renderCanvas(clone,renderWidth){
  return html2canvas(clone,{
    backgroundColor:'#fff',
    scale:Math.min(2,Math.max(1.5,devicePixelRatio||1)),
    useCORS:true,
    allowTaint:false,
    logging:false,
    width:renderWidth,
    windowWidth:renderWidth,
    windowHeight:Math.max(window.innerHeight,Math.ceil(clone.scrollHeight||0)),
    scrollX:0,
    scrollY:0
  });
}

async function captureElement(source,renderWidth){
  const clone=prepareClone(source,renderWidth);
  const holder=mount(clone,renderWidth);
  await waitPaint();
  const canvas=await renderCanvas(clone,renderWidth);
  holder.remove();
  return canvas;
}

/*
  Tables are paginated by rows instead of cutting an arbitrary canvas slice.
  The table header is therefore repeated on every generated page.
  This applies only to the exported clone; the live source is untouched.
*/
async function captureTableChunks(source,renderWidth){
  const sourceTable=source.querySelector('table');
  if(!sourceTable)return [await captureElement(source,renderWidth)];

  const sourceBody=sourceTable.querySelector('tbody');
  if(!sourceBody)return [await captureElement(source,renderWidth)];

  const rows=Array.from(sourceBody.children);
  if(!rows.length)return [await captureElement(source,renderWidth)];

  const maxPagePx=Math.floor((CH/CW)*renderWidth);
  const canvases=[];
  let cursor=0;

  while(cursor<rows.length){
    let bestEnd=cursor+1;

    for(let end=cursor+1;end<=rows.length;end++){
      const clone=prepareClone(source,renderWidth);
      const table=clone.querySelector('table');
      const body=table?.querySelector('tbody');
      if(!body)break;

      const cloneRows=Array.from(body.children);
      cloneRows.forEach(x=>x.remove());
      rows.slice(cursor,end).forEach(row=>body.appendChild(row.cloneNode(true)));

      const holder=mount(clone,renderWidth);
      await waitPaint();
      const h=Math.ceil(clone.getBoundingClientRect().height);
      holder.remove();

      if(h<=maxPagePx || end===cursor+1){
        bestEnd=end;
        if(h>maxPagePx)break;
      }else{
        break;
      }
    }

    const finalClone=prepareClone(source,renderWidth);
    const finalTable=finalClone.querySelector('table');
    const finalBody=finalTable?.querySelector('tbody');
    if(!finalBody)break;

    Array.from(finalBody.children).forEach(x=>x.remove());
    rows.slice(cursor,bestEnd).forEach(row=>finalBody.appendChild(row.cloneNode(true)));

    const holder=mount(finalClone,renderWidth);
    await waitPaint();
    const canvas=await renderCanvas(finalClone,renderWidth);
    holder.remove();

    canvases.push(canvas);
    cursor=bestEnd;
  }

  return canvases;
}

function addCanvasPages(pdf,canvas,state){
  const pxPerMm=canvas.width/CW;
  const pagePx=Math.max(1,Math.floor(CH*pxPerMm));
  let off=0;

  while(off<canvas.height){
    if(state.added)pdf.addPage('a3','landscape');
    state.added=true;

    const h=Math.min(pagePx,canvas.height-off);
    const slice=document.createElement('canvas');
    slice.width=canvas.width;
    slice.height=h;

    slice.getContext('2d').drawImage(
      canvas,0,off,canvas.width,h,
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

    const state={added:false};

    for(const target of targets){
      const rect=target.getBoundingClientRect();
      const renderWidth=Math.max(1,Math.round(rect.width));

      if(target.id!=='sCurvePage' && target.querySelector('table')){
        const canvases=await captureTableChunks(target,renderWidth);
        canvases.forEach(canvas=>addCanvasPages(pdf,canvas,state));
      }else{
        const canvas=await captureElement(target,renderWidth);
        addCanvasPages(pdf,canvas,state);
      }
    }

    if(state.added){
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