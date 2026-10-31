// Validation for private pizza drafts. This is not authorization to publish or charge.
export function toPizzaCents(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(raw)) return null;
  const cents = Math.round(Number(raw) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}
export function validatePizzaDraft(draft) {
  if (!draft || !String(draft.name ?? "").trim() || !String(draft.categoryId ?? "").trim()) return "Informe nome e categoria.";
  if (!["highest", "average"].includes(draft.pricingRule)) return "Selecione uma regra de preço válida.";
  if (!Array.isArray(draft.sizes) || !draft.sizes.length || draft.sizes.length > 20) return "Cadastre de 1 a 20 tamanhos.";
  if (!Array.isArray(draft.flavors) || !draft.flavors.length || draft.flavors.length > 100) return "Cadastre de 1 a 100 sabores.";
  if (!Array.isArray(draft.crusts) || draft.crusts.length > 30) return "Cadastre até 30 bordas.";
  for (const [kind, entries] of [["tamanho", draft.sizes], ["sabor", draft.flavors], ["borda", draft.crusts]]) {
    const names = new Set();
    for (const entry of entries) {
      const name = String(entry?.name ?? "").trim();
      if (!name || name.length > 100) return "Revise o nome de cada " + kind + ".";
      const normalized = name.toLocaleLowerCase("pt-BR");
      if (names.has(normalized)) return "Existem " + kind + "s com nomes repetidos.";
      names.add(normalized);
      if (toPizzaCents(entry.price) === null) return "Revise o preço de cada " + kind + " (até duas casas decimais).";
      if (kind === "tamanho" && (!Number.isInteger(entry.maxFlavors) || entry.maxFlavors < 1 || entry.maxFlavors > 4)) return "O tamanho deve permitir de 1 a 4 sabores.";
    }
  }
  return null;
}
