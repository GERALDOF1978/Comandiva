// Mantém a seleção automática das quatro fatias igual em PDV, cardápio e QR Code.
export function togglePizzaQuarterFlavor(parts, flavorIndex, maxFlavors) {
  if (!Number.isInteger(flavorIndex) || flavorIndex < 0) return parts;
  const limit = Math.max(1, Math.min(4, Number(maxFlavors) || 1));
  const selected = [...new Set((parts || []).filter(i => Number.isInteger(i) && i >= 0))];
  const next = selected.includes(flavorIndex)
    ? selected.filter(i => i !== flavorIndex)
    : [...selected, flavorIndex];
  if (next.length > limit) return parts;
  if (!next.length) return [null, null, null, null];
  return Array.from({length: 4}, (_, quarter) =>
    next[Math.min(next.length - 1, Math.floor(quarter * next.length / 4))]);
}
