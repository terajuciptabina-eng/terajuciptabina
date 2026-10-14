/* TERAJUWORKS — Canonical Cost / SQFT Metrics */
(function () {
  'use strict';
  if (window.TERAJU_COST_METRIC) return;

  const N = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const AREA = value => Math.max(0, N(value));
  const rate = (cost, sqft) => sqft > 0 ? cost / sqft : null;
  const MARKETS = {
    MYR: { symbol: 'RM', locale: 'en-MY' },
    SGD: { symbol: 'S$', locale: 'en-SG' },
    IDR: { symbol: 'Rp', locale: 'id-ID' },
    THB: { symbol: '฿', locale: 'th-TH' },
    PHP: { symbol: '₱', locale: 'en-PH' },
    VND: { symbol: '₫', locale: 'vi-VN' },
    BND: { symbol: 'B$', locale: 'en-BN' }
  };
  const market = () => {
    try {
      const value = typeof window.TERAJU_GET_PROJECT_COUNTRY === 'function'
        ? window.TERAJU_GET_PROJECT_COUNTRY() : null;
      const code = String(value?.currency || 'MYR').toUpperCase();
      return { ...MARKETS[code] || MARKETS.MYR, ...value };
    } catch (_) { return MARKETS.MYR; }
  };
  const format = (value, locale) => N(value).toLocaleString(locale || 'en-MY', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const money = value => format(value, market().locale);
  const currency = () => market().symbol || 'RM';
  const moneyWithCurrency = value => currency() + ' ' + money(value);
  function roomsFor(value) {
    return Array.isArray(value) ? value.map(room => ({
      roomId: String(room?.roomId ?? room?.id ?? ''),
      condition: String(room?.condition ?? 'existing').toLowerCase() === 'new' ? 'new' : 'existing',
      area: AREA(room?.area),
      label: String(room?.label ?? room?.name ?? '')
    })).filter(room => room.area > 0) : [];
  }
  function summarize(plannerType, items, rooms) {
    const list = Array.isArray(items) ? items : [];
    const rs = roomsFor(rooms);
    if (String(plannerType).toLowerCase() === 'renovation') {
      const existingIds = new Set(rs.filter(room => room.condition === 'existing').map(room => room.roomId));
      const newIds = new Set(rs.filter(room => room.condition === 'new').map(room => room.roomId));
      const existingArea = rs.filter(room => room.condition === 'existing').reduce((sum, room) => sum + room.area, 0);
      const newArea = rs.filter(room => room.condition === 'new').reduce((sum, room) => sum + room.area, 0);
      const isPrelim = item => String(item?.category || '').toLowerCase() === 'preliminaries' || String(item?.id || '') === 'project-preliminaries';
      const isExternal = item => String(item?.category || '').toLowerCase() === 'external-work';
      const existingItems = list.filter(item => existingIds.has(String(item?.roomId ?? '')));
      const newItems = list.filter(item => (String(item?.roomId ?? '') === 'project' || newIds.has(String(item?.roomId ?? ''))) && !isPrelim(item) && !isExternal(item));
      const existingCost = existingItems.reduce((sum, item) => sum + N(item?.amount), 0);
      const newCost = newItems.reduce((sum, item) => sum + N(item?.amount), 0);
      return {
        plannerType: 'renovation', existingArea, newArea, existingCost, newCost,
        existingRate: existingItems.length ? rate(existingCost, existingArea) : null,
        newRate: newItems.length ? rate(newCost, newArea) : null,
        totalArea: existingArea + newArea,
        totalCost: list.reduce((sum, item) => sum + N(item?.amount), 0),
        hasItemSnapshot: list.length > 0
      };
    }
    const builtUpArea = rs.reduce((sum, room) => sum + room.area, 0);
    const totalCost = list.reduce((sum, item) => sum + N(item?.amount), 0);
    return { plannerType: 'build', builtUpArea, totalCost, costPerSqft: rate(totalCost, builtUpArea) };
  }
  function html(summary, mode) {
    mode = mode || 'compact';
    if (summary?.plannerType === 'renovation') {
      return '<div class="teraju-cost-sqft-grid ' + (mode === 'card' ? '' : 'budget') + '">' +
        '<div><p class="teraju-cost-sqft-label">Existing Area</p><p class="teraju-cost-sqft-value">' + money(summary.existingArea) + ' sqft</p></div>' +
        '<div><p class="teraju-cost-sqft-label">Existing ' + currency() + '/sqft</p><p class="teraju-cost-sqft-value">' + (summary.existingRate == null ? '—' : moneyWithCurrency(summary.existingRate) + '/sqft') + '</p></div>' +
        '<div><p class="teraju-cost-sqft-label">New Area</p><p class="teraju-cost-sqft-value">' + money(summary.newArea) + ' sqft</p></div>' +
        '<div><p class="teraju-cost-sqft-label">New ' + currency() + '/sqft</p><p class="teraju-cost-sqft-value">' + (summary.newRate == null ? '—' : moneyWithCurrency(summary.newRate) + '/sqft') + '</p></div></div>';
    }
    return '<div class="teraju-cost-sqft-grid ' + (mode === 'card' ? '' : 'budget') + '">' +
      '<div><p class="teraju-cost-sqft-label">Built-up Area</p><p class="teraju-cost-sqft-value">' + money(summary.builtUpArea) + ' sqft</p></div>' +
      '<div><p class="teraju-cost-sqft-label">' + currency() + '/sqft</p><p class="teraju-cost-sqft-value">' + (summary.costPerSqft == null ? '—' : moneyWithCurrency(summary.costPerSqft) + '/sqft') + '</p></div></div>';
  }
  function history(summary, quotation) {
    const code = String(quotation?.currency || quotation?.plannerState?.currency || quotation?.plannerState?.projectCountry?.currency || ({ MY: 'MYR', SG: 'SGD', ID: 'IDR', TH: 'THB', PH: 'PHP', VN: 'VND', BN: 'BND' }[quotation?.countryCode || quotation?.plannerState?.projectCountry?.countryCode] || 'MYR')).toUpperCase();
    const selected = MARKETS[code] || MARKETS.MYR;
    const symbol = quotation?.currencySymbol || quotation?.plannerState?.projectCountry?.symbol || selected.symbol;
    const moneyForEstimate = value => symbol + ' ' + format(value, selected.locale);
    if (summary?.plannerType === 'renovation') {
      return '<div class="mt-3 flex flex-wrap gap-2 text-[10px] font-bold tracking-wide">' +
        '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Existing ' + format(summary.existingArea, selected.locale) + ' sqft · ' + (summary.existingRate == null ? '—' : moneyForEstimate(summary.existingRate)) + '/sqft</span>' +
        '<span class="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">New ' + format(summary.newArea, selected.locale) + ' sqft · ' + (summary.newRate == null ? '—' : moneyForEstimate(summary.newRate)) + '/sqft</span></div>';
    }
    return '<div class="mt-3"><span class="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-700">' +
      format(summary.builtUpArea, selected.locale) + ' sqft · ' +
      (summary.costPerSqft == null ? '—' : moneyForEstimate(summary.costPerSqft)) + '/sqft</span></div>';
  }
  if (!document.getElementById('teraju-cost-sqft-style')) {
    const style = document.createElement('style');
    style.id = 'teraju-cost-sqft-style';
    style.textContent = '.teraju-cost-sqft-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px;padding:14px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc}.teraju-cost-sqft-grid.budget{grid-template-columns:repeat(2,minmax(0,1fr))}.teraju-cost-sqft-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;margin:0}.teraju-cost-sqft-value{font-size:14px;font-weight:700;color:#111827;margin:4px 0 0}.teraju-cost-sqft-grid>div{min-width:0}@media(max-width:640px){.teraju-cost-sqft-grid,.teraju-cost-sqft-grid.budget{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    document.head.appendChild(style);
  }
  window.TERAJU_COST_METRIC = { summarize, html, history, money };
})();
