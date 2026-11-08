import {FieldValue} from "firebase-admin/firestore";
import {billingEnabled,getBillingDb,notifyBillingEvent,tokenMatches} from "./_subscription-billing.js";

function saoPauloDay(time){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(time);
 const get=k=>Number(parts.find(p=>p.type===k)?.value);
 return Math.floor(Date.UTC(get("year"),get("month")-1,get("day"))/86400000);
}
export default async function handler(req,res){
 res.setHeader("Cache-Control","private, no-store");
 if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
 if(!tokenMatches(req.headers["x-dishy-billing-cron-key"],process.env.DISHY_BILLING_CRON_TOKEN))return res.status(403).json({error:"forbidden"});
 if(!billingEnabled())return res.status(409).json({error:"billing_not_configured"});
 try{
  const db=getBillingDb(),now=Date.now(),today=saoPauloDay(now);
  const docs=await db.collection("subscriptionInvoices").where("status","==","pending").limit(200).get();
  let queued=0,attempted=0;
  for(const entry of docs.docs){
   const bill=entry.data();
   if(!bill.checkoutUrl||!/^https:\/\//.test(bill.checkoutUrl)||bill.expiresAtMs<=now||!Number.isFinite(bill.dueAtMs))continue;
   const days=saoPauloDay(bill.dueAtMs)-today;
   if(![7,2,0,-1,-3,-5].includes(days))continue;
   const eventId=entry.id+"_reminder_"+String(days).replace("-","m");
   const outbox=db.collection("billingDeliveryOutbox").doc(eventId);
   const exists=await outbox.get();
   if(exists.exists){
    // Falha de entrega anterior: uma nova passagem pode repassar o mesmo evento.
    if(exists.data()?.status==="queued"){await notifyBillingEvent(db,eventId).catch(()=>{});attempted++;}
    continue;
   }
   const contract=await db.collection("subscriptionContracts").doc(bill.contractId).get();
   if(!contract.exists)continue;
   const customer=contract.data().customer||{};
   await outbox.create({eventId,eventType:"SUBSCRIPTION_REMINDER",daysToDue:days,restaurantId:bill.restaurantId,contractId:bill.contractId,invoiceId:entry.id,planName:bill.planName,priceCents:bill.priceCents,toEmail:customer.email||"",toWhatsApp:customer.whatsapp||"",paymentUrl:bill.checkoutUrl,dueAtMs:bill.dueAtMs,status:"queued",createdAt:FieldValue.serverTimestamp()}).catch(err=>{if(err.code!==6&&err.code!=="already-exists")throw err;});
   await notifyBillingEvent(db,eventId).catch(()=>{});queued++;
  }
  return res.status(200).json({ok:true,scanned:docs.size,newReminders:queued,retried:attempted});
 }catch{return res.status(503).json({error:"reminders_unavailable"})}
}
