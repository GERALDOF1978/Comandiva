import test from "node:test";
import assert from "node:assert/strict";
import {buildInfiniteTapLink} from "./nfcTap.js";
const sale={amountCents:3800,orderId:"order123",handle:"minhaloja"};
test("envia valor real em centavos e referencia",()=>{const link=buildInfiniteTapLink(sale);const url=new URL(link);assert.equal(url.searchParams.get("amount"),"3800");assert.equal(url.searchParams.get("order_id"),"order123");assert.equal(url.searchParams.get("handle"),"minhaloja");assert.equal(url.searchParams.get("payment_method"),"debit")});
test("cartao credito e parcelamento",()=>{const x=new URL(buildInfiniteTapLink({...sale,paymentMethod:"credit",installments:2}));assert.equal(x.searchParams.get("installments"),"2")});
test("rejeita valores invalidos",()=>{assert.throws(()=>buildInfiniteTapLink({...sale,amountCents:0}),/invalid_tap_amount/);assert.throws(()=>buildInfiniteTapLink({...sale,amountCents:155.2}),/invalid_tap_amount/);assert.throws(()=>buildInfiniteTapLink({...sale,paymentMethod:"debit",installments:3}),/invalid_tap_installments/)});
