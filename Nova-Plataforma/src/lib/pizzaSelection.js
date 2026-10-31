import {calculatePizzaPrice,pizzaFlavorPrice} from "./pizzaPricing.js";
export function resolvePizzaSelection(config,selection){
  if(!config||!selection||!Array.isArray(config.sizes)||!Array.isArray(config.flavors)||!Array.isArray(config.crusts))throw Error("Configuração inválida");
  const {sizeIndex,flavorIndices,crustIndex=null}=selection;
  const valid=i=>Number.isInteger(i)&&i>=0;
  if(!valid(sizeIndex)||sizeIndex>=config.sizes.length)throw Error("Tamanho inválido");
  if(!Array.isArray(flavorIndices)||!flavorIndices.length||flavorIndices.length>4||flavorIndices.some(i=>!valid(i)||i>=config.flavors.length)||new Set(flavorIndices).size!==flavorIndices.length)throw Error("Sabores inválidos");
  if(crustIndex!==null&&(!valid(crustIndex)||crustIndex>=config.crusts.length))throw Error("Borda inválida");
  const size=config.sizes[sizeIndex],flavors=flavorIndices.map(i=>config.flavors[i]),crust=crustIndex===null?null:config.crusts[crustIndex];
  const unitPriceCents=calculatePizzaPrice({size,flavors,crust,pricingRule:config.pricingRule,sizeIndex});
  return {unitPriceCents,selection:{sizeIndex,flavorIndices:[...flavorIndices],crustIndex},description:[size.name,flavors.map(f=>f.name).join(" / "),crust?.name].filter(Boolean).join(" · "),options:[{group:"Tamanho",name:size.name,priceCents:0},...flavors.map(f=>({group:"Sabor",name:f.name,priceCents:pizzaFlavorPrice(f,sizeIndex)})),...(crust?[{group:"Borda",name:crust.name,priceCents:crust.priceCents}]:[])]};
}
