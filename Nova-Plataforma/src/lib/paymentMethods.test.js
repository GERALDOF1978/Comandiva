import test from "node:test";
import assert from "node:assert/strict";
import {AVAILABLE_PAYMENT_METHODS,enabledPaymentMethods,validPaymentMethods} from "./paymentMethods.js";
test("lojas antigas mantêm métodos disponíveis",()=>assert.deepEqual(enabledPaymentMethods(undefined),["PIX","CASH","CARD_ON_DELIVERY"]));
test("somente dinheiro aparece quando configurado",()=>assert.deepEqual(enabledPaymentMethods(["CASH"]),["CASH"]));
test("não aceita cartão online experimental nem método desconhecido",()=>{assert.deepEqual(enabledPaymentMethods(["CARD_ONLINE","PIX"]),["PIX"]);assert.equal(validPaymentMethods(["CARD_ONLINE"]),false)});
test("não permite desabilitar todos nem duplicar",()=>{assert.equal(validPaymentMethods([]),false);assert.equal(validPaymentMethods(["PIX","PIX"]),false);assert.equal(validPaymentMethods([...AVAILABLE_PAYMENT_METHODS]),true)});
