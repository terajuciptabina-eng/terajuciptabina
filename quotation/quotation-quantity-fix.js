(() => {
  const DETAILED_WIDTHS = ['5%','55%','10%','15%','15%'];

  function enforceDetailed() {
    document.querySelectorAll('#quotationContent table.detailed-quotation-table').forEach(table => {
      table.style.setProperty('width','100%','important');
      table.style.setProperty('table-layout','fixed','important');
      table.style.setProperty('border-collapse','collapse','important');

      const cols = table.querySelectorAll(':scope > colgroup > col');
      DETAILED_WIDTHS.forEach((w,i) => {
        if (cols[i]) cols[i].style.setProperty('width',w,'important');
      });

      table.querySelectorAll('tr').forEach(row => {
        const cells = row.children;
        if (cells.length !== 5) return;
        DETAILED_WIDTHS.forEach((w,i) => {
          cells[i].style.setProperty('width',w,'important');
          cells[i].style.setProperty('min-width','0','important');
          cells[i].style.setProperty('max-width',w,'important');
          cells[i].style.boxSizing='border-box';
          cells[i].style.whiteSpace=i===1?'normal':'nowrap';
          cells[i].style.overflowWrap='normal';
          cells[i].style.wordBreak='normal';
          cells[i].style.textAlign=i<2?'left':'right';
        });
      });
    });
  }

  function enforceSimple() {
    document.querySelectorAll('#quotationContent table.simple-quotation-table').forEach(table => {
      table.style.setProperty('width','100%','important');
      table.style.setProperty('table-layout','fixed','important');
      table.style.setProperty('border-collapse','collapse','important');

      const cols = table.querySelectorAll(':scope > colgroup > col');
      const cellsInHeader = table.querySelector('thead tr')?.children.length || 0;

      // Current Build Planner Simple renderer has 4 cells:
      // No. | Category / Room | Description | Amount.
      // Keep the approved visual layout by making Category / Room a hidden structural column.
      if (cellsInHeader === 4) {
        const widths = ['7%','0%','73%','20%'];
        widths.forEach((w,i) => {
          if (cols[i]) cols[i].style.setProperty('width',w,'important');
        });
        table.querySelectorAll('tr').forEach(row => {
          const cells = row.children;
          if (cells.length !== 4) return;
          cells[1].style.setProperty('display','none','important');
          cells[0].style.setProperty('width','7%','important');
          cells[2].style.setProperty('width','73%','important');
          cells[3].style.setProperty('width','20%','important');
          cells[0].style.textAlign='left';
          cells[2].style.textAlign='left';
          cells[3].style.textAlign='right';
        });
      }
    });
  }

  function enforce() {
    enforceDetailed();
    enforceSimple();
  }

  function start() {
    enforce();
    const root=document.getElementById('quotationContent');
    if (!root) return;
    new MutationObserver(() => enforce()).observe(root,{childList:true,subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();