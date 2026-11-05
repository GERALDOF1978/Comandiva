import test from "node:test";
import assert from "node:assert/strict";
import {marmitaStartingPrice,marmitaUnitPriceCents} from "./marmitaPricing.js";

test("marmita usa preço integral do tamanho, sem somar o preço-base",()=>{
 const product={productType:"marmita",priceCents:2300,optionGroups:[{name:"Tamanho da marmita",options:[{name:"Pequena",priceCents:2300},{name:"Média",priceCents:3200},{name:"Grande",priceCents:3800}]}]};
 assert.equal(marmitaStartingPrice(product),2300);
 assert.equal(marmitaUnitPriceCents(product.optionGroups[0].options[1].priceCents,[600]),3800);
 assert.equal(marmitaUnitPriceCents(product.optionGroups[0].options[2].priceCents,[]),3800);
});
test("marmita bloqueia tamanho sem preço, mesmo com base antigo",()=>{
 assert.equal(marmitaStartingPrice({priceCents:2300,optionGroups:[{options:[{priceCents:0}]}]}),null);
 assert.throws(()=>marmitaUnitPriceCents(0,[900]),/invalid_marmita_price/);
 assert.throws(()=>marmitaUnitPriceCents(-10),/invalid_marmita_price/);
});
test("marmita rejeita adicional inválido",()=>{
 assert.throws(()=>marmitaUnitPriceCents(2300,[-100]),/invalid_marmita_price/);
 assert.throws(()=>marmitaUnitPriceCents(2300,[100000000]),/invalid_marmita_price/);
});
