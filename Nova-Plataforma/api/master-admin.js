import {getApps,initializeApp,cert} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
 try{
  if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})});
  const header=req.headers.authorization||"";
  if(!header.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
  const user=await getAuth().verifyIdToken(header.slice(7),true),db=getFirestore();
  const admin=await db.collection("platformAdmins").doc(user.uid).get();
  if(admin.data()?.active!==true)return res.status(403).json({error:"forbidden"});
  const {action,restaurantId,status}=req.body||{};
  if(action!=="setRestaurantStatus"||typeof restaurantId!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(restaurantId)||!["active","suspended"].includes(status))return res.status(400).json({error:"invalid_request"});
  const ref=db.collection("restaurants").doc(restaurantId),snap=await ref.get();
  if(!snap.exists)return res.status(404).json({error:"not_found"});
  const batch=db.batch();
  batch.update(ref,{status,updatedAt:FieldValue.serverTimestamp()});
  const slug=snap.data().slug;
  if(typeof slug==="string"&&/^[a-z0-9-]{1,80}$/.test(slug))batch.set(db.collection("restaurantSlugs").doc(slug),{active:status==="active"},{merge:true});
  batch.create(ref.collection("audit").doc(),{action:"MASTER_SET_STATUS",status,actorUid:user.uid,createdAt:FieldValue.serverTimestamp()});
  await batch.commit();
  return res.status(200).json({ok:true});
 }catch(e){console.error("master-admin",e);return res.status(500).json({error:"internal_error"})}
}
