from pathlib import Path
import re

CSS = '''/* Mobile quotation cards — single clean implementation */
@media (max-width: 767px) {
  #estimateContent{width:100%!important;max-width:100%!important;margin:0!important;padding-bottom:8px!important;overflow:visible!important}
  #estimateContent>.overflow-x-auto{width:100%!important;max-width:100%!important;overflow:visible!important}
  #estimateContent table{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;table-layout:auto!important;border-collapse:separate!important;border-spacing:0 12px!important}
  #estimateContent table thead{display:none!important}
  #estimateContent table tbody{display:block!important;width:100%!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100){display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0 10px!important;width:100%!important;min-width:0!important;max-width:100%!important;margin:0!important;padding:14px!important;border:1px solid #e5e7eb!important;border-radius:16px!important;background:#fff!important;box-shadow:0 4px 16px rgba(15,23,42,.05)!important;overflow:hidden!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td{display:block!important;width:auto!important;min-width:0!important;max-width:none!important;box-sizing:border-box!important;padding:6px 2px!important;overflow:visible!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:first-child{grid-column:1/-1!important;width:100%!important;padding:0 0 10px!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:first-child textarea,#estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:first-child .homeowner-locked{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;margin:0!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word!important;line-height:1.5!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:first-child textarea{min-height:88px!important;height:auto!important;resize:vertical!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(2){display:none!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(3),#estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(4),#estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(5){display:block!important;width:auto!important;min-width:0!important;max-width:none!important;overflow:hidden!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(3)::before{content:'Quantity'}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(4)::before{content:'Rate'}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(5)::before{content:'Amount'}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(3)::before,#estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(4)::before,#estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(5)::before{display:block;margin:0 0 4px;font-size:10px;line-height:1.2;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(3) input,#estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(4) input,#estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(3) .homeowner-locked,#estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(4) .homeowner-locked{width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(5){text-align:right!important;font-weight:700!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(6){grid-column:1/-1!important;width:100%!important;min-width:0!important;max-width:100%!important;margin-top:8px!important;padding:12px 0 0!important;border-top:1px solid #f1f5f9!important;text-align:left!important}
  #estimateContent table tbody tr:not(.quotation-section-row):not(.quotation-subsection-row):not(.bg-gray-100) td:nth-child(6) button{width:auto!important;min-width:84px!important}
  #estimateContent table tbody tr.quotation-section-row,#estimateContent table tbody tr.quotation-subsection-row,#estimateContent table tbody tr.bg-gray-100{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;padding:12px!important;margin:0!important}
  #estimateContent table tbody tr.quotation-section-row td,#estimateContent table tbody tr.quotation-subsection-row td,#estimateContent table tbody tr.bg-gray-100 td{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important}
  #estimateContent table tfoot tr{display:block!important;width:100%!important;min-width:0!important}
  #estimateContent table tfoot td{display:inline-block!important;width:auto!important;min-width:0!important;padding:6px 4px!important}
}'''

def clean_mobile(s):
    s = re.sub(r'\n\s*/\* Mobile UX — keep desktop/tablet layout unchanged \*/.*?(?=\n</style>)', '\n', s, flags=re.S)
    s = s.replace('      #estimateContent { width: calc(100% + 8px); margin-left: -4px; margin-right: -4px; padding-bottom: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; }', '      #estimateContent { width: 100%; margin: 0; padding-bottom: 8px; overflow: visible; }')
    s = s.replace('      #estimateContent > div, #estimateContent table { min-width: 760px; }', '')
    s = s.replace('      #estimateContent textarea { min-width: 260px !important; max-width: 320px; }', '')
    s = s.replace('      #quotationContent table { min-width: 680px; }', '')
    s = re.sub(r'\n\s*@media\(max-width:767px\)\{\s*#rateScheduleContent table\{min-width:560px!important\}\s*\}', '\n', s)
    return s.replace('</style>', '\n' + CSS + '\n</style>', 1)

def patch_build(s):
    old = ''' const row=(i,target)=>`<tr class="border-b align-top">
  <td class="py-3 px-2 min-w-[300px]"><textarea class="w-full border rounded-lg px-3 py-2 bg-white contractor-editable" onchange="editItemDescription('${i.id}',this.value)">${escapeHtml(i.description)}</textarea><div class="homeowner-locked py-2">${escapeHtml(i.description)}</div></td>
  <td class="py-3 px-2">${escapeHtml(i.unit)}</td>
  <td class="py-3 px-2"><input type="number" min="0" step="1" value="${normalizeQuantity(i.qty)}" class="w-24 border rounded-lg px-2 py-2 text-right contractor-editable" onchange="editItemQuantity('${i.id}',this.value)"><div class="homeowner-locked text-right py-2">${formatQty(i.qty)}</div></td>
  <td class="py-3 px-2"><input type="number" min="0" step="0.01" value="${normalizeRate(i.rate).toFixed(2)}" class="w-28 border rounded-lg px-2 py-2 text-right contractor-editable" onchange="editItemRate('${i.id}',this.value)"><div class="homeowner-locked text-right py-2">${money(i.rate,2)}</div></td>
  <td class="py-3 px-2 text-right font-medium">${money(i.amount,2)}</td>
  <td class="py-3 px-2"><button type="button" onclick="excludeItem('${i.id}')" class="text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs">Delete</button></td>
 </tr>`;'''
    new = ''' const row=(i,target)=>`<tr class="border-b align-top">
  <td class="py-3 px-2">${IS_CONTRACTOR ? `<textarea class="w-full border rounded-lg px-3 py-2 bg-white" onchange="editItemDescription('${i.id}',this.value)">${escapeHtml(i.description)}</textarea>` : `<div class="homeowner-locked py-2 rounded-lg">${escapeHtml(i.description)}</div>`}</td>
  <td class="py-3 px-2">${escapeHtml(i.unit)}</td>
  <td class="py-3 px-2">${IS_CONTRACTOR ? `<input type="number" min="0" step="1" value="${normalizeQuantity(i.qty)}" class="w-24 border rounded-lg px-2 py-2 text-right" onchange="editItemQuantity('${i.id}',this.value)">` : `<div class="homeowner-locked text-right py-2 rounded-lg">${formatQty(i.qty)}</div>`}</td>
  <td class="py-3 px-2">${IS_CONTRACTOR ? `<input type="number" min="0" step="0.01" value="${normalizeRate(i.rate).toFixed(2)}" class="w-28 border rounded-lg px-2 py-2 text-right" onchange="editItemRate('${i.id}',this.value)">` : `<div class="homeowner-locked text-right py-2 rounded-lg">${money(i.rate,2)}</div>`}</td>
  <td class="py-3 px-2 text-right font-medium">${money(i.amount,2)}</td>
  <td class="py-3 px-2"><button type="button" onclick="excludeItem('${i.id}')" class="text-red-600 border border-red-200 px-3 py-2 rounded-lg text-xs">Delete</button></td>
 </tr>`;'''
    if old not in s: raise SystemExit('Build quotation row pattern not found')
    return s.replace(old, new, 1)

def patch_renovation(s):
    pairs = [
('''          <td class="py-3 px-2 align-top">
            <textarea rows="2" onchange="editItemDescription('${item.id}', this.value)"
              class="contractor-only no-print w-full min-w-[280px] border rounded-lg px-3 py-2 bg-white leading-5 resize-y">${escapeHtml(item.description)}</textarea>
            <div class="homeowner-locked no-print p-2 rounded leading-5">${escapeHtml(item.description)}</div>
            <div class="hidden print:block leading-6">${escapeHtml(item.description)}</div>
          </td>''',
 '''          <td class="py-3 px-2 align-top">
            ${IS_CONTRACTOR ? `<textarea rows="2" onchange="editItemDescription('${item.id}', this.value)"
              class="w-full border rounded-lg px-3 py-2 bg-white leading-5 resize-y">${escapeHtml(item.description)}</textarea>`
              : `<div class="homeowner-locked p-2 rounded leading-5">${escapeHtml(item.description)}</div>`}
          </td>'''),
('''          <td class="py-3 px-2 text-right">
            <input type="number" min="0" step="1" value="${formatQty(item.qty)}" onchange="editItemQuantity('${item.id}', this.value)"
              class="contractor-only no-print w-24 border rounded-lg px-2 py-1.5 text-right bg-white">
            <span class="homeowner-locked no-print inline-block px-2 py-1.5 rounded text-sm">${formatQty(item.qty)}</span>
            <span class="hidden print:inline">${formatQty(item.qty)}</span>
          </td>''',
 '''          <td class="py-3 px-2 text-right">
            ${IS_CONTRACTOR ? `<input type="number" min="0" step="1" value="${formatQty(item.qty)}" onchange="editItemQuantity('${item.id}', this.value)"
              class="w-24 border rounded-lg px-2 py-1.5 text-right bg-white">`
              : `<span class="homeowner-locked inline-block px-2 py-1.5 rounded text-sm">${formatQty(item.qty)}</span>`}
          </td>'''),
('''          <td class="py-3 px-2 text-right">
            <input type="number" min="0" step="0.01" value="${Number(item.rate).toFixed(2)}" onchange="editItemRate('${item.id}', this.value)"
              class="contractor-only no-print w-28 border rounded-lg px-2 py-1.5 text-right bg-white">
            <span class="homeowner-locked no-print inline-block px-2 py-1.5 rounded text-sm">${money(item.rate, 2)}</span>
            <span class="hidden print:inline">${money(item.rate, 2)}</span>
          </td>''',
 '''          <td class="py-3 px-2 text-right">
            ${IS_CONTRACTOR ? `<input type="number" min="0" step="0.01" value="${Number(item.rate).toFixed(2)}" onchange="editItemRate('${item.id}', this.value)"
              class="w-28 border rounded-lg px-2 py-1.5 text-right bg-white">`
              : `<span class="homeowner-locked inline-block px-2 py-1.5 rounded text-sm">${money(item.rate, 2)}</span>`}
          </td>''')]
    for old,new in pairs:
        if old not in s: raise SystemExit('Renovation quotation pattern not found')
        s=s.replace(old,new,1)
    return s

b=Path('quotation/buildplanner.html'); r=Path('quotation/renovationplanner.html')
b.write_text(patch_build(clean_mobile(b.read_text(encoding='utf-8'))),encoding='utf-8')
r.write_text(patch_renovation(clean_mobile(r.read_text(encoding='utf-8'))),encoding='utf-8')
print('Planner patch applied.')
