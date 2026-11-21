import test from "node:test";
import assert from "node:assert/strict";
import { leadScore } from "./leadScoring.js";

test("não infere inexistência de site nem pedidos online", () => {
  const result = leadScore({ segment: "restaurante" });
  assert.equal(result.score, 40);
  assert.equal(result.reasons.some(x => /sem site|sem pedidos/i.test(x)), false);
});
test("considera contato público e site informado", () => {
  const result = leadScore({ segment: "pizzaria", phone: "19999999999", website: "https://example.com" });
  assert.equal(result.score, 60);
});
test("categoria não reconhecida não recebe bônus de segmento", () => {
  assert.equal(leadScore({ segment: "outro" }).score, 30);
});
