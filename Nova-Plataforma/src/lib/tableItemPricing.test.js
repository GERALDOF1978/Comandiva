import test from "node:test";
import assert from "node:assert/strict";
import {buildTableOrderLine,tableProductNeedsAssembly,tableProductStartingPrice} from "./tableItemPricing.js";
const pid="produto-123";
const pizza={id:pid,name:"Pizza",active:true,productType:"pizza",priceCents:0,pizzaConfig:{pricingRule:"highest",sizes:[{name:"Grande",maxFlavors:2,priceCents:500}],flavors:[{name:"Queijo",pricesBySize:[3000]},{name:"Calabresa",pricesBySize:[4000]}],crusts:[{name:"Catupiry",priceCents:700}],extras:[{name:"Azeitona",priceCents:200}]}};
const selection={sizeIndex:0,quarterIndices:[0,0,1,1],crustIndex:0,extrasIndices:[0]};
test("simples usa o preco do cadastro",()=>{const line=buildTableOrderLine({id:pid,name:"Refrigerante",priceCents:600,active:true},{qty:2});assert.equal(line.totalCents,1200)});
test("pizza com borda e adicional soma corretamente",()=>{const line=buildTableOrderLine(pizza,{qty:2,pizzaSelection:selection});assert.equal(line.unitPriceCents,5400);assert.equal(line.totalCents,10800);assert.equal(line.options.length,7)});
test("pizza rejeita mais sabores do que permite",()=>assert.throws(()=>buildTableOrderLine({...pizza,pizzaConfig:{...pizza.pizzaConfig,sizes:[{name:"Grande",maxFlavors:1,priceCents:500}]}},{qty:1,pizzaSelection:selection}),/invalid_pizza_selection/));
test("pizza rejeita preco nao cadastrado",()=>assert.throws(()=>buildTableOrderLine({...pizza,pizzaConfig:{...pizza.pizzaConfig,flavors:[{name:"Queijo",pricesBySize:[0]},pizza.pizzaConfig.flavors[1]]}},{qty:1,pizzaSelection:selection}),/invalid_pizza_price/));
const marmita={id:pid,active:true,productType:"marmita",name:"Marmita",priceCents:0,optionGroups:[{name:"Tamanho",required:true,min:1,max:1,options:[{name:"Grande",priceCents:3000}]},{name:"Proteinas",required:true,min:2,max:2,allowRepeat:true,options:[{name:"Frango",priceCents:0},{name:"Carne",priceCents:0}]}]};
test("marmita permite repetir proteina",()=>{const line=buildTableOrderLine(marmita,{qty:1,optionSelection:[[0],[0,0]]});assert.equal(line.unitPriceCents,3000);assert.equal(line.options.length,3)});
test("marmita exige quantidade correta",()=>assert.throws(()=>buildTableOrderLine(marmita,{qty:1,optionSelection:[[0],[0]]}),/invalid_option_selection/));
test("preco do cliente nao sobrescreve o servidor",()=>{const line=buildTableOrderLine({id:pid,name:"Agua",priceCents:500},{qty:1,priceCents:1,totalCents:1});assert.equal(line.totalCents,500)});
test("produto desativado nao pode ser vendido",()=>assert.throws(()=>buildTableOrderLine({id:pid,active:false,priceCents:100},{qty:1}),/product_unavailable/));
test("montagem e identificada",()=>{assert.ok(tableProductNeedsAssembly(pizza));assert.equal(tableProductStartingPrice(pizza),3500)});

function assertFirestoreSafe(value,path="line",parentIsArray=false){
 if(Array.isArray(value)){
  assert.equal(parentIsArray,false,"Firestore não aceita array dentro de array: "+path);
  value.forEach((entry,index)=>assertFirestoreSafe(entry,path+"["+index+"]",true));
 }else if(value&&typeof value==="object"){
  Object.entries(value).forEach(([key,entry])=>assertFirestoreSafe(entry,path+"."+key,false));
 }
}
test("lanche montado grava complementos sem array aninhado no Firestore",()=>{
 const lanche={id:pid,name:"Lu lanche",active:true,priceCents:2500,optionGroups:[
  {name:"Molhos",required:true,min:1,max:2,options:[{name:"Mostarda",priceCents:0},{name:"Açúcar",priceCents:0}]},
  {name:"Adicionais",max:1,options:[{name:"Bacon",priceCents:500}]}
 ]};
 const line=buildTableOrderLine(lanche,{qty:2,optionSelection:[[0,1],[0]]});
 assert.equal(line.totalCents,6000);
 assert.deepEqual(line.options.map(o=>o.name),["Mostarda","Açúcar","Bacon"]);
 assert.deepEqual(line.optionSelection,[{groupIndex:0,indices:[0,1]},{groupIndex:1,indices:[0]}]);
 assertFirestoreSafe(line);
 assertFirestoreSafe(JSON.parse(JSON.stringify(line)));
});
test("marmita com proteína repetida continua válida para Firestore",()=>{
 const line=buildTableOrderLine(marmita,{qty:1,optionSelection:[[0],[0,0]]});
 assert.equal(line.totalCents,3000);
 assert.deepEqual(line.optionSelection,[{groupIndex:0,indices:[0]},{groupIndex:1,indices:[0,0]}]);
 assertFirestoreSafe(line);
});
test("pizza montada mantém tamanho, fatias, borda, adicionais e estrutura válida",()=>{
 const line=buildTableOrderLine(pizza,{qty:1,pizzaSelection:selection});
 assert.equal(line.unitPriceCents,5400);
 assert.equal(line.pizzaSelection.quarterIndices.length,4);
 assertFirestoreSafe(line);
});

test("montador -> carrinho -> API: aceita opções sanitizadas e preserva o preço",()=>{
 const lanche={id:pid,active:true,name:"Lu lanche",priceCents:2500,optionGroups:[{name:"Molhos",min:1,max:2,required:true,options:[{name:"Mostarda",priceCents:0},{name:"Açúcar",priceCents:0}]},{name:"Adicionais",min:0,max:1,options:[{name:"Bacon",priceCents:500}]}]};
 const built=buildTableOrderLine(lanche,{qty:1,optionSelection:[[0,1],[0]]});
 const sent=buildTableOrderLine(lanche,{qty:1,optionSelection:built.optionSelection});
 assert.equal(sent.totalCents,3000);
 assert.deepEqual(sent.options,built.options);
 assert.deepEqual(sent.optionSelection,built.optionSelection);
 assertFirestoreSafe(sent);
});
test("QR Code: grupo obrigatório ainda é exigido mesmo com opção sanitizada",()=>{
 const lanche={id:pid,active:true,priceCents:800,optionGroups:[{name:"Sabor",required:true,min:1,max:1,options:[{name:"Morango",priceCents:0}]}]};
 assert.throws(()=>buildTableOrderLine(lanche,{qty:1,optionSelection:[{groupIndex:0,indices:[]}]}),/invalid_option_selection/);
 assert.throws(()=>buildTableOrderLine(lanche,{qty:1,optionSelection:[{groupIndex:1,indices:[0]}]}),/invalid_option_selection/);
 assert.throws(()=>buildTableOrderLine(lanche,{qty:1,optionSelection:[{groupIndex:0,indices:[9]}]}),/invalid_option_selection/);
});
test("marmita: seleção já preparada mantém proteína repetida e valor",()=>{
 const ready=buildTableOrderLine(marmita,{qty:1,optionSelection:[[0],[0,0]]});
 const saved=buildTableOrderLine(marmita,{qty:1,optionSelection:ready.optionSelection});
 assert.equal(saved.totalCents,3000);
 assert.deepEqual(saved.options,ready.options);
 assert.deepEqual(saved.optionSelection,ready.optionSelection);
 assertFirestoreSafe(saved);
});
