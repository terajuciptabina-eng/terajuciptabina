/* Shared TERAJUWORKS Admin brand injector.
   The SVG is the complete logo/wordmark. No wrapper, no duplicate text. */
(function(){
  function addLogo(host){
    if(!host || host.querySelector('.admin-global-brand')) return;
    const img=document.createElement('img');
    img.className='admin-global-brand';
    img.src='../images/terajuworks.svg';
    img.alt='TERAJUWORKS';
    img.decoding='async';
    host.insertBefore(img,host.firstChild);
  }
  function init(){
    document.querySelectorAll('.header .top > div:first-child, .header-inner .brand, main.page .top > div:first-child')
      .forEach(addLogo);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();