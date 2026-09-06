(() => {
  if (document.getElementById('tcBuildPlannerAlignmentFix')) return;

  const style = document.createElement('style');
  style.id = 'tcBuildPlannerAlignmentFix';
  style.textContent = `
    #quotationContent .simple-quotation-table,
    #quotationContent .detailed-quotation-table {
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }

    #quotationContent .simple-quotation-table col:nth-child(1) { width: 5% !important; }
    #quotationContent .simple-quotation-table col:nth-child(2) { width: 20% !important; }
    #quotationContent .simple-quotation-table col:nth-child(3) { width: 55% !important; }
    #quotationContent .simple-quotation-table col:nth-child(4) { width: 20% !important; }

    #quotationContent .detailed-quotation-table col:nth-child(1) { width: 54% !important; }
    #quotationContent .detailed-quotation-table col:nth-child(2) { width: 8% !important; }
    #quotationContent .detailed-quotation-table col:nth-child(3) { width: 10% !important; }
    #quotationContent .detailed-quotation-table col:nth-child(4) { width: 14% !important; }
    #quotationContent .detailed-quotation-table col:nth-child(5) { width: 14% !important; }

    #quotationContent .simple-quotation-table th,
    #quotationContent .simple-quotation-table td,
    #quotationContent .detailed-quotation-table th,
    #quotationContent .detailed-quotation-table td {
      box-sizing: border-box !important;
      padding: 8px 8px !important;
      vertical-align: top !important;
      border-bottom: 1px solid #e5e7eb !important;
      overflow-wrap: break-word !important;
      word-break: normal !important;
      line-height: 1.45 !important;
    }

    #quotationContent .simple-quotation-table th:nth-child(3),
    #quotationContent .simple-quotation-table td:nth-child(3),
    #quotationContent .detailed-quotation-table th:nth-child(1),
    #quotationContent .detailed-quotation-table td:nth-child(1) {
      text-align: left !important;
      white-space: normal !important;
      padding-left: 8px !important;
      padding-right: 14px !important;
    }

    #quotationContent .simple-quotation-table th:nth-child(1),
    #quotationContent .simple-quotation-table td:nth-child(1) {
      text-align: center !important;
      white-space: nowrap !important;
    }

    #quotationContent .simple-quotation-table th:nth-child(2),
    #quotationContent .simple-quotation-table td:nth-child(2) {
      text-align: left !important;
      white-space: normal !important;
    }

    #quotationContent .simple-quotation-table th:nth-child(4),
    #quotationContent .simple-quotation-table td:nth-child(4),
    #quotationContent .detailed-quotation-table th:nth-child(3),
    #quotationContent .detailed-quotation-table td:nth-child(3),
    #quotationContent .detailed-quotation-table th:nth-child(4),
    #quotationContent .detailed-quotation-table td:nth-child(4),
    #quotationContent .detailed-quotation-table th:nth-child(5),
    #quotationContent .detailed-quotation-table td:nth-child(5) {
      text-align: right !important;
      white-space: nowrap !important;
      padding-left: 6px !important;
      padding-right: 8px !important;
    }

    #quotationContent .detailed-quotation-table th:nth-child(2),
    #quotationContent .detailed-quotation-table td:nth-child(2) {
      text-align: center !important;
      white-space: nowrap !important;
    }

    #quotationContent .simple-quotation-table thead th,
    #quotationContent .detailed-quotation-table thead th {
      background: #f8fafc !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      letter-spacing: .02em !important;
      border-top: 1px solid #d1d5db !important;
      border-bottom: 2px solid #111827 !important;
    }

    /* Real section breaks: one heading row, then the related work. */
    #quotationContent tr.tc-quotation-section-heading td {
      background: #e5e7eb !important;
      color: #111827 !important;
      font-weight: 800 !important;
      font-size: 11px !important;
      letter-spacing: .04em !important;
      text-transform: uppercase !important;
      border-top: 2px solid #9ca3af !important;
      border-bottom: 1px solid #9ca3af !important;
      padding: 9px 8px !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    #quotationContent tr.tc-quotation-room-heading td {
      background: #f8fafc !important;
      color: #374151 !important;
      font-weight: 700 !important;
      font-size: 10.5px !important;
      border-top: 1px solid #d1d5db !important;
      border-bottom: 1px solid #e5e7eb !important;
      padding: 7px 8px !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    #quotationContent .simple-quotation-table tfoot td,
    #quotationContent .detailed-quotation-table tfoot td {
      border-top: 2px solid #111827 !important;
      border-bottom: 0 !important;
      font-weight: 700 !important;
    }

    @media print {
      #quotationContent .simple-quotation-table col:nth-child(1) { width: 5% !important; }
      #quotationContent .simple-quotation-table col:nth-child(2) { width: 20% !important; }
      #quotationContent .simple-quotation-table col:nth-child(3) { width: 55% !important; }
      #quotationContent .simple-quotation-table col:nth-child(4) { width: 20% !important; }
      #quotationContent .detailed-quotation-table col:nth-child(1) { width: 54% !important; }
      #quotationContent .detailed-quotation-table col:nth-child(2) { width: 8% !important; }
      #quotationContent .detailed-quotation-table col:nth-child(3) { width: 10% !important; }
      #quotationContent .detailed-quotation-table col:nth-child(4) { width: 14% !important; }
      #quotationContent .detailed-quotation-table col:nth-child(5) { width: 14% !important; }
      #quotationContent .simple-quotation-table th,
      #quotationContent .simple-quotation-table td,
      #quotationContent .detailed-quotation-table th,
      #quotationContent .detailed-quotation-table td {
        padding: 5px 4px !important;
      }
    }
  `;
  document.head.appendChild(style);

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('en-MY', { maximumFractionDigits: 2 }) : '0';
  };

  const money = (value) => {
    const n = Number(value);
    return Number.isFinite(n)
      ? 'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : 'RM 0.00';
  };

  const sectionNames = {
    prelim: 'Preliminaries',
    structures: 'Structural Works',
    architectural: 'Architectural Works',
    electrical: 'Electrical Works'
  };

  const addSectionHeading = (tbody, title, detailed) => {
    const tr = document.createElement('tr');
    tr.className = 'tc-quotation-section-heading';
    const td = document.createElement('td');
    td.colSpan = detailed ? 5 : 4;
    td.textContent = title;
    tr.appendChild(td);
    tbody.appendChild(tr);
  };

  const addRoomHeading = (tbody, room, detailed) => {
    const tr = document.createElement('tr');
    tr.className = 'tc-quotation-room-heading';
    const td = document.createElement('td');
    td.colSpan = detailed ? 5 : 4;
    const area = Number(room?.area);
    td.textContent = `${room?.label || 'Area / Room'}${Number.isFinite(area) && area > 0 ? ` — ${num(area)} sqft` : ''}`;
    tr.appendChild(td);
    tbody.appendChild(tr);
  };

  const total = (items) => items.reduce((sum, item) => sum + (Number(item?.amount) || 0), 0);

  function rebuildSimple() {
    if (typeof window.getCurrentQuotationData !== 'function') return;
    const table = document.querySelector('#quotationContent .simple-quotation-table');
    if (!table) return;
    const data = window.getCurrentQuotationData();
    if (!data) return;
    const tbody = table.tBodies[0];
    if (!tbody) return;

    tbody.innerHTML = '';
    let lineNo = 1;

    const addSummary = (items) => {
      if (!items?.length) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${lineNo++}</td>
        <td></td>
        <td>${items.map(i => esc(i.description || '')).join('<br>')}</td>
        <td>${money(total(items))}</td>`;
      tbody.appendChild(tr);
    };

    if (data.prelim?.length) {
      addSectionHeading(tbody, 'A. Preliminaries', false);
      addSummary(data.prelim);
    }
    if (data.structures?.length) {
      addSectionHeading(tbody, 'B. Structural Works', false);
      addSummary(data.structures);
    }
    if (data.archByRoom && data.rooms?.length) {
      const rooms = data.rooms.filter(room => (data.archByRoom[room.roomId] || []).length);
      if (rooms.length) {
        addSectionHeading(tbody, 'C. Architectural Works', false);
        rooms.forEach(room => {
          const items = data.archByRoom[room.roomId] || [];
          addRoomHeading(tbody, room, false);
          addSummary(items);
        });
      }
    }
    if (data.electrical?.length) {
      addSectionHeading(tbody, 'D. Electrical Works', false);
      addSummary(data.electrical);
    }
  }

  function rebuildDetailed() {
    if (typeof window.getCurrentQuotationData !== 'function') return;
    const table = document.querySelector('#quotationContent .detailed-quotation-table');
    if (!table) return;
    const data = window.getCurrentQuotationData();
    if (!data) return;
    const tbody = table.tBodies[0];
    if (!tbody) return;

    tbody.innerHTML = '';
    let lineNo = 1;

    const addItems = (items) => {
      (items || []).forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${esc(item.description || '')}</td>
          <td>${esc(item.unit || '—')}</td>
          <td>${num(item.quantity)}</td>
          <td>${money(item.rate)}</td>
          <td>${money(item.amount)}</td>`;
        tbody.appendChild(tr);
        lineNo++;
      });
    };

    if (data.prelim?.length) {
      addSectionHeading(tbody, 'A. Preliminaries', true);
      addItems(data.prelim);
    }
    if (data.structures?.length) {
      addSectionHeading(tbody, 'B. Structural Works', true);
      addItems(data.structures);
    }
    if (data.archByRoom && data.rooms?.length) {
      const rooms = data.rooms.filter(room => (data.archByRoom[room.roomId] || []).length);
      if (rooms.length) {
        addSectionHeading(tbody, 'C. Architectural Works', true);
        rooms.forEach(room => {
          const items = data.archByRoom[room.roomId] || [];
          addRoomHeading(tbody, room, true);
          addItems(items);
        });
      }
    }
    if (data.electrical?.length) {
      addSectionHeading(tbody, 'D. Electrical Works', true);
      addItems(data.electrical);
    }
  }

  function rebuildQuotationGrouping() {
    try {
      rebuildSimple();
      rebuildDetailed();
    } catch (error) {
      console.warn('[Teraju] quotation grouping fix:', error);
    }
  }

  function hookGenerateQuotation() {
    if (window.__tcQuotationGroupingFix) return true;
    if (typeof window.generateQuotation !== 'function') return false;

    const original = window.generateQuotation;
    window.generateQuotation = function () {
      const result = original.apply(this, arguments);
      setTimeout(rebuildQuotationGrouping, 0);
      return result;
    };
    window.__tcQuotationGroupingFix = true;
    return true;
  }

  if (!hookGenerateQuotation()) {
    const timer = setInterval(() => {
      if (hookGenerateQuotation()) clearInterval(timer);
    }, 50);
    setTimeout(() => clearInterval(timer), 10000);
  }
})();
