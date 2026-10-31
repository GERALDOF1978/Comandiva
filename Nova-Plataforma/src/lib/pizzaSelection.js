import { calculatePizzaPrice } from "./pizzaPricing.js";

// The caller MUST load config from a trusted restaurant record.
// Never accept a client-supplied price or configuration as authoritative.
export function resolvePizzaSelection(config, selection) {
  if (!config || !selection || !Array.isArray(config.sizes) ||
      !Array.isArray(config.flavors) || !Array.isArray(config.crusts)) {
    throw new Error("Configuração de pizza inválida");
  }
  const {sizeIndex, flavorIndices, crustIndex = null} = selection;
  const isIndex = x => Number.isInteger(x) && x >= 0;
  if (!isIndex(sizeIndex) || sizeIndex >= config.sizes.length) throw new Error("Tamanho inválido");
  if (!Array.isArray(flavorIndices) || !flavorIndices.length ||
      flavorIndices.length > 4 || flavorIndices.some(i => !isIndex(i) || i >= config.flavors.length) ||
      new Set(flavorIndices).size !== flavorIndices.length) throw new Error("Sabores inválidos");
  if (crustIndex !== null && (!isIndex(crustIndex) || crustIndex >= config.crusts.length)) {
    throw new Error("Borda inválida");
  }
  const size = config.sizes[sizeIndex];
  const flavors = flavorIndices.map(i => config.flavors[i]);
  const crust = crustIndex === null ? null : config.crusts[crustIndex];
  if (flavorIndices.length > size.maxFlavors) throw new Error("Limite de sabores excedido");
  const unitPriceCents = calculatePizzaPrice({
    size, flavors, crust, pricingRule: config.pricingRule
  });
  return {
    unitPriceCents,
    selection: {sizeIndex, flavorIndices:[...flavorIndices], crustIndex},
    description: [size.name, flavors.map(f=>f.name).join(" / "), crust?.name].filter(Boolean).join(" · "),
    options: [
      {group:"Tamanho",name:size.name,priceCents:size.priceCents},
      ...flavors.map(f=>({group:"Sabor",name:f.name,priceCents:f.priceCents})),
      ...(crust?[{group:"Borda",name:crust.name,priceCents:crust.priceCents}]:[])
    ]
  };
}
