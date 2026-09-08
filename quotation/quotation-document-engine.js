(function(){
  'use strict';

  // Shared quotation document engine for Build Planner + Renovation Planner.
  // This module owns visual preview, A4 pagination and PDF export.
  // Planner base files only need to generate #quotationContent.

  const PAGE_MM = { width: 210, height: 297, margin: 10 };
  const CONTENT_MM = { width: 190, height: 277 };
  const RENDER_WIDTH_PX = 794;
  const JPEG_QUALITY = 0.94;

  function injectStyles(){
    if(document.getElementById('tc-quotation-document-engine-style')) return;
    const style=document.createElement('style');
    style.id='tc-quotation-document-engine-style';
    style.textContent=`
      #quotationPreview.quotation-preview-stage{
        width:100%!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        gap:28px!important;
        overflow-x:hidden!important;
        background:#e5e7eb!important;
        padding:28px 16px!important;
        border-radius:16px!important;
        box-sizing:border-box!important;
      }
      #quotationPreview .quotation-preview-page{
        position:relative!important;
        width:min(210mm,100%)!important;
        aspect-ratio:210 / 297!important;
        box-sizing:border-box!important;
        background:#fff!important;
        border:1px solid #cbd5e1!important;
        box-shadow:0 14px 36px rgba(15,23,42,.14)!important;
        overflow:hidden!important;
        padding:10mm!important;
        flex:0 0 auto!important;
      }
      #quotationPreview .quotation-preview-page img{
        display:block!important;
        width:100%!important;
        height:auto!important;
        max-width:none!important;
      }
      #quotationPreview .quotation-preview-page-number{
        position:absolute!important;
        left:0!important;
        right:0!important;
        bottom:3mm!important;
        text-align:center!important;
        font-size:10px!important;
        line-height:1!important;
        color:#6b7280!important;
        font-family:Arial,Helvetica,sans-serif!important;
        pointer-events:none!important;
      }
      #quotationPreview .quotation-preview-loading{
        width:100%;
        padding:32px 20px;
        text-align:center;
        border:1px dashed #d1d5db;
        border-radius:16px;
        background:#fafafa;
        color:#6b7280;
      }
      @media(max-width:767px){
        #quotationPreview.quotation-preview-stage{gap:20px!important;padding:16px 8px!important}
        #quotationPreview .quotation-preview-page{width:100%!important;box-shadow:0 8px 24px rgba(15,23,42,.08)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function loadScript(src,test){
    return new Promise((resolve,reject)=>{
      if(test()) return resolve();
      const existing=document.querySelector(`script[data-tc-src="${src}"]`);
      if(existing){
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',reject,{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src=src;
      script.dataset.tcSrc=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Unable to load quotation document component.'));
      document.head.appendChild(script);
    });
  }

  async function loadQuotationCanvas(){
    await loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      ()=>typeof window.html2canvas==='function'
    );
  }

  function waitForImages(root){
    return Promise.all(Array.from(root.querySelectorAll('img')).map(img=>{
      if(img.complete && img.naturalWidth>0) return Promise.resolve();
      return new Promise(resolve=>{
        img.addEventListener('load',resolve,{once:true});
        img.addEventListener('error',resolve,{once:true});
      });
    }));
  }

  function buildPageImages(canvas){
    const pxPerMm=canvas.width/CONTENT_MM.width;
    const sliceHeightPx=Math.max(1,Math.floor(CONTENT_MM.height*pxPerMm));
    const pages=[];
    let y=0;

    while(y<canvas.height){
      const heightPx=Math.min(sliceHeightPx,canvas.height-y);
      const pageCanvas=document.createElement('canvas');
      pageCanvas.width=canvas.width;
      pageCanvas.height=heightPx;
      const ctx=pageCanvas.getContext('2d');
      ctx.fillStyle='#fff';
      ctx.fillRect(0,0,pageCanvas.width,pageCanvas.height);
      ctx.drawImage(canvas,0,y,canvas.width,heightPx,0,0,canvas.width,heightPx);
      pages.push({
        src:pageCanvas.toDataURL('image/jpeg',JPEG_QUALITY),
        heightMm:heightPx/pxPerMm
      });
      y+=heightPx;
    }
    return pages;
  }

  async function renderQuotationPreview(){
    injectStyles();
    const source=document.getElementById('quotationContent');
    const stage=document.getElementById('quotationPreview');
    if(!source||!stage) return;

    stage.innerHTML='<div class="quotation-preview-loading">Preparing visual quotation preview…</div>';

    try{
      await loadQuotationCanvas();

      const clone=source.cloneNode(true);
      clone.classList.remove('quotation-render-source');
      clone.classList.remove('quotation-locked');
      clone.querySelectorAll('.no-print,#quotationPrintActions,#quotationLockOverlay').forEach(el=>el.remove());
      clone.style.paddingBottom='32px';

      const holder=document.createElement('div');
      holder.style.cssText=`position:fixed;left:-100000px;top:0;width:${RENDER_WIDTH_PX}px;background:#fff;padding:0;margin:0;overflow:visible;z-index:-1;visibility:visible`;
      holder.appendChild(clone);
      document.body.appendChild(holder);

      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(document.fonts?.ready) await document.fonts.ready;
      await waitForImages(holder);

      const canvas=await window.html2canvas(holder,{
        backgroundColor:'#fff',
        scale:Math.min(2,Math.max(1.5,window.devicePixelRatio||1)),
        useCORS:true,
        allowTaint:false,
        logging:false,
        imageTimeout:15000,
        scrollX:0,
        scrollY:0,
        windowWidth:RENDER_WIDTH_PX,
        windowHeight:Math.max(holder.scrollHeight,1)
      });

      holder.remove();

      const pages=buildPageImages(canvas);
      window.__quotationPreviewPages=pages.map(page=>page.src);
      window.__quotationPreviewPageMeta=pages;

      stage.innerHTML=pages.map((page,index)=>`
        <div class="quotation-preview-page">
          <img src="${page.src}" alt="Quotation page ${index+1}">
          <div class="quotation-preview-page-number">Page ${index+1} of ${pages.length}</div>
        </div>`).join('');
    }catch(error){
      console.error(error);
      stage.innerHTML='<div class="quotation-preview-loading">Unable to prepare the visual preview. You can still try Download PDF.</div>';
    }
  }

  async function printQuotation(){
    const quotation=document.getElementById('quotationDocument');
    if(!quotation||quotation.classList.contains('hidden')){
      alert('Please generate the quotation first.');
      return;
    }

    const button=document.querySelector('#quotationPrintActions button');
    const originalLabel=button?button.textContent:'';
    if(button){button.disabled=true;button.textContent='Preparing PDF…';}

    try{
      if(!window.__quotationPreviewPages?.length) await renderQuotationPreview();
      const pages=window.__quotationPreviewPages||[];
      const meta=window.__quotationPreviewPageMeta||[];
      if(!pages.length) throw new Error('Quotation preview is unavailable.');

      await loadScript(
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        ()=>!!(window.jspdf&&window.jspdf.jsPDF)
      );

      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation:'p',unit:'mm',format:'a4',compress:true});

      pages.forEach((src,index)=>{
        if(index) pdf.addPage();

        // IMPORTANT: never force the final, shorter slice to 277mm.
        // Preserve its natural height so the last page keeps white space instead of stretching.
        const imageHeight=meta[index]?.heightMm || CONTENT_MM.height;
        const drawHeight=Math.min(CONTENT_MM.height,Math.max(0.1,imageHeight));
        pdf.addImage(src,'JPEG',PAGE_MM.margin,PAGE_MM.margin,CONTENT_MM.width,drawHeight,undefined,'FAST');

        pdf.setFontSize(8);
        pdf.setTextColor(107,114,128);
        pdf.text(`Page ${index+1} of ${pages.length}`,PAGE_MM.width/2,PAGE_MM.height-4,{align:'center'});
      });

      const safeNumber=(typeof quotationNumber!=='undefined'&&quotationNumber?quotationNumber:'quotation').replace(/[^a-z0-9_-]+/gi,'-');
      pdf.save(`Quotation-${safeNumber}.pdf`);
    }catch(error){
      console.error(error);
      alert('Unable to create the PDF. Please check your internet connection and try again.');
    }finally{
      if(button){button.disabled=false;button.textContent=originalLabel||'Download PDF';}
    }
  }

  function bindQuotationTypeCards(){
    const inputs=document.querySelectorAll('input[name="quotationType"]');
    if(!inputs.length) return;
    const sync=()=>{
      document.querySelectorAll('.quotation-type-card').forEach(card=>{
        const input=card.querySelector('input[name="quotationType"]');
        if(input) card.classList.toggle('is-selected',!!input.checked);
      });
      if(typeof window.saveContractorState==='function') window.saveContractorState();
    };
    inputs.forEach(input=>input.addEventListener('change',sync));
    document.querySelectorAll('.quotation-type-card').forEach(card=>card.addEventListener('click',()=>{
      const input=card.querySelector('input[name="quotationType"]');
      if(!input) return;
      input.checked=true;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }));
    sync();
  }

  function install(){
    injectStyles();
    bindQuotationTypeCards();
    window.renderQuotationPreview=renderQuotationPreview;
    window.printQuotation=printQuotation;
    window.TERAJU_QUOTATION_DOCUMENT_ENGINE_VERSION='2026-09-08-natural-page-height';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
