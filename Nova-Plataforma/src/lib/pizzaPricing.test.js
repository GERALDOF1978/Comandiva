import test from "node:test";
import assert from "node:assert/strict";
import { calculatePizzaPrice } from "./pizzaPricing.js";

const size = { name: "Grande", priceCents: 2000, maxFlavors: 4 };
const flavors = [{ name: "Muçarela", priceCents: 3000 }, { name: "Calabresa", priceCents: 4000 }];
test("maior sabor + tamanho + borda", () => {
  assert.equal(calculatePizzaPrice({size, flavors, crust:{priceCents:500}, pricingRule:"highest"}),6500);
});
test("média de sabores + tamanho", () => {
  assert.equal(calculatePizzaPrice({size, flavors, pricingRule:"average"}),5500);
});
test("arredonda média em centavos", () => {
  assert.equal(calculatePizzaPrice({size:{priceCents:0,maxFlavors:2},flavors:[{priceCents:100},{priceCents:101}],pricingRule:"average"}),101);
});
test("impede sabores além do limite", () => {
  assert.throws(()=>calculatePizzaPrice({size:{priceCents:0,maxFlavors:1},flavors}),/inválida/);
});
test("impede preço negativo", () => {
  assert.throws(()=>calculatePizzaPrice({size,flavors:[{priceCents:-1}]}),/inválida/);
});
test("impede regra desconhecida", () => {
  assert.throws(()=>calculatePizzaPrice({size,flavors,pricingRule:"sum"}),/inválida/);
});
