import {test} from "node:test";
import assert from "node:assert/strict";
import {acceptedWhatsAppPayload} from "./whatsappMessagePayload.js";
test("pedido aceito leva forma real do pagamento, complementos e link de acompanhamento",()=>{
 const p=acceptedWhatsAppPayload({
  order:{number:147,channel:"DELIVERY",paymentMethod:"PIX",paymentStatus:"PAID",totalCents:4500,deliveryFeeCents:500,customerSnapshot:{name:"Cliente",phone:"19999998888"},items:[{qty:1,name:"Pizza",totalCents:4000,options:[{name:"Calabresa"},{name:"Borda extra"}]}]},
  restaurant:{name:"Lu Lanches",slug:"lu-lanches",whatsappInstance:"lu"},orderId:"docID"
 });
 assert.equal(p.event,"ORDER_ACCEPTED");
 assert.equal(p.paymentStatus,"PAID");
 assert.equal(p.paymentMethod,"PIX");
 assert.equal(p.trackingUrl,"https://dishy.com.br/?loja=lu-lanches");
 assert.equal(p.customerPhone,"19999998888");
 assert.equal(p.items[0].options[1].name,"Borda extra");
 assert.equal(p.totalCents,4500);
 assert.equal(p.deliveryFeeCents,500);
});
test("pagamento na retirada não é marcado como recebido",()=>{
 const p=acceptedWhatsAppPayload({order:{channel:"PICKUP",paymentMethod:"CASH",paymentStatus:"PENDING"},restaurant:{slug:"x"}});
 assert.equal(p.paymentStatus,"PENDING");
 assert.equal(p.paymentMethod,"CASH");
});
test("não inventa link sem slug válido",()=>{
 const p=acceptedWhatsAppPayload({order:{},restaurant:{slug:"../../unsafe"}});
 assert.equal(p.trackingUrl,undefined);
});
