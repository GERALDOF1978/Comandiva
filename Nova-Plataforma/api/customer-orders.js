import {createHash} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
function init(){if(getApps().length)return;const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL,privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");if(!projectId||!clientEmail||!privateKey)throw new Error("firebase_admin_not_configured");initializeApp({credential:cert({projectId,clientEmail,privateKey})})}
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 if(req.method==="POST"){
  try{
   init();const h=String(req.headers.authorization||"").replace(/^Bearer\\s+/i,"");
   if(!h)return res.status(401).json({error:"unauthorized"});
   const user=await getAuth().verifyIdToken(h,true);
   const {restaurantId,orderId,token}=req.body||{};
   if(!/^[\w-]{5,128}$/.test(String(restaurantId||""))||!/^[\w-]{5,128}$/.test(String(orderId||""))||typeof token!=="string"||token.length<50||token.length>4096)return res.status(400).json({error:"invalid_request"});
   const db=getFirestore(),restaurant=db.collection("restaurants").doc(restaurantId);
   const order=await restaurant.collection("orders").doc(orderId).get();
   if(!order.exists||order.data().customerUid!==user.uid)return res.status(403).json({error:"not_order_owner"});
   const id=createHash("sha256").update(token).digest("hex");
   await restaurant.collection("pushSubscriptions").doc(id).set({token,uid:user.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});
   return res.status(200).json({ok:true});
  }catch(e){console.error("customer-orders-push",e);return res.status(500).json({error:"internal_error"})}
 }

 res.setHeader("Cache-Control","no-store");
 try{
  init();
  const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return res.status(401).json({error:"login_required"});
  const {uid}=await getAuth().verifyIdToken(token);
  const slug=String(req.query.slug||"").trim();
  if(!/^[a-z0-9-]{1,90}$/.test(slug))return res.status(400).json({error:"invalid_slug"});
  const db=getFirestore(),map=await db.collection("restaurantSlugs").doc(slug).get();
  if(!map.exists)return res.status(404).json({error:"restaurant_not_found"});
  const restaurantId=map.data().restaurantId;
  const snap=await db.collection("restaurants").doc(restaurantId).collection("orders").where("customerUid","==",uid).limit(100).get();
  const orders=snap.docs.map(d=>{const x=d.data();return {id:d.id,number:x.number,status:x.status,channel:x.channel,paymentStatus:x.paymentStatus,totalCents:x.totalCents,items:(x.items||[]).map(i=>({name:i.name,qty:i.qty,totalCents:i.totalCents})),createdAt:x.createdAt?.toDate?.()?.toISOString()||null}}).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  return res.status(200).json({orders});
 }catch(e){console.error("customer-orders",e);return res.status(e.code?.startsWith?.("auth/")?401:500).json({error:"orders_unavailable"})}
}
