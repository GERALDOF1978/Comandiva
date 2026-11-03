import {test} from "node:test";
import assert from "node:assert/strict";
import {subscriptionAccess,restaurantMayReceiveOrders,NEW_TRIAL_DAYS} from "./subscriptionAccess.js";
const now=Date.parse("2026-11-03T12:00:00Z");
test("novos restaurantes recebem 180 dias",()=>assert.equal(NEW_TRIAL_DAYS,180));
test("trial não expirado recebe pedidos",()=>assert.equal(subscriptionAccess({planId:"trial",status:"trial",trialEndsAt:new Date(now+86400000)},now).allowed,true));
test("trial vencido bloqueia apenas novos pedidos",()=>assert.equal(subscriptionAccess({planId:"trial",status:"trial",trialEndsAt:new Date(now-1)},now).error,"subscription_expired"));
test("trial exatamente no vencimento bloqueia",()=>assert.equal(subscriptionAccess({planId:"trial",status:"trial",trialEndsAt:new Date(now)},now).allowed,false));
test("carimbo Firestore funciona",()=>assert.equal(subscriptionAccess({planId:"trial",status:"trial",trialEndsAt:{toMillis:()=>now+86400000}},now).allowed,true));
test("plano pago ativo libera pedidos",()=>assert.equal(subscriptionAccess({planId:"dishy-completo",status:"active"},now).allowed,true));
test("plano aguardando pagamento bloqueia",()=>assert.equal(subscriptionAccess({planId:"dishy-completo",status:"pending_payment"},now).error,"subscription_inactive"));
test("plano cancelado bloqueia",()=>assert.equal(subscriptionAccess({planId:"dishy-completo",status:"canceled"},now).allowed,false));
test("sem registro de assinatura bloqueia",()=>assert.equal(subscriptionAccess(null,now).error,"subscription_unavailable"));
test("consulta usa documento por restaurante",async()=>{
 let id;
 const fake={collection:(c)=>{assert.equal(c,"subscriptions");return{doc:(rid)=>{id=rid;return{get:async()=>({exists:true,data:()=>({planId:"trial",status:"trial",trialEndsAt:new Date(now+1)})})}}}}};
 const permission=await restaurantMayReceiveOrders(fake,"restaurante_a",now);
 assert.equal(id,"restaurante_a");assert.equal(permission.allowed,true);
});

test("estabelecimento antigo sem assinatura não perde pedidos já operantes",async()=>{
 const db={collection:()=>({doc:()=>({get:async()=>({exists:false})})})};
 const result=await restaurantMayReceiveOrders(db,"legacy",now);
 assert.equal(result.allowed,true);
 assert.equal(result.status,"legacy_without_subscription");
});
