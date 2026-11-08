import {FieldValue} from "firebase-admin/firestore";
import {getBillingDb,verifyIdToken,verifyBillingOwner,billingEnabled,billingMerchant,billingPayload,CHECKOUT_HOST,notifyBillingEvent} from "./_subscription-billing.js";
import {subscriptionInvoiceId,subscriptionOrderNsu,billableNow,billingAnchor,toMillis} from "../src/lib/subscriptionBilling.js";

export default async function handler(req,res){
 res.setHeader("Cache-Control","private, no-store");
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 try{
  const db=getBillingDb(),user=await verifyIdToken(req);
  const body=req.method==="GET"?req.query||{}:req.body||{},rid=String(body.restaurantId||"");
  await verifyBillingOwner(db,user,rid);
  if(req.method==="GET"){
   const entries=await db.collection("subscriptionInvoices").where("restaurantId","==",rid).limit(30).get();
   const bills=entries.docs.map(s=>({id:s.id,status:s.data().status,planId:s.data().planId,planName:s.data().planName,priceCents:s.data().priceCents,paymentMethod:s.data().paymentMethod||null,checkoutUrl:s.data().checkoutUrl||null,expiresAtMs:s.data().expiresAtMs,paidAt:s.data().paidAt?.toDate?.()?.toISOString?.()||null,periodEndAt:s.data().periodEndAt?.toDate?.()?.toISOString?.()||null}));
   bills.sort((a,b)=>(b.expiresAtMs||0)-(a.expiresAtMs||0));
   return res.status(200).json({enabled:billingEnabled(),invoices:bills,checkoutMode:"PIX_OR_CARD_ONE_TIME",automaticRenewal:false});
  }
  if(body.action!=="checkout")return res.status(400).json({error:"unknown_action"});
  if(!billingEnabled())return res.status(409).json({error:"billing_not_configured"});
  const contractId=String(body.contractId||""),paymentMethod=String(body.paymentMethod||"");
  if(!["pix","credit_card"].includes(paymentMethod))return res.status(400).json({error:"select_payment_method"});
  if(!/^[a-f0-9]{40}$/.test(contractId))return res.status(400).json({error:"invalid_contract"});
  const [contractSnap,subscriptionSnap]=await Promise.all([db.collection("subscriptionContracts").doc(contractId).get(),db.collection("subscriptions").doc(rid).get()]);
  if(!contractSnap.exists||!subscriptionSnap.exists)return res.status(404).json({error:"contract_or_subscription_not_found"});
  const contract=contractSnap.data(),sub=subscriptionSnap.data();
  if(contract.restaurantId!==rid||contract.actorUid!==user.uid||contract.state!=="accepted_awaiting_payment")return res.status(403).json({error:"invalid_contract_state"});
  if(!billableNow(sub))return res.status(409).json({error:"payment_not_due_yet"});
  if(sub.status==="active"&&sub.planId!=="trial"&&sub.planId!==contract.planId)return res.status(409).json({error:"plan_change_requires_master"});
  const planSnap=await db.collection("plans").doc(contract.planId).get();
  if(!planSnap.exists||planSnap.data().active!==true||planSnap.data().priceCents!==contract.priceCents||planSnap.data().name!==contract.planName)return res.status(409).json({error:"contract_plan_changed"});
  if(!Number.isSafeInteger(contract.priceCents)||contract.priceCents<100||contract.priceCents>100000000)return res.status(409).json({error:"invalid_plan_amount"});
  const invoiceId=subscriptionInvoiceId(rid,sub),orderNsu=subscriptionOrderNsu(invoiceId);
  const invoiceRef=db.collection("subscriptionInvoices").doc(invoiceId);
  let existingUrl="",needsCreation=false,invoiceData=null;
  await db.runTransaction(async tx=>{
   const [freshSubscription,old]=await Promise.all([tx.get(db.collection("subscriptions").doc(rid)),tx.get(invoiceRef)]);
   if(!freshSubscription.exists||billingAnchor(freshSubscription.data())!==billingAnchor(sub))throw Error("subscription_cycle_changed");
   if(old.exists){
    const oldInvoice=old.data();
    if(oldInvoice.contractId!==contractId||oldInvoice.priceCents!==contract.priceCents)throw Error("another_invoice_exists_for_cycle");
    if(oldInvoice.paymentMethod&&oldInvoice.paymentMethod!==paymentMethod)throw Error("invoice_payment_method_locked");
    if(oldInvoice.status==="paid")throw Error("invoice_already_paid");
    if(oldInvoice.checkoutUrl&&oldInvoice.status==="pending"&&oldInvoice.expiresAtMs>Date.now()){existingUrl=oldInvoice.checkoutUrl;return;}
    if(oldInvoice.status==="creating"&&Date.now()-Number(oldInvoice.lastAttemptMs||0)<120000)throw Error("invoice_creation_in_progress");
    if(oldInvoice.expiresAtMs<Date.now())throw Error("invoice_expired_contact_support");
    if(!["creating","error","pending"].includes(oldInvoice.status))throw Error("invoice_not_payable");
    invoiceData={...oldInvoice,paymentMethod:oldInvoice.paymentMethod||paymentMethod};needsCreation=true;
    tx.update(invoiceRef,{status:"creating",paymentMethod:oldInvoice.paymentMethod||paymentMethod,lastAttemptMs:Date.now(),updatedAt:FieldValue.serverTimestamp()});
    return;
   }
   const now=Date.now(),expiresAtMs=now+14*86400000;
   invoiceData={restaurantId:rid,contractId,planId:contract.planId,planName:contract.planName,priceCents:contract.priceCents,paymentMethod,orderNsu,billingAnchor:billingAnchor(sub),dueAtMs:(Number.isFinite(toMillis(sub.paidUntil))?toMillis(sub.paidUntil):sub.status==="trial"&&Number.isFinite(toMillis(sub.trialEndsAt))?toMillis(sub.trialEndsAt):now),status:"creating",createdAt:FieldValue.serverTimestamp(),lastAttemptMs:now,expiresAtMs};
   tx.create(invoiceRef,invoiceData);needsCreation=true;
  });
  if(existingUrl)return res.status(200).json({ok:true,invoiceId,checkoutUrl:existingUrl,reused:true,automaticRenewal:false});
  if(!needsCreation||!invoiceData)return res.status(409).json({error:"invoice_creation_in_progress"});
  const merchant=billingMerchant();
  const payload=billingPayload({invoice:invoiceData,customer:contract.customer||{},merchant});
  let checkoutUrl="";
  try{
   const response=await fetch(CHECKOUT_HOST+"/links",{method:"POST",headers:{"Content-Type":"application/json","X-Api-Key":merchant.apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   const result=await response.json().catch(()=>({}));
   checkoutUrl=String(result.url||result.checkout_url||result.checkoutUrl||"");
   if(!response.ok||!/^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(checkoutUrl))throw Error("provider_checkout_failed");
  }catch{
   await invoiceRef.set({status:"error",updatedAt:FieldValue.serverTimestamp()},{merge:true});
   return res.status(503).json({error:"checkout_creation_failed"});
  }
  const outboxId=invoiceId+"_created";
  await db.runTransaction(async tx=>{
   const invoice=await tx.get(invoiceRef);
   if(!invoice.exists||invoice.data().orderNsu!==orderNsu||invoice.data().status!=="creating")return;
   tx.update(invoiceRef,{checkoutUrl,status:"pending",updatedAt:FieldValue.serverTimestamp()});
   tx.create(db.collection("billingDeliveryOutbox").doc(outboxId),{eventId:outboxId,eventType:"SUBSCRIPTION_INVOICE_CREATED",restaurantId:rid,contractId,invoiceId,planName:contract.planName,priceCents:contract.priceCents,toEmail:contract.customer?.email||user.email,toWhatsApp:contract.customer?.whatsapp||"",paymentUrl:checkoutUrl,status:"queued",createdAt:FieldValue.serverTimestamp()});
  });
  await notifyBillingEvent(db,outboxId).catch(()=>{});
  return res.status(201).json({ok:true,invoiceId,checkoutUrl,automaticRenewal:false,note:"Cobrança avulsa. Ativação somente após confirmação oficial InfinitePay."});
 }catch(error){
  const code=String(error.message||"billing_processing_failed");
  const known=["owner_access_denied","unauthorized","subscription_cycle_changed","another_invoice_exists_for_cycle","invoice_payment_method_locked","invoice_already_paid","invoice_creation_in_progress","invoice_expired_contact_support","invoice_not_payable"];
  return res.status(code==="unauthorized"?401:code==="owner_access_denied"?403:known.includes(code)?409:500).json({error:known.includes(code)?code:code==="unauthorized"?"unauthorized":"billing_processing_failed"});
 }
}
