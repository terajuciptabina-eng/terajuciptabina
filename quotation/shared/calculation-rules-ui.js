/* TERAJU WORKS — Global Calculation Rules UI
   Shared hierarchy renderer. Pages supply their own page-specific columns. */
(function(global){
  const UI={
    esc(value){
      return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    },
    pathParts(rule){
      return String(rule?.path||'').split('/').map(x=>x.trim()).filter(Boolean);
    },
    leaf(rule){
      const parts=this.pathParts(rule);
      return parts.length?parts[parts.length-1]:String(rule?.path||'');
    },
    hierarchyRows(rule,seen,colSpan){
      const parts=this.pathParts(rule),span=Number(colSpan)||1;
      let html='';
      for(let i=0;i<parts.length-1;i++){
        const key=String(rule?.group||'')+'|'+parts.slice(0,i+1).join(' / ');
        if(seen.has(key))continue;
        seen.add(key);
        html+='<tr class="cr-hierarchy-row cr-level-'+(i+1)+'"><td colspan="'+span+'">'+this.esc(parts[i])+'</td></tr>';
      }
      return html;
    },
    groupRow(group,count,colSpan){
      return '<tr class="cr-group-row"><td colspan="'+(Number(colSpan)||1)+'">'+this.esc(group)+' · '+Number(count||0)+' rules</td></tr>';
    }
  };
  global.TerajuCalculationRulesUI=UI;
})(window);
