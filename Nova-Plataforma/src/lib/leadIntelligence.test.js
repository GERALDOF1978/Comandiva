import test from "node:test";
import assert from "node:assert/strict";
import {analyzeOpportunity, normalizeDigitalAudit, safePublicUrl, messageForLead, followUpState, validFollowUpDate} from "./leadIntelligence.js";

test("URL inválida ou perigosa não é aceita como evidência", () => {
  assert.equal(safePublicUrl("javascript:alert(1)"), "");
  assert.equal(safePublicUrl("file:///etc/passwd"), "");
  assert.equal(safePublicUrl("https://user:pass@example.com"), "");
  assert.equal(safePublicUrl("https://exemplo.com/cardapio"), "https://exemplo.com/cardapio");
});
test("ausência de site não é inferida por falta de dados do OSM", () => {
  const a = normalizeDigitalAudit({}, {name:"Restaurante Exemplo"});
  assert.deepEqual(a,{site:"desconhecido",menu:"desconhecido",orders:"desconhecido"});
  const score = analyzeOpportunity({segment:"restaurante"});
  assert.equal(score.verified,false);
  assert.equal(score.score,35);
  assert.equal(score.unknown.length,3);
});
test("links públicos declarados indicam canal informado, não ausência de outros", () => {
  assert.deepEqual(normalizeDigitalAudit({}, {website:"https://loja.com",menuUrl:"https://loja.com/menu"}), {
    site:"sim",menu:"sim",orders:"desconhecido"
  });
});
test("pontuação sobe só após verificação manual de lacuna", () => {
  const lead = {name:"Exemplo",segment:"pizzaria",phone:"19999999999"};
  const base = analyzeOpportunity(lead);
  assert.equal(base.score,45);
  const checked = analyzeOpportunity({...lead,digitalAudit:{orders:"nao",menu:"nao"}});
  assert.equal(checked.score,90);
  assert.equal(checked.level,"Alta");
  assert.equal(checked.reasons.some(x=>/verificação manual/.test(x)),true);
});
test("mensagem adapta o segmento sem acusar ausência não comprovada", () => {
  const message = messageForLead({name:"Pizza Teste",segment:"pizzaria"});
  assert.match(message,/tamanho, sabores, bordas/);
  assert.doesNotMatch(message,/não tem|sem site|vocês não/);
  assert.match(message,/dishy.com.br\/demonstracao/);
});
test("lembretes são calculados sem agendar envio automático", () => {
  assert.equal(followUpState("2026-11-22",new Date("2026-11-21T12:00:00Z")),"futuro");
  assert.equal(followUpState("2026-11-21",new Date("2026-11-21T12:00:00Z")),"hoje");
  assert.equal(followUpState("2026-11-20",new Date("2026-11-21T12:00:00Z")),"atrasado");
  assert.equal(validFollowUpDate("2026-02-30"),false);
  assert.equal(validFollowUpDate(""),true);
});
