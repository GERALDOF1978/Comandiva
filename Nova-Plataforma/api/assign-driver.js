import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
async function notifyDriverAssigned(base,restaurantId,driverId,orderId,order){
 const subscriptions=await base.collection("drivers").doc(driverId).collection("pushSubscriptions").limit(30).get();
 if(subscriptions.empty){console.info("dishy_driver_push_no_subscription",{restaurantId,driverId,orderId});return}
 const number=String(order.number||orderId);
 const neighborhood=String(order.deliverySnapshot?.neighborhood||"Bairro não informado").trim();
 const tokens=subscriptions.docs.map(doc=>doc.data().token).filter(token=>typeof token==="string"&&token.length>50);
 if(!tokens.length)return;
 const result=await getMessaging().sendEachForMulticast({
  tokens,
  data:{kind:"driver",event:"DRIVER_ASSIGNED",restaurantId:String(restaurantId),orderId:String(orderId),number,title:"Nova entrega atribuída!",body:"Pedido #"+number+" • Bairro: "+neighborhood,icon:"https://dishy.com.br/dishy-icon.svg"},
  webpush:{headers:{Urgency:"high",TTL:"3600"}}
 });
 console.info("dishy_driver_push_result",{restaurantId,driverId,orderId,success:result.successCount,failure:result.failureCount,errors:result.responses.filter(x=>!x.success).map(x=>x.error?.code||"unknown")});
 await Promise.all(result.responses.map(async(response,i)=>{
  if(!response.success&&["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(response.error?.code))await subscriptions.docs[i].ref.delete();
 }));
}

function init(){if(getApps().length)return;initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})})}
export default async function handler(req,res){if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});try{init();const header=req.headers.authorization||"";if(!header.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});const user=await getAuth().verifyIdToken(header.slice(7),true),{restaurantId,orderId,driverId}=req.body||{};if(![restaurantId,orderId,driverId].every(x=>typeof x==="string"&&/^[\w-]{5,128}$/.test(x)))return res.status(400).json({error:"invalid_request"});const db=getFirestore(),base=db.collection("restaurants").doc(restaurantId),member=await base.collection("members").doc(user.uid).get();if(!member.exists||member.data().active!==true||!["owner","manager"].includes(member.data().role))return res.status(403).json({error:"forbidden"});if(req.body?.action==="MARK_PAID"){await db.runTransaction(async tx=>{const ref=base.collection("orders").doc(orderId),snap=await tx.get(ref);if(!snap.exists||snap.data().driverId!==driverId||snap.data().status!=="COMPLETED"||snap.data().driverPaidAt)throw new Error("not_payable");tx.update(ref,{driverPaidAt:FieldValue.serverTimestamp(),driverPaidBy:user.uid,updatedAt:FieldValue.serverTimestamp()})});return res.status(200).json({ok:true})}const driver=await base.collection("drivers").doc(driverId).get();if(!driver.exists||driver.data().active!==true||!driver.data().email)return res.status(409).json({error:"driver_inactive"});await db.runTransaction(async tx=>{const ref=base.collection("orders").doc(orderId),snap=await tx.get(ref);if(!snap.exists||snap.data().channel!=="DELIVERY"||snap.data().status!=="READY"||snap.data().driverId)throw new Error("not_available");tx.update(ref,{driverId,driverName:driver.data().name,driverFeeCents:driver.data().feeMode==="FREIGHT"&&Number(snap.data().deliveryFeeCents||0)>0?Number(snap.data().deliveryFeeCents):Number(driver.data().feeCents||0),driverFeeMode:driver.data().feeMode==="FREIGHT"?"FREIGHT":"FIXED",assignedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()})});try{const orderSnap=await base.collection("orders").doc(orderId).get();await notifyDriverAssigned(base,restaurantId,driverId,orderId,orderSnap.data()||{})}catch(notifyError){console.error("dishy_driver_push_failed",{restaurantId,driverId,orderId,error:notifyError?.code||notifyError?.message||"unknown"})}return res.status(200).json({ok:true})}catch(e){if(e.message==="not_payable")return res.status(409).json({error:"not_payable"});if(e.message==="not_available")return res.status(409).json({error:"not_available"});console.error("assign-driver",e);return res.status(500).json({error:"internal_error"})}}
