import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const countryContext = readFileSync(new URL('../TerajuWorks/country-context.js', import.meta.url), 'utf8');
const projectControl = readFileSync(new URL('../api/project-control.js', import.meta.url), 'utf8');
const adminDatabase = readFileSync(new URL('../TerajuWorks/admin-database.html', import.meta.url), 'utf8');
const contractPage = readFileSync(new URL('../TerajuWorks/contract.html', import.meta.url), 'utf8');
const workProgramPage = readFileSync(new URL('../TerajuWorks/work-program.html', import.meta.url), 'utf8');
const progressPage = readFileSync(new URL('../TerajuWorks/progress.html', import.meta.url), 'utf8');
const sCurvePage = readFileSync(new URL('../TerajuWorks/s-curve.html', import.meta.url), 'utf8');

const authApi = readFileSync(new URL('../api/auth.js', import.meta.url), 'utf8');
const quotationRecords = readFileSync(new URL('../TerajuWorks/quotation-records.js', import.meta.url), 'utf8');
const buildPlanner = readFileSync(new URL('../TerajuWorks/buildplanner-v2.html', import.meta.url), 'utf8');
const renovationPlanner = readFileSync(new URL('../TerajuWorks/renovationplanner-v2.html', import.meta.url), 'utf8');
const quotationsApi = readFileSync(new URL('../api/quotations.js', import.meta.url), 'utf8');
const quotationsPage = readFileSync(new URL('../TerajuWorks/quotations.html', import.meta.url), 'utf8');
const snapshotSource = readFileSync(new URL('../TerajuWorks/quotation-records.js', import.meta.url), 'utf8');
const costPerSqft = readFileSync(new URL('../TerajuWorks/cost-per-sqft.js', import.meta.url), 'utf8');
const quantityEngine = readFileSync(new URL('../TerajuWorks/quotation-quantity-fix.js', import.meta.url), 'utf8');

test('unverified account market never defaults to Malaysia in country context', () => {
  assert.match(countryContext, /function countryCode\(value\)\{[^}]*return CURRENCIES\[c\]\?c:''\}/);
  assert.match(countryContext, /if\(role&&roleAccount\)return readCountry\(roleAccount\);/);
  assert.match(countryContext, /return '';\s*}\s*\n\s*async function hydrateAccountCountry/);
  assert.match(countryContext, /if\(!role\|\|!id\)\{accountMarketReady=false;return false;\}/);
  assert.match(countryContext, /function applyCurrencyLabels\(\)\{if\(window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\)return;/);
  assert.match(countryContext, /async function rateById\(id, snapshot\)\{if\(window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\)throw new Error/);
  assert.doesNotMatch(countryContext, /async function rateById\(id, snapshot\)\{const ctx=normalize\(snapshot\|\|current\(\)\)/);
  assert.match(countryContext, /function format\(value,options=\{\}\)\{if\(window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\)return '—'/);
  assert.match(countryContext, /rates are indicative estimates, not verified contractor quotations/i);
  assert.match(countryContext, /rateStatus:'estimated',provisional:true/);
  assert.match(countryContext, /provisional:ctx\.countryCode!==\'MY\'/);
});

test('Project Control persistence requires verified market metadata instead of MYR defaults', () => {
  assert.match(projectControl, /if\(!market\?\.accountCountry\|\|!market\?\.expected\?\.currency\|\|!market\?\.expected\?\.symbol\)return res\.status\(409\)/);
  assert.doesNotMatch(projectControl, /countryCode:market\?\.accountCountry\|\|existing\.countryCode\|\|'MY'/);
  assert.doesNotMatch(projectControl, /currency:market\?\.expected\.currency\|\|existing\.currency\|\|'MYR'/);
});

test('Admin Database renders missing account country as UNVERIFIED, not Malaysia', () => {
  assert.match(adminDatabase, /const country=\(x\.country\|\|'UNVERIFIED'\)==='MY'\?'Malaysia':\(x\.countryName\|\|x\.country\|\|'UNVERIFIED'\)/);
});

test('Contract and Work Program do not silently label missing market metadata as Malaysia', () => {
  assert.doesNotMatch(contractPage, /countryCode:quotation\.countryCode\|\|quotation\.plannerState\?\.projectCountry\?\.countryCode\|\|'MY'/);
  assert.doesNotMatch(contractPage, /currency:quotation\.currency\|\|quotation\.plannerState\?\.projectCountry\?\.currency\|\|'MYR'/);
  assert.doesNotMatch(workProgramPage, /countryCode:selected\.countryCode\|\|selected\.plannerState\?\.projectCountry\?\.countryCode\|\|'MY'/);
  assert.doesNotMatch(workProgramPage, /currency:selected\.currency\|\|selected\.plannerState\?\.projectCountry\?\.currency\|\|'MYR'/);
});

test('WhatsApp welcome flow does not infer Malaysia when country is absent', () => {
  assert.match(authApi, /if \(!validCountry\(country\)\) return \{ sent: false, reason: 'Registered country is not verified\.' \};\s*const normalizedPhone = normalizePhoneForCountry\(phone, country\);/);
  assert.doesNotMatch(authApi, /normalizePhoneForCountry\(phone, country \|\| 'MY'\)/);
});

test('BuildPlanner, RenovationPlanner and quotation snapshots do not infer MY/MYR for missing context', () => {
  assert.doesNotMatch(buildPlanner, /TERAJU_GET_PROJECT_COUNTRY\?\.\(\)\|\|\{countryCode:"MY",currency:"MYR"/);
  assert.doesNotMatch(renovationPlanner, /TERAJU_GET_PROJECT_COUNTRY\?\.\(\)\.symbol\|\|"RM"/);
  assert.match(quotationRecords, /if\(window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\|\|!projectCountry\?\.countryCode\|\|!projectCountry\?\.currency\)throw new Error/);
  assert.doesNotMatch(quotationRecords, /countryCode:projectCountry\.countryCode\|\|'MY'/);
  assert.doesNotMatch(quotationRecords, /currency:projectCountry\.currency\|\|'MYR'/);
  assert.doesNotMatch(snapshotSource, /projectCountry:window\.TERAJU_GET_PROJECT_COUNTRY\?\.\(\)\|\|\{countryCode:'MY',currency:'MYR',name:'Malaysia'\}/);
});

test('legacy estimates without country and currency metadata are quarantined from market history', () => {
  assert.match(quotationsApi, /return countries\.length>0&&countries\.every\(code=>MARKET_META\[code\]&&code===accountCountry\)&&currencies\.length>0&&currencies\.every\(code=>code===MARKET_META\[accountCountry\]\?\.currency\)/);
  assert.match(quotationsPage, /const code=String\(a\?\.country\|\|a\?\.countryCode\|\|''\)\.toUpperCase\(\)/);
  assert.doesNotMatch(quotationsPage, /const code=String\(a\?\.country\|\|'MY'\)/);
  assert.match(quotationsPage, /TERAJUWORKS · COST ESTIMATES/);
  assert.doesNotMatch(quotationsPage, /TERAJU CIPTABINA RESOURCES · CONSTRUCTION COST ESTIMATION/);
  assert.doesNotMatch(quotationsPage, /new Intl\.DateTimeFormat\('en-MY'/);
});

test('PDF generation does not leak Malaysian company address or hard-code RM in non-MY markets', () => {
  assert.match(renovationPlanner, /brand\?\.address\|\|\(window\.TERAJU_GET_PROJECT_COUNTRY\?\.\(\)\.countryCode===\"MY\"\?\"No 10A, Jalan PP 2\/1, Taman Putra Prima, 47100 Puchong, Selangor\":\"\"\)/);
  assert.match(renovationPlanner, /brand\?\.name\|\|\(window\.TERAJU_GET_PROJECT_COUNTRY\?\.\(\)\.countryCode===\"MY\"\?\"TERAJU CIPTABINA RESOURCES\":\"TERAJUWORKS\"\)/);
  assert.doesNotMatch(buildPlanner, /Rate \(RM\)/);
  assert.doesNotMatch(buildPlanner, /Amount \(RM\)/);
  assert.doesNotMatch(renovationPlanner, /Rate \(RM\)/);
  assert.doesNotMatch(renovationPlanner, /Amount \(RM\)/);
});

test('Cost-per-sqft metrics do not fall back to MYR when the market is unverified', () => {
  assert.match(costPerSqft, /if \(window\.TERAJU_ACCOUNT_MARKET_VERIFIED !== true\) return EMPTY_MARKET/);
  assert.doesNotMatch(costPerSqft, /value\?\.currency \|\| 'MYR'/);
  assert.doesNotMatch(costPerSqft, /market\(\)\.symbol \|\| 'RM'/);
  assert.match(costPerSqft, /Market unverified — currency display withheld/);
  assert.doesNotMatch(costPerSqft, /\|\| 'MYR'\)\)\.toUpperCase/);
});

test('planner rate engine waits for authoritative country verification and RenovationPlanner loads context first', () => {
  assert.match(quantityEngine, /const marketPromise=window\.TERAJU_ACCOUNT_MARKET_PROMISE;\s*if\(!marketPromise\|\|await marketPromise!==true\|\|window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\)/);
  assert.doesNotMatch(quantityEngine, /TERAJU_PROJECT_COUNTRY\?\.countryCode\|\|'MY'/);
  assert.match(quantityEngine, /stateRateUrl=market==='MY'&&state\?/);
  assert.match(quantityEngine, /RATES=market==='MY'\?\(loadedRateSet\.rates\|\|\{\}\):\{\}/);
  assert.match(quantityEngine, /filter\(x=>x\.planner==='build'\)/);
  assert.match(quantityEngine, /const expected=82/);
  assert.ok(renovationPlanner.indexOf('country-context.js') < renovationPlanner.indexOf('quotation-quantity-fix.js'), 'country verification must initialize before the RenovationPlanner rate engine');
  assert.ok(renovationPlanner.indexOf('country-context.js') < renovationPlanner.indexOf('state-rate-gate.js'), 'country context must initialize before the RenovationPlanner rate gate');
});

test('Project Control currency displays never default missing market data to RM/MYR', () => {
  for (const page of [contractPage, workProgramPage, progressPage, sCurvePage]) {
    assert.doesNotMatch(page, /currencySymbol\|\|q\?\.projectCountry\?\.symbol\|\|'RM'/);
    assert.doesNotMatch(page, /selected\?\.projectCountry\?\.locale\|\|'en-MY'/);
    assert.match(page, /MARKET_SYMBOL\[marketCode\(q\)\]\|\|'—'/);
    assert.match(page, /return expected&&currencies\.every\(code=>code===expected\)\?expected:''/);
  }
  assert.match(contractPage, /MARKET_SYMBOL\[marketCode\(q\)\]\|\|'—'/);
});
