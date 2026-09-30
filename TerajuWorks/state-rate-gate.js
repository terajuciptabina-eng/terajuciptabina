/* TERAJU state-first quotation flow.
   The rate master is partitioned by Malaysian state.
   State selection is mandatory before quotation entry.
*/
(function(){
  'use strict';

  const STATES=[
    ['johor','Johor'],['kedah','Kedah'],['kelantan','Kelantan'],['melaka','Melaka'],
    ['negeri-sembilan','Negeri Sembilan'],['pahang','Pahang'],['perak','Perak'],['perlis','Perlis'],
    ['pulau-pinang','Pulau Pinang'],['sabah','Sabah'],['sarawak','Sarawak'],['selangor','Selangor'],
    ['terengganu','Terengganu'],['kuala-lumpur','Kuala Lumpur'],['putrajaya','Putrajaya'],['labuan','Labuan']
  ];
  const STORAGE_KEY='teraju.planner.state.v1';

  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function selected(){try{return String(localStorage.getItem(STORAGE_KEY)||'').trim()}catch(e){return ''}}
  function setSelected(v){try{localStorage.setItem(STORAGE_KEY,v)}catch(e){};window.TERAJU_SELECTED_STATE=v;}

  function loadResolver(){
    if(document.querySelector('script[data-teraju-state-rate-resolver]'))return;
    const script=document.createElement('script');
    script.src='state-rate-resolver.js?v='+Date.now();
    script.async=false;
    script.dataset.terajuStateRateResolver='1';
    document.head.appendChild(script);
  }

  function install(){
    const locationInput=document.getElementById('projectLocation');
    if(!locationInput){loadResolver();return;}
    if(document.getElementById('projectState')){loadResolver();return;}

    const field=locationInput.closest('div');
    if(!field || !field.parentElement){loadResolver();return;}

    const stateWrap=document.createElement('div');
    stateWrap.className='mb-4';
    stateWrap.innerHTML='<label for="projectState" class="block text-sm font-medium mb-2">State / Negeri <span class="text-red-600">*</span></label>'+
      '<select id="projectState" required class="w-full border rounded-lg px-4 py-3 bg-white">'+
      '<option value="">Select state / negeri</option>'+STATES.map(s=>`<option value="${s[0]}">${esc(s[1])}</option>`).join('')+'</select>'+
      '<p class="text-xs text-gray-500 mt-1">Select the project state before entering the quotation details.</p>';
    field.parentElement.insertBefore(stateWrap,field);

    const select=document.getElementById('projectState');
    if(!select){loadResolver();return;}

    const saved=selected();
    if(saved && STATES.some(s=>s[0]===saved))select.value=saved;

    const controls=[...document.querySelectorAll('main input, main select, main textarea, main button')].filter(el=>el!==select);
    const lock=document.createElement('div');
    lock.id='stateFirstOverlay';
    lock.className='no-print fixed inset-0 z-[9000] hidden items-center justify-center p-5 bg-black/20 backdrop-blur-[1px]';
    lock.innerHTML='<div id="stateFirstCard" class="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl border"><div class="text-3xl mb-3">📍</div><h3 class="text-xl font-bold">Select Project State First</h3><p class="text-sm text-gray-600 mt-2">Choose the state / negeri where this project is located. The quotation will use that state\'s rate set.</p><button type="button" id="stateFirstButton" class="mt-5 w-full bg-black text-white px-5 py-3 rounded-xl font-semibold">Choose State</button></div>';
    document.body.appendChild(lock);

    const chooseState=()=>{
      lock.classList.add('hidden');
      lock.classList.remove('flex');
      select.disabled=false;
      select.removeAttribute('aria-disabled');
      select.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>{
        try{
          if(typeof select.showPicker==='function') select.showPicker();
          else select.focus();
        }catch(e){select.focus();}
      },120);
    };

    function apply(){
      const ok=!!select.value;
      controls.forEach(el=>{
        el.disabled=!ok;
        el.setAttribute('aria-disabled',String(!ok));
      });
      select.disabled=false;
      lock.classList.toggle('hidden',ok);
      lock.classList.toggle('flex',!ok);
      if(ok){
        setSelected(select.value);
        locationInput.removeAttribute('disabled');
        window.TERAJU_SELECTED_STATE=select.value;
        loadResolver();
      }
    }

    select.addEventListener('change',function(){
      if(!select.value){apply();return}
      const previousState=String(window.TERAJU_SELECTED_STATE || selected() || '').trim().toLowerCase();
      setSelected(select.value);
      window.TERAJU_SELECTED_STATE=select.value;
      apply();
      try{window.dispatchEvent(new CustomEvent('teraju:statechange',{detail:{state:select.value,previousState:previousState||null}}))}catch(e){}
    });

    const stateFirstButton=document.getElementById('stateFirstButton');
    if(stateFirstButton){
      stateFirstButton.addEventListener('click',function(event){
        event.preventDefault();
        event.stopPropagation();
        chooseState();
      });
      stateFirstButton.addEventListener('pointerdown',function(event){
        event.stopPropagation();
      });
    }

    apply();
    loadResolver();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
