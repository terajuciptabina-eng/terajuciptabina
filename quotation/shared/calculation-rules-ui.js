/* TERAJU WORKS — Global Calculation Rules UI
   Shared hierarchy renderer + global column-width standard.
   Every consumer that loads this file receives the latest global UI widths. */
(function(global){
  const UI_API='https://terajuciptabina.vercel.app/api/calculation-rules?ui=1';
  const UI_KEYS=['item','description','method','coefficient','formula','unit','basis','note','actions'];
  const DEFAULTS={item:'15%',description:'22%',method:'10%',coefficient:'11%',formula:'12%',unit:'6%',basis:'10%',note:'7%',actions:'7%'};
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
    },
    applyWidths(widths){
      const values={...DEFAULTS,...(widths||{})};
      for(const key of UI_KEYS){
        const value=/^\d+(?:\.\d+)?%$/.test(String(values[key]))?values[key]:DEFAULTS[key];
        document.documentElement.style.setProperty('--cr-col-'+key,value);
      }
      return values;
    },
    readCssWidths(source){
      const out={};
      for(const key of UI_KEYS){
        const m=String(source||'').match(new RegExp('--cr-col-'+key+'\\s*:\\s*([^;]+);'));
        const value=m?String(m[1]).trim():'';
        out[key]=/^\d+(?:\.\d+)?%$/.test(value)?value:DEFAULTS[key];
      }
      return out;
    },
    async loadWidths(){
      try{
        const url=UI_API+'&v='+Date.now();
        const r=await fetch(url,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
        const d=await r.json().catch(()=>({}));
        if(!r.ok||!d.columnWidths)throw new Error('Global Calculation Rules UI standard unavailable.');
        this.applyWidths(d.columnWidths);
        return d.columnWidths;
      }catch(_){
        try{
          const cssUrl='shared/calculation-rules-ui.css?v='+Date.now();
          const css=await fetch(cssUrl,{cache:'no-store'}).then(r=>r.ok?r.text():Promise.reject(new Error('CSS unavailable')));
          const widths=this.readCssWidths(css);
          this.applyWidths(widths);
          return widths;
        }catch(__){
          return this.applyWidths();
        }
      }
    }
  };
  global.TerajuCalculationRulesUI=UI;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>UI.loadWidths(),{once:true});
  else UI.loadWidths();
})(window);
