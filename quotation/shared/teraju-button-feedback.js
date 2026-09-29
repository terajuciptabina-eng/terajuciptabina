/* TERAJU WORKS — global button interaction feedback
 * Source-level interaction layer: no action logic is changed.
 */
(function(){
  'use strict';
  if(window.__TERAJU_BUTTON_FEEDBACK_V1)return;
  window.__TERAJU_BUTTON_FEEDBACK_V1=true;

  const style=document.createElement('style');
  style.id='tc-button-feedback-v1';
  style.textContent=`
    button:not(:disabled),
    [role="button"]:not([aria-disabled="true"]){
      -webkit-tap-highlight-color:transparent;
      touch-action:manipulation;
      transition:transform .12s ease,box-shadow .12s ease,filter .12s ease,background-color .12s ease,border-color .12s ease!important;
    }
    button:not(:disabled):active,
    [role="button"]:not([aria-disabled="true"]):active,
    .tc-button-pressed{
      transform:translateY(1px) scale(.985)!important;
      filter:brightness(.96);
    }
    .tc-button-ripple{
      position:absolute;
      width:18px;height:18px;
      border-radius:999px;
      pointer-events:none;
      background:currentColor;
      opacity:.16;
      transform:translate(-50%,-50%) scale(0);
      animation:tcButtonRipple .42s ease-out forwards;
    }
    @keyframes tcButtonRipple{
      to{transform:translate(-50%,-50%) scale(9);opacity:0}
    }
    @media(prefers-reduced-motion:reduce){
      button:not(:disabled),
      [role="button"]:not([aria-disabled="true"]){transition:none!important}
      .tc-button-ripple{display:none!important}
    }
  `;
  (document.head||document.documentElement).appendChild(style);

  function targetButton(event){
    const el=event.target.closest?.('button,[role="button"]');
    if(!el||el.disabled||el.getAttribute('aria-disabled')==='true')return null;
    return el;
  }

  document.addEventListener('pointerdown',function(event){
    if(event.button!==undefined&&event.button!==0)return;
    const button=targetButton(event);
    if(!button)return;
    button.classList.add('tc-button-pressed');
    clearTimeout(button.__tcPressTimer);
    button.__tcPressTimer=setTimeout(()=>button.classList.remove('tc-button-pressed'),180);

    if(event.pointerType==='mouse'&&event.detail===0)return;
    const rect=button.getBoundingClientRect();
    const ripple=document.createElement('span');
    ripple.className='tc-button-ripple';
    if(getComputedStyle(button).position==='static')button.style.position='relative';
    ripple.style.left=((event.clientX||rect.left+rect.width/2)-rect.left)+'px';
    ripple.style.top=((event.clientY||rect.top+rect.height/2)-rect.top)+'px';
    button.appendChild(ripple);
    ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
  },true);

  document.addEventListener('pointerup',function(event){
    const button=targetButton(event);
    if(button)button.classList.remove('tc-button-pressed');
  },true);

  document.addEventListener('pointercancel',function(event){
    const button=targetButton(event);
    if(button)button.classList.remove('tc-button-pressed');
  },true);
})();