import {createDecipheriv} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
const host="https://api.checkout.infinitepay.io";
export async function infinitepayCredentials(db,restaurantId){
 const data=(await db.collection("restaurants").doc(restaurantId).collection("privateIntegrations").doc("infinitepay").get()).data()||{};
 const key=process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
 if(!data.handle||!data.encryptedApiKey||!data.iv||!data.authTag||!/^[a-f0-9]{64}$/i.test(key||""))throw Error("infinitepay_not_configured");
 const decipher=createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),Buffer.from(data.iv,"base64"));
 decipher.setAuthTag(Buffer.from(data.authTag,"base64"));
 const apiKey=Buffer.concat([decipher.update(Buffer.from(data.encryptedApiKey,"base64")),decipher.final()]).toString("utf8");
 return {handle:data.handle,apiKey};
}
function paymentBaseUrl(){
 const base=process.env.PAYMENT_PUBLIC_HOST||process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
 if(!base)throw Error("payment_callback_not_configured");
 return "https://"+String(base).replace(/^https?:\/\//,"").replace(/\/$/,"");
}
export async function createInfiniteCheckout({db,restaurantId,orderId,slug,number,totalCents,name}){
 const {handle,apiKey}=await infinitepayCredentials(db,restaurantId);
 if(!Number.isSafeInteger(totalCents)||totalCents<100)throw Error("infinitepay_minimum_R$1");
 const origin=paymentBaseUrl(),orderNsu=restaurantId+":"+orderId;
 const payload={handle,order_nsu:orderNsu,items:[{quantity:1,price:totalCents,description:"Pedido Dishy #"+number}],redirect_url:origin+"/?loja="+encodeURIComponent(slug)+"&pedido="+encodeURIComponent(orderId)+"&ip_return=1",webhook:{url:origin+"/api/create-order?action=infinitepay-webhook&restaurantId="+encodeURIComponent(restaurantId)+"&orderId="+encodeURIComponent(orderId),events:["paid"]},customer:{name:name.slice(0,80)},options:{single_payment:true,valid_until:new Date(Date.now()+2*60*60*1000).toISOString()}};
 const response=await fetch(host+"/links",{method:"POST",headers:{"Content-Type":"application/json","X-Api-Key":apiKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
 const result=await response.json().catch(()=>({}));
 const checkoutUrl=String(result.url||result.checkout_url||result.checkoutUrl||"");
 if(!response.ok||!/^https:\/\//.test(checkoutUrl))throw Error("infinitepay_create_failed_"+response.status);
 return {type:"INFINITEPAY",checkoutUrl,orderNsu};
}
export function approvedInfinitePayment(result,totalCents){
 return result?.success===true&&result.paid===true&&Number.isSafeInteger(result.amount)&&result.amount===totalCents&&["pix","credit_card"].includes(result.capture_method);
}
export async function confirmInfinitePayment({db,restaurantId,orderId,orderNsu,transactionNsu,slug}){
 if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId)||!/^[a-zA-Z0-9_-]{5,128}$/.test(orderId)||String(orderNsu)!==restaurantId+":"+orderId||!transactionNsu||!slug||String(transactionNsu).length>180||String(slug).length>180)return false;
 const ref=db.collection("restaurants").doc(restaurantId).collection("orders").doc(orderId);
 const snap=await ref.get();
 if(!snap.exists||snap.data().provider!=="infinitepay"||snap.data().status==="CANCELLED")return false;
 const {handle,apiKey}=await infinitepayCredentials(db,restaurantId);
 const response=await fetch(host+"/payment_check",{method:"POST",headers:{"Content-Type":"application/json","X-Api-Key":apiKey},body:JSON.stringify({handle,order_nsu:orderNsu,transaction_nsu:String(transactionNsu),slug:String(slug)}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error("infinitepay_check_failed_"+response.status);
 const result=await response.json();
 if(!approvedInfinitePayment(result,Number(snap.data().totalCents)))return false;
 await db.runTransaction(async tx=>{
  const current=await tx.get(ref);
  if(!current.exists)return;
  const order=current.data();
  if(order.provider!=="infinitepay"||order.paymentStatus==="PAID"||order.status==="CANCELLED"||Number(order.totalCents)!==result.amount)return;
  const method=result.capture_method==="pix"?"PIX":"CARD_ONLINE";
  tx.update(ref,{paymentStatus:"PAID",paymentMethod:method,providerPaymentMethod:method,providerPaymentStatus:"approved",providerTransactionNsu:String(transactionNsu),providerInvoiceSlug:String(slug),status:"RECEIVED",paidAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
 });
 return true;
}
