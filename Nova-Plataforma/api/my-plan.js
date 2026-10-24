import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";
function init(){if(getApps().length)return;initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})})}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"method_not_allowed"});
 try{
  init();const authHeader=req.headers.authorization||"";if(!authHeader.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
  const user=await getAuth().verifyIdToken(authHeader.slice(7),true);
  const restaurantId=String(req.query.restaurantId||"");if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
  const db=getFirestore();const access=await db.collection("userRestaurantAccess").doc(user.uid).collection("restaurants").doc(restaurantId).get();
  if(!access.exists||access.data().active!==true)return res.status(403).json({error:"access_denied"});
  const [subscription,restaurant]=await Promise.all([db.collection("subscriptions").doc(restaurantId).get(),db.collection("restaurants").doc(restaurantId).get()]);
  if(!restaurant.exists)return res.status(404).json({error:"restaurant_not_found"});
  let raw=subscription.exists?subscription.data():null;
  // Upgrade legacy 30-day trials once, preserving their original start date.
  if(raw?.planId==="trial"&&raw?.status==="trial"&&!raw.trialDurationDays&&raw.trialEndsAt?.toDate){
    const legacyEnd=raw.trialEndsAt.toDate();
    const start=raw.createdAt?.toDate?.()||raw.updatedAt?.toDate?.();
    if(start&&Math.abs((legacyEnd-start)/86400000-30)<2){
      const ref=db.collection("subscriptions").doc(restaurantId);
      await db.runTransaction(async tx=>{const fresh=await tx.get(ref);const current=fresh.data();if(current?.planId!=="trial"||current?.status!=="trial"||current?.trialDurationDays)return;const oldEnd=current.trialEndsAt?.toDate?.(),begin=current.createdAt?.toDate?.()||current.updatedAt?.toDate?.();if(!oldEnd||!begin||Math.abs((oldEnd-begin)/86400000-30)>=2)return;tx.update(ref,{trialEndsAt:new Date(begin.getTime()+180*86400000),trialDurationDays:180,updatedAt:FieldValue.serverTimestamp()})});
      const updated=await ref.get();raw=updated.data();
    }
  }
  const planId=raw?.planId||restaurant.data().planId||"trial";
  const plan=planId!=="trial"?await db.collection("plans").doc(planId).get():null;
  function iso(v){return v?.toDate?.()?.toISOString?.()|| (v instanceof Date?v.toISOString():typeof v==="string"?v:null)}
  res.setHeader("Cache-Control","private, no-store");
  return res.status(200).json({subscription:{planId,status:raw?.status||"unknown",trialEndsAt:iso(raw?.trialEndsAt),updatedAt:iso(raw?.updatedAt)},plan:plan?.exists?{name:plan.data().name,priceCents:plan.data().priceCents,active:plan.data().active}:null});
 }catch(e){console.error("my-plan",e);return res.status(500).json({error:"internal_error"})}
}
