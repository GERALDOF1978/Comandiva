import {createDecipheriv} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
export async function startTabPix(base,tabRef,restaurantId){
 const db=base.firestore, snap=await tabRef.get();
 if(!snap.exists)throw Error("not_found");
 const d=snap.data();
 if(!["OPEN","BILL_REQUESTED"].includes(d.status)||!Number.isInteger(d.totalCents)||d.totalCents<=0)throw Error("invalid_status");
 if(d.pixPayment?.paymentId&&d.pixPayment?.amountCents===d.totalCents)return d.pixPayment;
 const key=process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
 const config=(await base.collection("privateIntegrations").doc("mercadoPago").get()).data();
 if(!config?.encryptedAccessToken||!config.iv||!config.authTag||!/^[a-fA-F0-9]{64}$/.test(key||""))throw Error("payment_not_configured");
 const decipher=createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),Buffer.from(config.iv,"base64"));decipher.setAuthTag(Buffer.from(config.authTag,"base64"));
 const token=Buffer.concat([decipher.update(Buffer.from(config.encryptedAccessToken,"base64")),decipher.final()]).toString("utf8");
 const orderRef=base.collection("orders").doc("tabpix_"+tabRef.id);
 const existing=await orderRef.get();
 if(existing.exists&&existing.data().providerPaymentId){const p=existing.data();return {paymentId:p.providerPaymentId,qrCode:p.pixQrCode,amountCents:p.totalCents}}
 const host=process.env.PAYMENT_PUBLIC_HOST||process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
 if(!host)throw Error("payment_callback_not_configured");
 const notification_url="https://"+String(host).replace(/^https?:\/\//,"").replace(/\/$/,"")+"/api/create-order?action=payment-status&restaurantId="+encodeURIComponent(restaurantId);
 const response=await fetch("https://api.mercadopago.com/v1/payments",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","X-Idempotency-Key":orderRef.id},body:JSON.stringify({transaction_amount:d.totalCents/100,description:"Comanda "+d.label,payment_method_id:"pix",payer:{email:"comanda-"+tabRef.id+"@example.com"},external_reference:restaurantId+":"+orderRef.id,notification_url}),signal:AbortSignal.timeout(15000)});
 const mp=await response.json();if(!response.ok||!mp.id||!mp.point_of_interaction?.transaction_data?.qr_code)throw Error("pix_creation_failed");
 const pix={paymentId:String(mp.id),qrCode:mp.point_of_interaction.transaction_data.qr_code,amountCents:d.totalCents};
 await db.runTransaction(async tx=>{const latest=await tx.get(tabRef);if(!latest.exists||latest.data().totalCents!==d.totalCents||!["OPEN","BILL_REQUESTED"].includes(latest.data().status))throw Error("invalid_status");tx.set(orderRef,{channel:"TABLE",tabId:tabRef.id,table:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label,number:"C"+orderRef.id.slice(-8).toUpperCase(),customerSnapshot:{name:"Comanda "+d.label},items:d.items||[],totalCents:d.totalCents,status:"PENDING_PAYMENT",paymentStatus:"PENDING",paymentMethod:"PIX",provider:"mercado_pago",providerPaymentId:pix.paymentId,pixQrCode:pix.qrCode,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});tx.update(tabRef,{status:"BILL_REQUESTED",pixPayment:pix,updatedAt:FieldValue.serverTimestamp()})});
 return pix;
}
