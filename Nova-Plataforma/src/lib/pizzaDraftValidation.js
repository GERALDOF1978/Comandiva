export function toPizzaCents(value){
 const raw=String(value??"").trim().replace(",",".");
 if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;
 const n=Math.round(Number(raw)*100);return Number.isSafeInteger(n)&&n>=0?n:null;
}
export function validatePizzaDraft(d){
 if(!d||!String(d.name||"").trim()||!String(d.categoryId||"").trim())return "Informe nome e categoria.";
 if(!["highest","average"].includes(d.pricingRule))return "Regra de preço inválida.";
 if(!Array.isArray(d.sizes)||!d.sizes.length||d.sizes.length>20)return "Cadastre de 1 a 20 tamanhos.";
 if(!Array.isArray(d.flavors)||!d.flavors.length||d.flavors.length>100)return "Cadastre de 1 a 100 sabores.";
 if(!Array.isArray(d.crusts)||d.crusts.length>30)return "Limite de bordas excedido.";
 for(const [kind,entries] of [["tamanho",d.sizes],["sabor",d.flavors],["borda",d.crusts]]){
  const names=new Set();
  for(const x of entries){const name=String(x?.name||"").trim();if(!name||name.length>100||names.has(name.toLocaleLowerCase("pt-BR")))return "Revise os nomes de "+kind+".";names.add(name.toLocaleLowerCase("pt-BR"));
   if(kind==="tamanho"&&(!Number.isInteger(x.maxFlavors)||x.maxFlavors<1||x.maxFlavors>4))return "Limite de sabores inválido.";
   if(kind==="borda"&&toPizzaCents(x.price)===null)return "Preço da borda inválido.";
   if(kind==="sabor"){if(String(x.ingredients||"").length>1000)return "Ingredientes muito longos.";if(!Array.isArray(x.prices)||x.prices.length!==d.sizes.length)return "Preencha os preços por tamanho.";for(const v of x.prices){if(String(v??"").trim()!==""&&!(toPizzaCents(v)>0))return "Preço do sabor deve ser positivo ou ficar vazio.";}}
  }
 }
 if(d.sizes.some((_,i)=>!d.flavors.some(f=>toPizzaCents(f.prices[i])>0)))return "Cada tamanho precisa ter pelo menos um sabor com preço.";
 return null;
}
