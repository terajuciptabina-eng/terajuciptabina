import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const countryContext = readFileSync(new URL('../TerajuWorks/country-context.js', import.meta.url), 'utf8');
const projectControl = readFileSync(new URL('../api/project-control.js', import.meta.url), 'utf8');
const adminDatabase = readFileSync(new URL('../TerajuWorks/admin-database.html', import.meta.url), 'utf8');
const contractPage = readFileSync(new URL('../TerajuWorks/contract.html', import.meta.url), 'utf8');
const workProgramPage = readFileSync(new URL('../TerajuWorks/work-program.html', import.meta.url), 'utf8');
const authApi = readFileSync(new URL('../api/auth.js', import.meta.url), 'utf8');

test('unverified account market never defaults to Malaysia in country context', () => {
  assert.match(countryContext, /function countryCode\(value\)\{[^}]*return CURRENCIES\[c\]\?c:''\}/);
  assert.match(countryContext, /if\(role&&roleAccount\)return readCountry\(roleAccount\);/);
  assert.match(countryContext, /return '';\s*}\s*\n\s*async function hydrateAccountCountry/);
  assert.match(countryContext, /if\(!role\|\|!id\)\{accountMarketReady=false;return false;\}/);
  assert.match(countryContext, /function applyCurrencyLabels\(\)\{if\(window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\)return;/);
  assert.match(countryContext, /async function rateById\(id, snapshot\)\{if\(window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\)throw new Error/);
  assert.doesNotMatch(countryContext, /async function rateById\(id, snapshot\)\{const ctx=normalize\(snapshot\|\|current\(\)\)/);
  assert.match(countryContext, /function format\(value,options=\{\}\)\{if\(window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\)return '—'/);
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
