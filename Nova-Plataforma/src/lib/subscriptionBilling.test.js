import test from "node:test";
import assert from "node:assert/strict";
import {addCalendarMonth,billingAnchor,billableNow,currentPlanPeriodStart,subscriptionInvoiceId,subscriptionOrderNsu,parseSubscriptionOrderNsu,checkoutPaymentApproved} from "./subscriptionBilling.js";
test("mês de faturamento preserva final do mês sem cair em data inválida",()=>{
 const january=Date.parse("2026-01-31T12:00:00Z");
 assert.equal(new Date(addCalendarMonth(january)).toISOString(),"2026-02-28T12:00:00.000Z");
});
test("NSU e identificador de cobrança estáveis por ciclo",()=>{
 const id=subscriptionInvoiceId("restaurante0001",{paidUntil:new Date("2026-12-01T00:00:00Z")});
 assert.equal(parseSubscriptionOrderNsu(subscriptionOrderNsu(id)),id);
 assert.equal(billingAnchor({}),"initial");
 assert.equal(parseSubscriptionOrderNsu("wrong"),null);
});
test("validar pagamento usa valor original e meio autorizado",()=>{
 assert.ok(checkoutPaymentApproved({success:true,paid:true,amount:7900,paid_amount:8120,capture_method:"credit_card"},7900));
 assert.ok(!checkoutPaymentApproved({success:true,paid:true,amount:4900,capture_method:"pix"},7900));
 assert.ok(!checkoutPaymentApproved({success:true,paid:false,amount:7900,capture_method:"pix"},7900));
});
test("permite pagamento antecipado a no máximo sete dias do vencimento",()=>{
 const now=Date.parse("2026-11-08T12:00:00Z");
 assert.ok(!billableNow({status:"trial",trialEndsAt:new Date(now+10*86400000)},now));
 assert.ok(billableNow({status:"trial",trialEndsAt:new Date(now+6*86400000)},now));
 assert.equal(currentPlanPeriodStart({status:"trial",trialEndsAt:new Date(now+6*86400000)},now),now+6*86400000);
});
