import {cert,getApps,initializeApp} from "firebase-admin/app";
import {FieldValue,getFirestore} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
function init(){if(getApps().length)return;const {FIREBASE_PROJECT_ID:projectId,FIREBASE_CLIENT_EMAIL:clientEmail}=process.env;const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");if(!projectId||!clientEmail||!privateKey)throw new Error("Firebase Admin não configurado");initializeApp({credential:cert({projectId,clientEmail,privateKey})})}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
 try{
  init();
  const authHeader=req.headers.authorization||"";
  if(!authHeader.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
  const user=await getAuth().verifyIdToken(authHeader.slice(7),true);
  const {restaurantId,orderId}=req.body||{};
  if(typeof restaurantId!=="string"||typeof orderId!=="string"||!restaurantId||!orderId)return res.status(400).json({error:"invalid_request"});
  const db=getFirestore();
  const member=await db.collection("restaurants").doc(restaurantId).collection("members").doc(user.uid).get();
  if(!member.exists||member.data().active!==true||!["owner","manager","cashier","waiter"].includes(member.data().role))return res.status(403).json({error:"forbidden"});
  if(!process.env.DISHY_N8N_WEBHOOK_URL||!process.env.DISHY_N8N_WEBHOOK_SECRET)return res.status(503).json({error:"whatsapp_not_configured"});
  const ref=db.collection("restaurants").doc(restaurantId).collection("orders").doc(orderId);
  const now=Date.now();
  let order;
  try{
   order=await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap.exists)throw new Error("not_found");
    const o=snap.data();
    if(o.status!=="PENDING_PAYMENT"||o.paymentMethod!=="PIX"||o.paymentStatus==="PAID"||o.paymentStatus==="CANCELLED"||o.paymentStatus==="EXPIRED")throw new Error("payment_not_pending");
    const created=o.createdAt?.toMillis?.()??(typeof o.createdAt==="string"?Date.parse(o.createdAt):NaN);
    if(!Number.isFinite(created)||now-created<5*60*1000)throw new Error("too_early");
    if(o.pixReminderSentAt||o.pixReminderClaimedAt)throw new Error("already_reminded");
    tx.update(ref,{pixReminderClaimedAt:FieldValue.serverTimestamp()});
    return o;
   });
  }catch(e){
   const codes={not_found:404,payment_not_pending:409,too_early:409,already_reminded:409};
   if(codes[e.message])return res.status(codes[e.message]).json({error:e.message});
   throw e;
  }
  const release=async()=>{try{await ref.update({pixReminderClaimedAt:FieldValue.delete()})}catch(e){console.error("dishy_pix_reminder_release_failed",e)}};
  try{
   const restaurant=(await db.collection("restaurants").doc(restaurantId).get()).data()||{};
   const phone=String(order.customerSnapshot?.phone||"").replace(/\D/g,"");
   const instance=String(restaurant.whatsappInstance||process.env.DISHY_WHATSAPP_INSTANCE||"").trim();
   if(!phone||!instance){await release();return res.status(422).json({error:"missing_whatsapp_data"})}
   // Recheck current payment state before notifying; payment webhook may have completed in the meantime.
   const latest=(await ref.get()).data();
   if(latest?.status!=="PENDING_PAYMENT"||latest?.paymentStatus==="PAID"){await release();return res.status(409).json({error:"payment_not_pending"})}
   const response=await fetch(process.env.DISHY_N8N_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json","x-dishy-secret":process.env.DISHY_N8N_WEBHOOK_SECRET},body:JSON.stringify({event:"PIX_PAYMENT_REMINDER",restaurantName:String(restaurant.name||restaurant.displayName||"Restaurante"),customerName:String(order.customerSnapshot?.name||"Cliente"),orderNumber:String(order.number||orderId),customerPhone:phone,whatsappInstance:instance,totalCents:Number(order.totalCents||0)}),signal:AbortSignal.timeout(10000)});
   if(!response.ok){await release();console.error("dishy_pix_reminder_webhook_http",response.status);return res.status(502).json({error:"whatsapp_send_failed"})}
   await ref.update({pixReminderSentAt:FieldValue.serverTimestamp(),pixReminderClaimedAt:FieldValue.delete()});
   return res.status(200).json({ok:true});
  }catch(e){await release();console.error("dishy_pix_reminder_failed",e);return res.status(502).json({error:"whatsapp_send_failed"})}
 }catch(e){console.error("dishy_pix_reminder",e);return res.status(500).json({error:"internal_error"})}
}
