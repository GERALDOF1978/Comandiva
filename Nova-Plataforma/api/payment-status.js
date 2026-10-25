import {createDecipheriv} from "node:crypto";
import {cert,getApps,initializeApp} from "firebase-admin/app";
import {FieldValue,getFirestore} from "firebase-admin/firestore";

function init(){
  if(getApps().length)return;
  initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})});
}
async function tokenFor(db,restaurantId){
  const cfg=(await db.collection("restaurants").doc(restaurantId).collection("privateIntegrations").doc("mercadoPago").get()).data();
  const key=process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
  if(!cfg?.encryptedAccessToken||!/^[a-fA-F0-9]{64}$/.test(key||""))throw Error("payment_not_configured");
  const d=createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),Buffer.from(cfg.iv,"base64"));
  d.setAuthTag(Buffer.from(cfg.authTag,"base64"));
  return Buffer.concat([d.update(Buffer.from(cfg.encryptedAccessToken,"base64")),d.final()]).toString("utf8");
}
async function providerPayment(token,id){
  const response=await fetch("https://api.mercadopago.com/v1/payments/"+encodeURIComponent(id),{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error("payment_lookup_failed");
  return response.json();
}
async function reconcile(db,restaurantId,orderId,payment){
  const ref=db.collection("restaurants").doc(restaurantId).collection("orders").doc(orderId);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)return;
    const order=snap.data();
    if(!["PIX","CARD_ONLINE"].includes(order.paymentMethod))return;
    if(payment.external_reference!==restaurantId+":"+orderId)return;
    if(Math.round(Number(payment.transaction_amount)*100)!==Number(order.totalCents))return;
    if(order.providerPaymentId&&String(order.providerPaymentId)!==String(payment.id))return;
    if(order.paymentStatus==="PAID"||order.status==="CANCELLED")return;
    const approved=payment.status==="approved";
    tx.update(ref,{providerPaymentId:String(payment.id),providerPaymentStatus:String(payment.status),paymentStatus:approved?"PAID":payment.status==="rejected"||payment.status==="cancelled"?"FAILED":"PENDING",...(approved?{status:"RECEIVED",paidAt:FieldValue.serverTimestamp()}:{}),updatedAt:FieldValue.serverTimestamp()});
  });
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
  try{
    init();const db=getFirestore();
    if(req.method==="GET"){
      const restaurantId=String(req.query.restaurantId||""),orderId=String(req.query.orderId||"");
      if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId)||!/^[a-zA-Z0-9_-]{5,128}$/.test(orderId))return res.status(400).json({error:"invalid_order"});
      const snap=await db.collection("restaurants").doc(restaurantId).collection("orders").doc(orderId).get();
      if(!snap.exists)return res.status(404).json({error:"order_not_found"});
      const order=snap.data();
      if(order.paymentStatus!=="PAID"&&order.providerPaymentId){
        try{await reconcile(db,restaurantId,orderId,await providerPayment(await tokenFor(db,restaurantId),order.providerPaymentId))}catch(e){console.error("payment-status-reconcile",e.message)}
      }
      const fresh=(await snap.ref.get()).data();
      return res.status(200).json({paymentStatus:fresh.paymentStatus,status:fresh.status});
    }
    const id=String(req.body?.data?.id||req.query["data.id"]||req.body?.id||"");
    if(!/^\d{1,24}$/.test(id))return res.status(200).json({ok:true});
    // Never trust the webhook payload for approval: query Mercado Pago using the restaurant's own token.
    // Resolve restaurant only from an order reference returned by Mercado Pago, not caller-supplied status.
    const restaurantId=String(req.query.restaurantId||"");
    if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId))return res.status(200).json({ok:true});
    const payment=await providerPayment(await tokenFor(db,restaurantId),id);
    const parts=String(payment.external_reference||"").split(":");
    if(parts.length===2&&parts[0]===restaurantId&&/^[a-zA-Z0-9_-]{5,128}$/.test(parts[1]))await reconcile(db,restaurantId,parts[1],payment);
    return res.status(200).json({ok:true});
  }catch(e){console.error("payment-status",e.message);return res.status(200).json({ok:true})}
}
