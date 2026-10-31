// Pure pizza pricing rules. Prices are integer centavos, never floating point reais.
// This module does not publish pizzas or authorize checkout prices.
const validCents = value => Number.isSafeInteger(value) && value >= 0;
export function calculatePizzaPrice({ size, flavors, crust, pricingRule = "highest" }) {
  if (!size || !validCents(size.priceCents)) throw new Error("Tamanho inválido");
  if (!Array.isArray(flavors) || flavors.length < 1 || flavors.length > 4 ||
      flavors.length > size.maxFlavors || !flavors.every(f => f && validCents(f.priceCents))) {
    throw new Error("Escolha de sabores inválida");
  }
  if (crust && !validCents(crust.priceCents)) throw new Error("Borda inválida");
  if (!["highest", "average"].includes(pricingRule)) throw new Error("Regra de preço inválida");
  const flavorPrice = pricingRule === "highest"
    ? Math.max(...flavors.map(f => f.priceCents))
    : Math.round(flavors.reduce((sum, f) => sum + f.priceCents, 0) / flavors.length);
  const total = size.priceCents + flavorPrice + (crust?.priceCents ?? 0);
  if (!Number.isSafeInteger(total)) throw new Error("Preço excede o limite");
  return total;
}
