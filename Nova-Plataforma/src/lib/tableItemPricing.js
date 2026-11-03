// Dishy: validated pricing for table orders. Only call with trusted Firestore product data.
const idx=(i,n)=>Number.isInteger(i)&&i>=0&&i<n;
const cents=n=>Number.isSafeInteger(n)&&n>=0;
const fail=code=>{throw Error(code)};
export const tableProductNeedsAssembly=p=>Boolean(p?.productType==="pizza"&&p.pizzaConfig)||Boolean(p?.optionGroups?.length);
export function tableProductStartingPrice(p){
 if(!p)return 0;
 if(p.productType==="pizza"&&p.pizzaConfig){const c=p.pizzaConfig;const prices=[];(c.sizes||[]).forEach((size,si)=>{(c.flavors||[]).forEach(flavor=>{const v=flavor?.pricesBySize?.[si];if(cents(v)&&v>0)prices.push(v+(cents(size?.priceCents)?size.priceCents:0))})});return prices.length?Math.min(...prices):null}
 if(p.productType==="marmita"&&p.optionGroups?.length){const prices=(p.optionGroups[0].options||[]).map(x=>x.priceCents).filter(x=>cents(x)&&x>0);return prices.length?Math.min(...prices):(cents(p.priceCents)?p.priceCents:0)}
 return cents(p.priceCents)?p.priceCents:0
}
export function buildTableOrderLine(p,item){
 if(!p||p.active===false||p.available===false||p.sellAtTable===false)fail("product_unavailable");
 if(typeof p.id!=="string"||!(/^[A-Za-z0-9_-]{5,128}$/).test(p.id))fail("invalid_product");
 const qty=Number(item?.qty??item?.quantity);if(!Number.isInteger(qty)||qty<1||qty>50)fail("invalid_quantity");
 const pizza=p.productType==="pizza"&&Boolean(p.pizzaConfig);
 const hasGroups=!pizza&&Array.isArray(p.optionGroups)&&p.optionGroups.length>0;
 let price=Number(p.priceCents),options=[],pizzaSelection=null,optionSelection=null;
 if(!cents(price)&&p.productType!=="marmita"&&!pizza)fail("invalid_price");
 if(pizza){
  if(item?.optionSelection!=null)fail("invalid_option_product");
  const c=p.pizzaConfig,sel=item?.pizzaSelection,sizes=c.sizes||[],flavors=c.flavors||[],crusts=c.crusts||[],extras=c.extras||[];
  const si=sel?.sizeIndex,parts=sel?.quarterIndices,ci=sel?.crustIndex??null,ei=sel?.extrasIndices??[];
  if(!idx(si,sizes.length)||!Array.isArray(parts)||parts.length!==4||parts.some(i=>!idx(i,flavors.length))||!Array.isArray(ei)||ei.length>30||ei.some(i=>!idx(i,extras.length))||new Set(ei).size!==ei.length||!Number.isInteger(sizes[si].maxFlavors)||sizes[si].maxFlavors<1||sizes[si].maxFlavors>4||new Set(parts).size>sizes[si].maxFlavors)fail("invalid_pizza_selection");
  if(ci!==null&&!idx(ci,crusts.length))fail("invalid_pizza_crust");
  const partsPrices=parts.map(i=>flavors[i]?.pricesBySize?.[si]);if(partsPrices.some(v=>!cents(v)||v<=0))fail("invalid_pizza_price");
  const sizeAmount=Number(sizes[si].priceCents||0),crustAmount=ci===null?0:Number(crusts[ci].priceCents||0),extraAmounts=ei.map(i=>Number(extras[i].priceCents||0));
  if(!cents(sizeAmount)||!cents(crustAmount)||extraAmounts.some(v=>!cents(v)))fail("invalid_pizza_price");
  price=(c.pricingRule==="average"?Math.round(partsPrices.reduce((a,b)=>a+b,0)/4):Math.max(...partsPrices))+sizeAmount+crustAmount+extraAmounts.reduce((a,b)=>a+b,0);
  pizzaSelection={sizeIndex:si,quarterIndices:[...parts],crustIndex:ci,extrasIndices:[...ei]};
  options=[{group:"Tamanho",name:String(sizes[si].name||"Tamanho")},...parts.map((i,q)=>({group:"Fatia "+(q+1),name:String(flavors[i].name||"Sabor")})),...(ci===null?[]:[{group:"Borda",name:String(crusts[ci].name||"Borda"),priceCents:crustAmount}]),...ei.map(i=>({group:"Adicional",name:String(extras[i].name||"Adicional"),priceCents:Number(extras[i].priceCents||0)}))];
 }else if(hasGroups){
  if(item?.pizzaSelection!=null)fail("invalid_pizza_product");
  const groups=p.optionGroups,provided=item?.optionSelection;
  // O montador usa índices agrupados; o carrinho pode reenviar a linha já preparada
  // para Firestore ({groupIndex,indices}). Validar ambos com as MESMAS regras.
  const selected=Array.isArray(provided)&&provided.length===groups.length
   ?provided.every(Array.isArray)?provided
   :provided.every((entry,index)=>entry&&typeof entry==="object"&&!Array.isArray(entry)&&entry.groupIndex===index&&Array.isArray(entry.indices))
    ?provided.map(entry=>entry.indices):null
   :null;
  if(!selected)fail("invalid_option_selection");
  const si=p.productType==="marmita"?selected[0]?.[0]:null;
  if(p.productType==="marmita"&&(!idx(si,(groups[0]?.options||[]).length)||selected[0].length!==1))fail("invalid_option_selection");
  if(p.productType==="marmita"&&Number(groups[0].options[si].priceCents||0)>0)price=0;
  for(let gi=0;gi<groups.length;gi++){
   const g=groups[gi],chosen=selected[gi],available=g.options||[];
   const max=Number(p.productType==="marmita"&&gi>0?(g.limitsBySize?.[si]??g.max??1):(g.max??1));
   const min=Math.max(Number(g.min||0),g.required?1:0);
   if(!Array.isArray(chosen)||!Number.isInteger(max)||max<0||!Number.isInteger(min)||min<0||chosen.length<min||chosen.length>max||chosen.some(i=>!idx(i,available.length))||(!g.allowRepeat&&new Set(chosen).size!==chosen.length))fail("invalid_option_selection");
   for(const i of chosen){const option=available[i],cost=Number(option.priceCents||0);if(!cents(cost))fail("invalid_option_price");price+=cost;options.push({group:String(g.name||"Opções"),name:String(option.name||"Opção"),priceCents:cost})}
  }
  // Arrays de arrays não podem ser armazenados no Firestore. Grupos como mapas preservam as escolhas e os valores na comanda.
  optionSelection=selected.map((indices,groupIndex)=>({groupIndex,indices:[...indices]}));
 }else if(item?.pizzaSelection!=null||item?.optionSelection!=null||p.productType==="pizza")fail("assembly_required");
 if(!cents(price)||price>100000000||!cents(price*qty)||price*qty>100000000)fail("invalid_price");
 return {productId:p.id,name:String(p.name||"Produto").slice(0,120),qty,quantity:qty,priceCents:price,unitPriceCents:price,totalCents:price*qty,...(options.length?{options}:{}),...(pizzaSelection?{pizzaSelection}:{}),...(optionSelection?{optionSelection}:{})}
}
