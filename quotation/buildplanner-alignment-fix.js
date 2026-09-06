(() => {
  if (document.getElementById('tcBuildPlannerAlignmentFix')) return;
  const style = document.createElement('style');
  style.id = 'tcBuildPlannerAlignmentFix';
  style.textContent = `
    /* Build Planner quotation master alignment */
    #quotationContent .simple-quotation-table,
    #quotationContent .detailed-quotation-table {
      width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }

    /* Simple: No. | Work Section | Description of Works | Amount */
    #quotationContent .simple-quotation-table col:nth-child(1) { width: 5% !important; }
    #quotationContent .simple-quotation-table col:nth-child(2) { width: 20% !important; }
    #quotationContent .simple-quotation-table col:nth-child(3) { width: 55% !important; }
    #quotationContent .simple-quotation-table col:nth-child(4) { width: 20% !important; }

    /* Detailed: Description | Unit | Quantity | Rate | Amount */
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

    /* Keep the description column generous and flush-left. */
    #quotationContent .simple-quotation-table th:nth-child(3),
    #quotationContent .simple-quotation-table td:nth-child(3),
    #quotationContent .detailed-quotation-table th:nth-child(1),
    #quotationContent .detailed-quotation-table td:nth-child(1) {
      text-align: left !important;
      white-space: normal !important;
      padding-left: 8px !important;
      padding-right: 14px !important;
    }

    /* Simple quotation alignment. */
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
    #quotationContent .simple-quotation-table td:nth-child(4) {
      text-align: right !important;
      white-space: nowrap !important;
      padding-left: 10px !important;
    }

    /* Detailed quotation alignment. */
    #quotationContent .detailed-quotation-table th:nth-child(2),
    #quotationContent .detailed-quotation-table td:nth-child(2) {
      text-align: center !important;
      white-space: nowrap !important;
    }
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

    #quotationContent .simple-quotation-table thead th,
    #quotationContent .detailed-quotation-table thead th {
      background: #f8fafc !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      letter-spacing: .02em !important;
      border-top: 1px solid #d1d5db !important;
      border-bottom: 2px solid #111827 !important;
    }

    /* Section heading appears once per work category — never repeated on every item. */
    #quotationContent .simple-quotation-table .quotation-section-row td,
    #quotationContent .detailed-quotation-table .quotation-section-row td {
      background: #f3f4f6 !important;
      font-weight: 700 !important;
      border-top: 1px solid #cbd5e1 !important;
    }

    #quotationContent .detailed-quotation-table .quotation-subsection-row td {
      background: #fafafa !important;
      font-weight: 700 !important;
      text-align: left !important;
      padding-top: 7px !important;
      padding-bottom: 7px !important;
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
      #quotationContent .simple-quotation-table th:nth-child(3),
      #quotationContent .simple-quotation-table td:nth-child(3),
      #quotationContent .detailed-quotation-table th:nth-child(1),
      #quotationContent .detailed-quotation-table td:nth-child(1) {
        padding-left: 4px !important;
        padding-right: 8px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
