// Valores em centavos. Tamanhos indisponíveis não podem ter preço zero.
const positive = n => Number.isSafeInteger(n) && n > 0;
export function pizzaFlavorPrice(flavor, sizeIndex) {
  const value = flavor?.pricesBySize?.[sizeIndex];
  return positive(value) ? value : null;
}
export function pizzaStartingPrice(config, sizeIndex) {
  const prices = (config?.flavors || []).map(f => pizzaFlavorPrice(f,sizeIndex)).filter(positive);
  return prices.length ? Math.min(...prices) : null;
}
export function calculatePizzaPrice({size,flavors,crust,pricingRule="highest",sizeIndex}) {
  if (!size || !Number.isInteger(size.maxFlavors) || size.maxFlavors<1) throw Error("Tamanho inválido");
  if (!Array.isArray(flavors)||!flavors.length||flavors.length>size.maxFlavors||flavors.length>4) throw Error("Sabores inválidos");
  const prices=flavors.map(f=>pizzaFlavorPrice(f,sizeIndex));
  if(prices.some(p=>p===null)) throw Error("Sabor indisponível neste tamanho");
  if(crust && (!Number.isSafeInteger(crust.priceCents)||crust.priceCents<0)) throw Error("Borda inválida");
  if(!["highest","average"].includes(pricingRule)) throw Error("Regra inválida");
  const base=pricingRule==="highest"?Math.max(...prices):Math.round(prices.reduce((a,b)=>a+b,0)/prices.length);
  const total=base+(crust?.priceCents||0);
  if(!Number.isSafeInteger(total)) throw Error("Preço inválido");
  return total;
}
