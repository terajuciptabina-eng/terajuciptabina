(() => {
  const WIDTHS = ['5%','55%','10%','15%','15%'];
  function enforce() {
    document.querySelectorAll('#quotationContent table.detailed-quotation-table').forEach(table => {
      table.style.setProperty('width','100%','important');
      table.style.setProperty('table-layout','fixed','important');
      table.style.setProperty('border-collapse','collapse','important');
      const cols = table.querySelectorAll(':scope > colgroup > col');
      WIDTHS.forEach((w,i)=>{ if(cols[i]) cols[i].style.setProperty('width',w,'important'); });
      table.querySelectorAll('tr').forEach(row => {
        const cells = row.children;
        if(cells.length !== 5) return;
        WIDTHS.forEach((w,i)=>{
          cells[i].style.setProperty('width',w,'important');
          cells[i].style.setProperty('min-width','0','important');
          cells[i].style.setProperty('max-width',w,'important');
          cells[i].style.boxSizing='border-box';
          cells[i].style.whiteSpace=i===1?'normal':'nowrap';
          cells[i].style.overflowWrap=i===1?'normal':'normal';
          cells[i].style.wordBreak=i===1?'normal':'normal';
          cells[i].style.textAlign=i===0||i===1?'left':'right';
        });
      });
    });
  }
  function start(){ enforce(); const root=document.getElementById('quotationContent'); if(!root)return; new MutationObserver(()=>{enforce();}).observe(root,{childList:true,subtree:true}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();