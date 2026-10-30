import {createHash} from "node:crypto";
import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";
function init(){if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})})}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
 try{
  init();const h=req.headers.authorization||"";if(!h.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
  const user=await getAuth().verifyIdToken(h.slice(7),true);
  const {restaurantId,orderId,token}=req.body||{};
  if(!/^[\w-]{5,128}$/.test(String(restaurantId||""))||typeof orderId!=="string"||orderId.length>128||typeof token!=="string"||token.length<50||token.length>4096)return res.status(400).json({error:"invalid_request"});
  const db=getFirestore(),restaurant=await db.collection("restaurants").doc(restaurantId).get();
  if(!restaurant.exists)return res.status(404).json({error:"not_found"});
  const order=await db.collection("restaurants").doc(restaurantId).collection("orders").doc(orderId).get();
  if(!order.exists||order.data().customerUid!==user.uid)return res.status(403).json({error:"not_order_owner"});
  const id=createHash("sha256").update(token).digest("hex");
  await db.collection("restaurants").doc(restaurantId).collection("pushSubscriptions").doc(id).set({token,uid:user.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return res.status(200).json({ok:true});
 }catch(e){console.error("customer-push",e);return res.status(500).json({error:"internal_error"})}
}
