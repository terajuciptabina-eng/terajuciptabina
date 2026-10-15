import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const countryContext = readFileSync(new URL('../TerajuWorks/country-context.js', import.meta.url), 'utf8');
const projectControl = readFileSync(new URL('../api/project-control.js', import.meta.url), 'utf8');
const adminDatabase = readFileSync(new URL('../TerajuWorks/admin-database.html', import.meta.url), 'utf8');

test('unverified account market never defaults to Malaysia in country context', () => {
  assert.match(countryContext, /function countryCode\(value\)\{[^}]*return CURRENCIES\[c\]\?c:''\}/);
  assert.match(countryContext, /if\(role&&roleAccount\)return readCountry\(roleAccount\);/);
  assert.match(countryContext, /return '';\s*}\s*\n\s*async function hydrateAccountCountry/);
  assert.match(countryContext, /if\(!role\|\|!id\)\{accountMarketReady=false;return false;\}/);
  assert.match(countryContext, /function applyCurrencyLabels\(\)\{if\(window\.TERAJU_ACCOUNT_MARKET_VERIFIED!==true\)return;/);
});

test('Project Control persistence requires verified market metadata instead of MYR defaults', () => {
  assert.match(projectControl, /if\(!market\?\.accountCountry\|\|!market\?\.expected\?\.currency\|\|!market\?\.expected\?\.symbol\)return res\.status\(409\)/);
  assert.doesNotMatch(projectControl, /countryCode:market\?\.accountCountry\|\|existing\.countryCode\|\|'MY'/);
  assert.doesNotMatch(projectControl, /currency:market\?\.expected\.currency\|\|existing\.currency\|\|'MYR'/);
});

test('Admin Database renders missing account country as UNVERIFIED, not Malaysia', () => {
  assert.match(adminDatabase, /const country=\(x\.country\|\|'UNVERIFIED'\)==='MY'\?'Malaysia':\(x\.countryName\|\|x\.country\|\|'UNVERIFIED'\)/);
});
