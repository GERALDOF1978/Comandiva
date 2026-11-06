import {FieldValue} from "firebase-admin/firestore";
import {createInfiniteCheckout} from "../api/_infinitepay.js";

// Each table can have only one pending online charge. Never trust browser totals.
export async function startTabOnlineCheckout(base,tabRef,restaurantId,{slug,name,phone,email,paymentMethod}){
 const db=base.firestore,orderRef=base.collection("orders").doc();
 const claim=await db.runTransaction(async tx=>{
  const snap=await tx.get(tabRef);
  if(!snap.exists)throw Error("not_found");
  const tab=snap.data(),amount=Number(tab.totalCents);
  if(tab.type!=="TABLE")throw Error("invalid_tab_type");
  if(!["OPEN","BILL_REQUESTED"].includes(tab.status))throw Error("not_open");
  if(!Number.isSafeInteger(amount)||amount<100||amount>100000000||!Array.isArray(tab.items)||!tab.items.length)throw Error("invalid_total");
  if(tab.pixPayment?.paymentId||tab.nfcPayment?.orderId)throw Error("payment_pending");
  if(tab.onlinePayment?.orderId){
   const pending=tab.onlinePayment;
   if(pending.amountCents!==amount)throw Error("payment_pending");
   if(pending.checkoutUrl&&pending.status==="PENDING")return {reuse:true,orderId:pending.orderId,amountCents:amount,checkoutUrl:pending.checkoutUrl};
   throw Error("payment_preparing");
  }
  const number="T"+orderRef.id.slice(0,8).toUpperCase();
  tx.set(orderRef,{channel:"TABLE",source:"TABLE_CHECKOUT",paymentPurpose:"TAB_CLOSE",tabId:tabRef.id,number,table:"Mesa "+tab.label,items:tab.items,totalCents:amount,status:"PENDING_PAYMENT",paymentStatus:"PENDING",paymentMethod,provider:"infinitepay",customerSnapshot:{name,phone,email},createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  tx.update(tabRef,{status:"BILL_REQUESTED",onlinePayment:{orderId:orderRef.id,amountCents:amount,checkoutUrl:null,status:"PREPARING"},updatedAt:FieldValue.serverTimestamp()});
  return {reuse:false,orderId:orderRef.id,number,amountCents:amount,originalStatus:tab.status};
 });
 if(claim.reuse)return {type:"INFINITEPAY",checkoutUrl:claim.checkoutUrl,orderId:claim.orderId,amountCents:claim.amountCents};
 try{
  const payment=await createInfiniteCheckout({db,restaurantId,orderId:claim.orderId,slug,number:claim.number,totalCents:claim.amountCents,name,phone,email});
  await db.runTransaction(async tx=>{
   const current=await tx.get(tabRef),order=await tx.get(orderRef);
   if(!current.exists||!order.exists||current.data().onlinePayment?.orderId!==claim.orderId||current.data().status!=="BILL_REQUESTED")throw Error("payment_state_changed");
   tx.update(tabRef,{onlinePayment:{orderId:claim.orderId,amountCents:claim.amountCents,checkoutUrl:payment.checkoutUrl,status:"PENDING"},updatedAt:FieldValue.serverTimestamp()});
   tx.update(orderRef,{providerOrderNsu:payment.orderNsu,updatedAt:FieldValue.serverTimestamp()});
  });
  return {type:"INFINITEPAY",checkoutUrl:payment.checkoutUrl,orderId:claim.orderId,amountCents:claim.amountCents};
 }catch(error){
  await db.runTransaction(async tx=>{
   const current=await tx.get(tabRef),order=await tx.get(orderRef);
   if(order.exists)tx.update(orderRef,{paymentStatus:"ERROR",paymentError:String(error.message).slice(0,110),updatedAt:FieldValue.serverTimestamp()});
   if(current.exists&&current.data().onlinePayment?.orderId===claim.orderId&&current.data().onlinePayment?.status==="PREPARING")tx.update(tabRef,{status:claim.originalStatus,onlinePayment:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
  }).catch(()=>{});
  throw error;
 }
}
