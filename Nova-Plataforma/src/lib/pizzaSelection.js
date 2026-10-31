import {calculatePizzaPrice,pizzaFlavorPrice} from "./pizzaPricing.js";
export function resolvePizzaSelection(config,selection){
  if(!config||!selection||!Array.isArray(config.sizes)||!Array.isArray(config.flavors)||!Array.isArray(config.crusts))throw Error("Configuração inválida");
  const {sizeIndex,flavorIndices,crustIndex=null}=selection;
  const valid=i=>Number.isInteger(i)&&i>=0;
  if(!valid(sizeIndex)||sizeIndex>=config.sizes.length)throw Error("Tamanho inválido");
  if(!Array.isArray(flavorIndices)||!flavorIndices.length||flavorIndices.length>4||flavorIndices.some(i=>!valid(i)||i>=config.flavors.length)||new Set(flavorIndices).size!==flavorIndices.length)throw Error("Sabores inválidos");
  if(crustIndex!==null&&(!valid(crustIndex)||crustIndex>=config.crusts.length))throw Error("Borda inválida");
  const size=config.sizes[sizeIndex],flavors=flavorIndices.map(i=>config.flavors[i]),crust=crustIndex===null?null:config.crusts[crustIndex];
  const quarterIndices=selection.quarterIndices;
  const extrasIndices=selection.extrasIndices??[];
  if(!Array.isArray(extrasIndices)||extrasIndices.length>30||new Set(extrasIndices).size!==extrasIndices.length||extrasIndices.some(i=>!isIndex(i)||i>=(config.extras||[]).length))throw Error("Adicionais inválidos");
  const extras=extrasIndices.map(i=>(config.extras||[])[i]);
  if(extras.some(x=>!Number.isSafeInteger(x.priceCents)||x.priceCents<0))throw Error("Preço do adicional inválido");
  let unitPriceCents;
  let counts={};
  if(quarterIndices!==undefined){
    if(!Array.isArray(quarterIndices)||quarterIndices.length!==4||quarterIndices.some(i=>!isIndex(i)||i>=config.flavors.length))throw Error("Partes inválidas");
    const distinct=[...new Set(quarterIndices)];
    if(distinct.length>size.maxFlavors||distinct.length!==flavorIndices.length||distinct.some(i=>!flavorIndices.includes(i)))throw Error("Sabores inválidos");
    const quarterPrices=quarterIndices.map(i=>pizzaFlavorPrice(config.flavors[i],sizeIndex));
    if(quarterPrices.some(p=>p===null))throw Error("Sabor indisponível");
    const base=config.pricingRule==="average"?Math.round(quarterPrices.reduce((x,y)=>x+y,0)/4):Math.max(...quarterPrices);
    unitPriceCents=base+(Number(size.priceCents)||0)+(crust?.priceCents||0)+extras.reduce((v,x)=>v+x.priceCents,0);
    quarterIndices.forEach(i=>counts[i]=(counts[i]||0)+1);
  }else{
    unitPriceCents=calculatePizzaPrice({size,flavors,crust,pricingRule:config.pricingRule,sizeIndex})+extras.reduce((v,x)=>v+x.priceCents,0);
  }
  if(!Number.isSafeInteger(unitPriceCents)||unitPriceCents<0)throw Error("Preço inválido");
  return {unitPriceCents,selection:{sizeIndex,flavorIndices:[...flavorIndices],crustIndex,...(quarterIndices?{quarterIndices:[...quarterIndices]}:{}),extrasIndices:[...extrasIndices]},description:[size.name,flavors.map(f=>f.name).join(" / "),crust?.name].filter(Boolean).join(" · "),options:[{group:"Tamanho",name:size.name,priceCents:0},...flavorIndices.map(i=>({group:"Sabor",name:quarterIndices?(counts[i]===4?"Inteira":counts[i]+"/4")+" "+config.flavors[i].name:config.flavors[i].name,priceCents:0})),...(crust?[{group:"Borda",name:crust.name,priceCents:crust.priceCents}]:[]),...extras.map(x=>({group:"Adicional",name:x.name,priceCents:x.priceCents}))]};

}
