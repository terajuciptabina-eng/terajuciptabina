'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const comparison = json('data/rates/country-comparison-2026.json');
const defaults = json('data/rates/default.json');
const stateIndex = json('data/rates/states/index.json');

test('country comparison rates are complete and use the canonical rate IDs', () => {
  assert.equal(comparison.rates.filter(x => x.planner === 'build').length, 82);
  assert.equal(comparison.rates.filter(x => x.planner === 'renovation').length, 40);
  for (const item of comparison.rates) {
    assert.ok(Object.hasOwn(defaults.rates, item.id), 'missing canonical default rate: ' + item.id);
    for (const currency of ['SGD', 'IDR', 'THB', 'PHP', 'VND', 'BND']) {
      assert.ok(Number.isFinite(Number(item[currency])), item.id + ' has no numeric ' + currency + ' rate');
    }
  }
});

test('RenovationPlanner country IDs match the calculation rules canonical keys', () => {
  const window = {};
  vm.runInNewContext(read('TerajuWorks/renovation-calculation-rules.js'), { window });
  const master = window.TerajuRenovationRateMaster;
  const ids = Array.from(master.rows(), row => row.key).sort();
  const countryIds = comparison.rates.filter(x => x.planner === 'renovation').map(x => x.id).sort();
  assert.deepEqual(countryIds, ids);
});

test('Malaysia retains independent state rate-set sources', () => {
  for (const state of ['johor', 'selangor', 'kelantan']) {
    const entry = stateIndex.states[state];
    assert.ok(entry, 'missing state index entry: ' + state);
    const file = json('data/rates/states/' + entry.source);
    assert.equal(file.rateSetId, state);
    for (const item of comparison.rates.filter(x => x.planner === 'build')) {
      assert.ok(Object.hasOwn(file.rates, item.id), state + ' is missing BuildPlanner canonical rate ' + item.id);
    }
  }
});

test('country and state sources both feed the actual master calculation engine', () => {
  const countryContext = read('TerajuWorks/country-context.js');
  const masterEngine = read('TerajuWorks/quotation-quantity-fix.js');
  const stateResolver = read('TerajuWorks/state-rate-resolver.js');
  const renovationEngine = read('TerajuWorks/renovation-planner-v2-engine.js');
  assert.match(countryContext, /canonicalRates\[item\.id\]\s*=\s*value/);
  assert.match(countryContext, /masterRates\[item\.id\]\s*=\s*masterValue/);
  assert.match(countryContext, /TERAJU_SET_MASTER_RATE_SOURCE\(masterRates/);
  assert.match(masterEngine, /RATES=\{\.\.\.rateSource\}/);
  assert.match(masterEngine, /teraju:master-rate-source-ready/);
  assert.match(stateResolver, /TERAJU_SET_MASTER_RATE_SOURCE\(result\.masterRates\|\|result\.rates/);
  assert.match(stateResolver, /key\.startsWith\('rule_'\)&&!key\.startsWith\('renovation_rule_'\)/);
  assert.match(stateResolver, /defaultRenovationRates/);
  assert.match(stateResolver, /no state-specific renovation rate set is available/);
  assert.match(renovationEngine, /hasOwnProperty\.call\(rates,canonicalKey\)/);
});

test('international estimates do not require a Malaysian state and retain country metadata on duplication', () => {
  const records = read('TerajuWorks/quotation-records.js');
  const bridge = read('TerajuWorks/state-rate-record-bridge.js');
  const duplicate = read('api/quotations.js');
  assert.match(records, /if\(isMalaysia&&!state\)/);
  assert.match(duplicate, /incomingCountryCode === 'MY' && !incomingState/);
  assert.match(records, /country-comparison-2026:/);
  assert.match(bridge, /countryCode==='MY'/);
  assert.match(duplicate, /projectCountry: \{ \.\.\.projectCountry, projectId: newProjectId \}/);
  assert.match(duplicate, /countryCode === 'MY' \? sourceState : ''/);
});

test('project currency is carried into history, cost/sqft, contracts and work programmes', () => {
  const metrics = read('TerajuWorks/cost-per-sqft.js');
  const history = read('TerajuWorks/quotations.html');
  const contract = read('TerajuWorks/contract.html');
  const workProgram = read('TerajuWorks/work-program.html');
  const sCurve = read('TerajuWorks/s-curve.html');
  assert.match(metrics, /currencySymbol/);
  assert.match(history, /plannerState\?\.projectCountry\?\.locale/);
  assert.match(contract, /currencyMark\(existing\)/);
  assert.match(workProgram, /currencySymbol:selected\.currencySymbol/);
  assert.match(sCurve, /function currencyMark\(q=selected\)/);
});

test('modified JavaScript and inline Project Control scripts parse without syntax errors', () => {
  const jsFiles = [
    'TerajuWorks/country-context.js',
    'TerajuWorks/state-rate-resolver.js',
    'TerajuWorks/state-rate-record-bridge.js',
    'TerajuWorks/contractor-master-bridge.js',
    'TerajuWorks/quotation-records.js',
    'TerajuWorks/quotation-quantity-fix.js',
    'TerajuWorks/cost-per-sqft.js'
  ];
  for (const file of jsFiles) assert.doesNotThrow(() => new vm.Script(read(file), { filename: file }), file);
  for (const file of ['TerajuWorks/contract.html', 'TerajuWorks/work-program.html', 'TerajuWorks/s-curve.html', 'TerajuWorks/quotations.html']) {
    const html = read(file);
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
    assert.ok(scripts.length, file + ' has no inline scripts');
    for (let i = 0; i < scripts.length; i++) {
      const source = scripts[i][1].trim();
      if (!source) continue;
      assert.doesNotThrow(() => new vm.Script(source, { filename: file + '#inline-' + i }), file + ' inline script ' + i);
    }
  }
});
