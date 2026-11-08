import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
import {timingSafeEqual} from "node:crypto";
import {addCalendarMonth,checkoutPaymentApproved,currentPlanPeriodStart,parseSubscriptionOrderNsu} from "../src/lib/subscriptionBilling.js";

export const CHECKOUT_HOST="https://api.checkout.infinitepay.io";
export function getBillingDb(){
 if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})});
 return getFirestore();
}
export function billingEnabled(){
 return process.env.DISHY_BILLING_ENABLED==="true"&&
 process.env.DISHY_CONTRACT_ENABLED==="true"&&
 process.env.DISHY_CONTRACT_LEGAL_REVIEWED==="true"&&
 process.env.DISHY_BILLING_MERCHANT_REVIEWED==="true"&&
 /^[A-Za-z0-9_.-]{2,64}$/.test(String(process.env.DISHY_BILLING_INFINITE_HANDLE||""))&&
 /^inchk_[A-Za-z0-9_-]{10,}$/.test(String(process.env.DISHY_BILLING_INFINITE_API_KEY||""));
}
export function billingMerchant(){
 const handle=String(process.env.DISHY_BILLING_INFINITE_HANDLE||"");
 const apiKey=String(process.env.DISHY_BILLING_INFINITE_API_KEY||"");
 if(!billingEnabled())throw Error("billing_not_configured");
 return {handle,apiKey};
}
export function tokenMatches(value,secret){
 if(!secret||secret.length<20||typeof value!=="string")return false;
 const x=Buffer.from(value),y=Buffer.from(secret);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export async function verifyBillingOwner(db,user,restaurantId){
 if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId)||user.email_verified!==true||!user.email)throw Error("owner_access_denied");
 const ref=db.collection("restaurants").doc(restaurantId);
 const [store,member,linked]=await Promise.all([ref.get(),ref.collection("members").doc(user.uid).get(),db.collection("userRestaurantAccess").doc(user.uid).collection("restaurants").doc(restaurantId).get()]);
 const authorized=store.exists&&member.exists&&member.data()?.active===true&&member.data()?.role==="owner"&&linked.exists&&linked.data()?.active===true&&linked.data()?.role==="owner";
 if(!authorized)throw Error("owner_access_denied");
 return store.data();
}
export async function notifyBillingEvent(db,eventId){
 if(!process.env.N8N_BILLING_WEBHOOK_URL||!process.env.N8N_BILLING_WEBHOOK_TOKEN||!/^[\w-]{20,}$/.test(process.env.N8N_BILLING_WEBHOOK_TOKEN))return false;
 if(!/^https:\/\//.test(process.env.N8N_BILLING_WEBHOOK_URL))return false;
 const ref=db.collection("billingDeliveryOutbox").doc(eventId),snap=await ref.get();
 if(!snap.exists||snap.data().status==="handed_off_to_n8n")return false;
 const event=snap.data();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 let sent=false;
 try{
  const response=await fetch(process.env.N8N_BILLING_WEBHOOK_URL,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json","X-Dishy-Billing-Key":process.env.N8N_BILLING_WEBHOOK_TOKEN},body:JSON.stringify({eventId,eventType:event.eventType,restaurantId:event.restaurantId,contractId:event.contractId,invoiceId:event.invoiceId,planName:event.planName,priceCents:event.priceCents,toEmail:event.toEmail,toWhatsApp:event.toWhatsApp,paymentUrl:event.paymentUrl||null,receiptUrl:event.receiptUrl||null,periodEndAt:event.periodEndAt?.toDate?.()?.toISOString?.()||null})});
  sent=response.ok;
 }catch{/* a entrega deve ser reconciliada na fila; não alterar assinatura por erro do n8n */}
 finally{clearTimeout(timer)}
 await ref.set({status:sent?"handed_off_to_n8n":"queued",lastAttemptAt:FieldValue.serverTimestamp(),attemptCount:FieldValue.increment(1)},{merge:true});
 return sent;
}
export function billingPayload({invoice,customer,merchant}){
 const origin="https://dishy.com.br";
 const body={
  handle:merchant.handle,
  order_nsu:invoice.orderNsu,
  items:[{quantity:1,price:invoice.priceCents,description:"Assinatura Dishy - "+String(invoice.planName).slice(0,65)}],
  customer:{name:String(customer.name||"Cliente").slice(0,80),email:String(customer.email||"").slice(0,120)},
  redirect_url:origin+"/login?subscription_return=1",
  webhook:{url:origin+"/api/subscription-payment-webhook",events:["paid"]},
  options:{single_payment:true,require_delivery_address:false,payment_methods_enabled:["credit_card","pix"],valid_until:new Date(invoice.expiresAtMs).toISOString()}
 };
 const digits=String(customer.whatsapp||"").replace(/\D/g,""),national=digits.startsWith("55")?digits.slice(2):digits;
 if(national.length===10||national.length===11)body.customer.phone_number="+55"+national;
 return body;
}
export async function confirmBillingPayment(db,{orderNsu,slug,transactionNsu}){
 const invoiceId=parseSubscriptionOrderNsu(orderNsu);
 if(!invoiceId||typeof slug!=="string"||slug.length<1||slug.length>180||typeof transactionNsu!=="string"||transactionNsu.length<1||transactionNsu.length>180)return {ok:false,code:"invalid_payment_identifier"};
 const invoiceRef=db.collection("subscriptionInvoices").doc(invoiceId),snap=await invoiceRef.get();
 if(!snap.exists||snap.data().orderNsu!==orderNsu)return {ok:false,code:"unknown_invoice"};
 if(snap.data().status==="paid")return {ok:true,alreadyPaid:true,invoiceId};
 if(!["pending","creating"].includes(snap.data().status))return {ok:false,code:"invoice_not_payable"};
 const merchant=billingMerchant();
 const response=await fetch(CHECKOUT_HOST+"/payment_check",{method:"POST",headers:{"Content-Type":"application/json","X-Api-Key":merchant.apiKey},body:JSON.stringify({handle:merchant.handle,order_nsu:orderNsu,transaction_nsu:transactionNsu,slug}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)return {ok:false,code:"payment_check_http_"+response.status};
 const verification=await response.json().catch(()=>({}));
 if(!checkoutPaymentApproved(verification,snap.data().priceCents))return {ok:false,code:"payment_not_verified"};
 const invoice=snap.data(),subRef=db.collection("subscriptions").doc(invoice.restaurantId),contractRef=db.collection("subscriptionContracts").doc(invoice.contractId);
 const notificationId=invoiceId+"_paid";let newlyPaid=false,review=false;
 await db.runTransaction(async tx=>{
  const [fresh,sub,contract]=await Promise.all([tx.get(invoiceRef),tx.get(subRef),tx.get(contractRef)]);
  if(!fresh.exists||fresh.data().orderNsu!==orderNsu||!["pending","creating"].includes(fresh.data().status)||!contract.exists||contract.data().restaurantId!==invoice.restaurantId||contract.data().planId!==invoice.planId)return;
  const current=sub.data()||{},paidMs=current.paidUntil?.toMillis?.(),previousPlan=current.planId||"trial";
  const switchedPlan=previousPlan!=="trial"&&previousPlan!==invoice.planId;
  const mismatchedCycle=invoice.billingAnchor!=="initial"&&invoice.billingAnchor!=="r"+String(paidMs||"");
  if(switchedPlan||mismatchedCycle){
   review=true;
   tx.update(invoiceRef,{status:"paid_needs_review",verifiedPaymentMethod:verification.capture_method,transactionNsu,invoiceSlug:slug,paidAt:FieldValue.serverTimestamp(),reviewReason:switchedPlan?"plan_changed":"cycle_changed"});
   return;
  }
  const periodStartMs=currentPlanPeriodStart(current),periodEndMs=addCalendarMonth(periodStartMs);
  const method=verification.capture_method==="pix"?"PIX":"CARD_ONLINE";
  tx.update(invoiceRef,{status:"paid",verifiedPaymentMethod:method,transactionNsu,invoiceSlug:slug,paidAt:FieldValue.serverTimestamp(),periodStartAt:new Date(periodStartMs),periodEndAt:new Date(periodEndMs)});
  tx.set(subRef,{planId:invoice.planId,status:"active",billingMode:"manual_checkout",paidUntil:new Date(periodEndMs),currentContractId:invoice.contractId,lastInvoiceId:invoiceId,lastPaymentProvider:"infinitepay",lastPaymentMethod:method,lastPaidAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  const client=contract.data().customer||{};
  tx.create(db.collection("billingDeliveryOutbox").doc(notificationId),{eventId:notificationId,eventType:"SUBSCRIPTION_PAYMENT_CONFIRMED",restaurantId:invoice.restaurantId,contractId:invoice.contractId,invoiceId,planName:invoice.planName,priceCents:invoice.priceCents,toEmail:client.email||"",toWhatsApp:client.whatsapp||"",periodEndAt:new Date(periodEndMs),status:"queued",createdAt:FieldValue.serverTimestamp()});
  newlyPaid=true;
 });
 if(newlyPaid)await notifyBillingEvent(db,notificationId).catch(()=>{});
 return {ok:newlyPaid||review,activated:newlyPaid,needsReview:review,alreadyPaid:!newlyPaid&&!review,invoiceId};
}
export async function verifyIdToken(req){
 const bearer=String(req.headers.authorization||"");
 if(!bearer.startsWith("Bearer "))throw Error("unauthorized");
 return getAuth().verifyIdToken(bearer.slice(7),true);
}
