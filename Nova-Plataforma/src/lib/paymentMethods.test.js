import test from "node:test";
import assert from "node:assert/strict";
import {AVAILABLE_PAYMENT_METHODS,enabledPaymentMethods,validPaymentMethods} from "./paymentMethods.js";
test("lojas antigas mantêm métodos disponíveis",()=>assert.deepEqual(enabledPaymentMethods(undefined),["PIX","CARD_ONLINE","CASH","CARD_ON_DELIVERY"]));
test("somente dinheiro aparece quando configurado",()=>assert.deepEqual(enabledPaymentMethods(["CASH"]),["CASH"]));
test("mantém o cartão online ativo e rejeita métodos desconhecidos",()=>{assert.deepEqual(enabledPaymentMethods(["CARD_ONLINE","PIX","OUTRO"]),["CARD_ONLINE","PIX"]);assert.equal(validPaymentMethods(["CARD_ONLINE"]),true);assert.equal(validPaymentMethods(["OUTRO"]),false)});
test("não permite desabilitar todos nem duplicar",()=>{assert.equal(validPaymentMethods([]),false);assert.equal(validPaymentMethods(["PIX","PIX"]),false);assert.equal(validPaymentMethods([...AVAILABLE_PAYMENT_METHODS]),true)});
