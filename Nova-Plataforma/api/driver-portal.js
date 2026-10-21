import {createHash,timingSafeEqual} from "node:crypto";
import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";
function init(){if(getApps().length)return;initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})})}
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 try{
  init();const header=req.headers.authorization||"";if(!header.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
  const user=await getAuth().verifyIdToken(header.slice(7),true);
  if(!user.email||!user.email_verified)return res.status(403).json({error:"verified_email_required"});
  const restaurantId=String(req.method==="GET"?req.query.restaurantId:req.body?.restaurantId||"").trim();
  if(!/^[\w-]{5,128}$/.test(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
  const db=getFirestore(),restaurant=db.collection("restaurants").doc(restaurantId);
  const matches=await restaurant.collection("drivers").where("email","==",user.email.toLowerCase()).limit(2).get();
  if(matches.empty||matches.docs[0].data().active!==true)return res.status(403).json({error:"driver_not_authorized"});
  const driver=matches.docs[0],orders=restaurant.collection("orders");
  if(req.method==="GET"){
   const snap=await orders.where("driverId","==",driver.id).limit(100).get();
   return res.status(200).json({driver:{id:driver.id,name:driver.data().name,vehicle:driver.data().vehicle},orders:snap.docs.map(d=>{const o=d.data();return {id:d.id,number:o.number||d.id,status:o.status,customerName:o.customerSnapshot?.name||"",customerPhone:o.customerSnapshot?.phone||"",address:o.deliverySnapshot?.address||"",numberAddress:o.deliverySnapshot?.number||"",complement:o.deliverySnapshot?.complement||"",neighborhood:o.deliverySnapshot?.neighborhood||"",city:o.deliverySnapshot?.city||"",state:o.deliverySnapshot?.state||"",cep:o.deliverySnapshot?.cep||"",totalCents:o.totalCents||0,paymentMethod:o.paymentMethod||"",paymentStatus:o.paymentStatus||"PENDING",changeForCents:o.changeForCents??null,deliveryPinRequired:!!o.deliveryPinHash,driverFeeCents:o.driverFeeCents||0,driverPaidAt:o.driverPaidAt?.toDate?.()?.toISOString()||null,deliveryFeeCents:o.deliveryFeeCents||0,completedAt:o.statusTimestamps?.COMPLETED?.toDate?.()?.toISOString()||null}})});
  }
  const orderId=String(req.body?.orderId||""),status=String(req.body?.status||""),action=String(req.body?.action||""),pin=String(req.body?.pin||"");
  if(!/^[\w-]{5,128}$/.test(orderId)||!(["OUT_FOR_DELIVERY","COMPLETED"].includes(status)||action==="CONFIRM_PAYMENT"))return res.status(400).json({error:"invalid_request"});
  const outcome=await db.runTransaction(async tx=>{const ref=orders.doc(orderId),snap=await tx.get(ref);if(!snap.exists||snap.data().driverId!==driver.id||snap.data().channel!=="DELIVERY")throw new Error("not_assigned");const o=snap.data(),old=o.status;
   if(action==="CONFIRM_PAYMENT"){if(old!=="OUT_FOR_DELIVERY"||!["CASH","CARD_ON_DELIVERY"].includes(o.paymentMethod)||o.paymentStatus==="PAID")throw new Error("invalid_transition");tx.update(ref,{paymentStatus:"PAID",paymentReceivedByDriverId:driver.id,paymentReceivedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return}
   if(!(old==="READY"&&status==="OUT_FOR_DELIVERY"||old==="OUT_FOR_DELIVERY"&&status==="COMPLETED"))throw new Error("invalid_transition");
   if(status==="COMPLETED"&&o.deliveryPinHash){if((o.deliveryPinAttempts||0)>=5)throw new Error("pin_locked");if(!/^\d{4}$/.test(pin)){tx.update(ref,{deliveryPinAttempts:FieldValue.increment(1)});return "invalid_pin"}const expected=Buffer.from(o.deliveryPinHash,"hex"),actual=Buffer.from(createHash("sha256").update(o.deliveryPinSalt+":"+pin).digest("hex"),"hex");if(expected.length!==actual.length||!timingSafeEqual(expected,actual)){tx.update(ref,{deliveryPinAttempts:FieldValue.increment(1)});return "invalid_pin"}}
   if(status==="COMPLETED"&&["CASH","CARD_ON_DELIVERY"].includes(o.paymentMethod)&&o.paymentStatus!=="PAID")throw new Error("payment_not_confirmed");
   tx.update(ref,{status,updatedAt:FieldValue.serverTimestamp(),...(status==="COMPLETED"?{deliveryConfirmedAt:FieldValue.serverTimestamp(),deliveryPinHash:FieldValue.delete(),deliveryPinSalt:FieldValue.delete()}:{}),[`statusTimestamps.${status}`]:FieldValue.serverTimestamp()})});
  if(outcome==="invalid_pin")return res.status(409).json({error:"invalid_pin"});
  return res.status(200).json({ok:true});
 }catch(e){if(["not_assigned","invalid_transition","invalid_pin","pin_locked","payment_not_confirmed"].includes(e.message))return res.status(409).json({error:e.message});console.error("driver-portal",e);return res.status(500).json({error:"internal_error"})}
}