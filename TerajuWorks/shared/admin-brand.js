/* Shared TERAJUWORKS Admin brand injector.
   The logo is structural branding, not page-specific text, so every Admin tool gets the same identity. */
(function(){
  function addLogo(host, dark){
    if(!host || host.querySelector('.admin-global-brand-surface,.admin-global-brand')) return;
    const surface=document.createElement('div');
    surface.className='admin-global-brand-surface';
    const img=document.createElement('img');
    img.className='admin-global-brand';
    img.src='../images/terajuworks.svg';
    img.alt='TERAJUWORKS';
    surface.appendChild(img);
    host.insertBefore(surface,host.firstChild);
  }
  function init(){
    const hosts=[];
    document.querySelectorAll('.header .top > div:first-child, .header-inner .brand, main.page .top > div:first-child').forEach(el=>hosts.push(el));
    hosts.forEach(host=>{
      const header=host.closest('.header');
      addLogo(host, !!header);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();