import test from "node:test";
import assert from "node:assert/strict";
import {togglePizzaQuarterFlavor} from "./pizzaQuarterSelection.js";

test("um sabor preenche a pizza inteira", () => {
  assert.deepEqual(togglePizzaQuarterFlavor([null,null,null,null],2,4),[2,2,2,2]);
});
test("dois sabores preenchem metade a metade", () => {
  assert.deepEqual(togglePizzaQuarterFlavor([2,2,2,2],1,4),[2,2,1,1]);
});
test("três sabores ocupam quatro fatias", () => {
  assert.deepEqual(togglePizzaQuarterFlavor([2,2,1,1],3,4),[2,2,1,3]);
});
test("limite de sabores não pode ser ultrapassado", () => {
  assert.deepEqual(togglePizzaQuarterFlavor([2,2,1,1],3,2),[2,2,1,1]);
});
test("tocar novamente no sabor remove esse sabor", () => {
  assert.deepEqual(togglePizzaQuarterFlavor([2,2,1,1],2,2),[1,1,1,1]);
  assert.deepEqual(togglePizzaQuarterFlavor([1,1,1,1],1,2),[null,null,null,null]);
});
test("tamanho de sabor único não aceita segundo sabor", () => {
  assert.deepEqual(togglePizzaQuarterFlavor([1,1,1,1],2,1),[1,1,1,1]);
});
