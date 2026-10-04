export function quotationType(value) {
  return String(value || '').toLowerCase() === 'detail' ? 'detail' : 'simple';
}

export function estimateSequence(value) {
  const match = String(value || '').trim().match(/^EST-(?:BLD|REN)-(\d+)(?:-[SD])?$/i);
  return match ? Number(match[1]) || 0 : 0;
}

export function estimateBase(value) {
  return estimateSequence(value);
}

export function displayEstimateNumber(number, plannerType, type) {
  const suffix = quotationType(type) === 'detail' ? 'D' : 'S';
  return `EST-${plannerType === 'renovation' ? 'REN' : 'BLD'}-${String(Math.max(1, number)).padStart(3, '0')}-${suffix}`;
}

export function canonicalEstimateNumber(value, plannerType, type) {
  const base = estimateBase(value);
  return base ? displayEstimateNumber(base, plannerType, type) : '';
}
