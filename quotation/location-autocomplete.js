// Shared planner bootstrap.
// Project Location is intentionally a normal manual text field.
// No address/postcode autocomplete or external location API is applied here.
(function(){
  'use strict';
  document.querySelectorAll('#projectLocation').forEach(function(input){
    input.removeAttribute('list');
    input.setAttribute('autocomplete','off');
  });
  document.getElementById('projectLocationSuggestions')?.remove();
})();

// State-first quotation flow. This is shared by Build and Renovation Planner.
(function(){
  const script=document.createElement('script');
  script.src='state-rate-gate.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
})();

// Shared quotation document engine bootstrap. This is deliberately external to the planner bases.
(function(){
  const script=document.createElement('script');
  script.src='quotation-document-engine.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
})();

// Shared quotation history bootstrap. Loaded here so the stable planner HTML bases remain untouched.
(function(){
  const script=document.createElement('script');
  script.src='quotation-records.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
})();

// State/rate metadata bridge. Runs after the quotation history bootstrap and does not alter planner HTML.
(function(){
  const script=document.createElement('script');
  script.src='state-rate-record-bridge.js?v='+Date.now();
  script.async=false;
  document.head.appendChild(script);
})();
