import {resolvePizzaSelection} from "./pizzaSelection.js";

// Call only after fetching the published product from trusted storage.
// This is a reusable guard, not a replacement for order authorization.
export function verifyPizzaCartItem(product, item) {
  if (!product || product.productType !== "pizza" || product.active !== true ||
      !product.pizzaConfig || !item || item.productId !== product.id) {
    throw new Error("Pizza indisponível");
  }
  if (!Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 100) {
    throw new Error("Quantidade inválida");
  }
  const resolved = resolvePizzaSelection(product.pizzaConfig, item.pizzaSelection);
  if (!Number.isSafeInteger(item.unitPriceCents) ||
      item.unitPriceCents !== resolved.unitPriceCents) {
    throw new Error("Preço da pizza divergente");
  }
  const lineTotalCents = resolved.unitPriceCents * item.qty;
  if (!Number.isSafeInteger(lineTotalCents)) throw new Error("Total inválido");
  return {...resolved, qty:item.qty, lineTotalCents, productId:product.id};
}
