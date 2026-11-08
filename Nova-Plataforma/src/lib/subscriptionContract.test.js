import test from "node:test";
import assert from "node:assert/strict";
import {createSubscriptionContractText,contractHash,cleanContractContact,DISHY_CONTRACT_VERSION} from "../../api/_subscription-contract.js";
const args={
 issuer:{issuerName:"Prestadora Exemplo Ltda",issuerDocument:"00.000.000/0001-00",issuerAddress:"Rua Teste, 1",issuerEmail:"prestador@example.com"},
 customer:{name:"Titular de Teste",document:"00000000000",email:"cliente@example.com"},
 restaurant:{name:"Restaurante de Teste"},
 plan:{name:"Dishy Essencial",priceCents:4900,modules:["Cardápio","Pedidos"]},
 acceptedAt:"2026-11-08T10:00:00-03:00"
};
test("contrato inclui preço, partes, módulos, data e dispensa cobrança automática",()=>{
 const c=createSubscriptionContractText(args);
 assert.match(c,/R\$\s?49,00/);
 assert.match(c,/Prestadora Exemplo Ltda/);
 assert.match(c,/Titular de Teste/);
 assert.match(c,/Cardápio, Pedidos/);
 assert.match(c,/não ativa um plano pago/);
 assert.equal(DISHY_CONTRACT_VERSION,"2026-11-08-draft-2");
});
test("hash é reproduzível e impede modificação silenciosa",()=>{
 const source=createSubscriptionContractText(args);
 assert.equal(contractHash(source),contractHash(source));
 assert.notEqual(contractHash(source),contractHash(source.replace("49,00","79,00")));
 assert.equal(contractHash(source).length,64);
});
test("contato é normalizado",()=>{
 assert.equal(cleanContractContact("+55 (19) 99999-0000"),"5519999990000");
});
