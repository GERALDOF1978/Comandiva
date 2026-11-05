// Marmitas: o preço do tamanho é o preço integral; o preço-base é ignorado.
export function marmitaStartingPrice(product){
 const sizes=product?.optionGroups?.[0]?.options;
 if(!Array.isArray(sizes))return null;
 const prices=sizes.map(size=>size?.priceCents).filter(value=>Number.isSafeInteger(value)&&value>0);
 return prices.length?Math.min(...prices):null;
}

export function marmitaUnitPriceCents(sizePriceCents,additionalPrices=[]){
 if(!Number.isSafeInteger(sizePriceCents)||sizePriceCents<=0||!Array.isArray(additionalPrices))throw Error("invalid_marmita_price");
 let total=sizePriceCents;
 for(const price of additionalPrices){
  if(!Number.isSafeInteger(price)||price<0)throw Error("invalid_marmita_price");
  total+=price;
  if(!Number.isSafeInteger(total)||total>100000000)throw Error("invalid_marmita_price");
 }
 return total;
}
