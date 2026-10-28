import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";
function init(){if(getApps().length)return;const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL,privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");if(!projectId||!clientEmail||!privateKey)throw new Error("firebase_not_configured");initializeApp({credential:cert({projectId,clientEmail,privateKey})})}
export default async function handler(req,res){
 if(!["GET","POST","PATCH"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 try{
  init();const header=req.headers.authorization||"";if(!header.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
  const user=await getAuth().verifyIdToken(header.slice(7),true);
  const restaurantId=String(req.method==="GET"?req.query.restaurantId:req.body?.restaurantId||"").trim();
  if(!restaurantId)return res.status(400).json({error:"restaurant_required"});
  const db=getFirestore(),member=await db.collection("restaurants").doc(restaurantId).collection("members").doc(user.uid).get();
  if(!member.exists||member.data().active!==true||!["owner","manager"].includes(member.data().role))return res.status(403).json({error:"forbidden"});
  const drivers=db.collection("restaurants").doc(restaurantId).collection("drivers");
  if(req.method==="GET"){const snap=await drivers.limit(200).get();return res.status(200).json({drivers:snap.docs.map(d=>({id:d.id,...d.data(),createdAt:undefined,updatedAt:undefined}))})}
  if(req.method==="POST"){
   const name=String(req.body?.name||"").trim(),phone=String(req.body?.phone||"").replace(/\D/g,""),vehicle=String(req.body?.vehicle||"MOTO").toUpperCase(),feeCents=Number(req.body?.feeCents??0),feeMode=String(req.body?.feeMode||"FIXED"),email=String(req.body?.email||"").trim().toLowerCase();
   if(name.length<2||name.length>100||phone.length<10||phone.length>13||!["MOTO","BIKE","CARRO"].includes(vehicle)||!/^\S+@\S+\.\S+$/.test(email)||!Number.isInteger(feeCents)||feeCents<0||feeCents>100000||!["FIXED","FREIGHT"].includes(feeMode))return res.status(400).json({error:"invalid_driver"});
   const duplicate=await drivers.where("email","==",email).limit(1).get();if(!duplicate.empty)return res.status(409).json({error:"email_already_registered"});const doc=await drivers.add({name,phone,vehicle,email,feeCents,feeMode,active:true,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
   return res.status(201).json({ok:true,id:doc.id});
  }
  const id=String(req.body?.driverId||"");if(!/^[a-zA-Z0-9_-]{10,100}$/.test(id))return res.status(400).json({error:"invalid_driver_id"});
  const ref=drivers.doc(id),existing=await ref.get();if(!existing.exists)return res.status(404).json({error:"not_found"});
  const patch={updatedAt:FieldValue.serverTimestamp()};
  if(req.body?.active!==undefined){if(typeof req.body.active!=="boolean")return res.status(400).json({error:"invalid_active"});patch.active=req.body.active}
  if(req.body?.name!==undefined){const name=String(req.body.name).trim();if(name.length<2||name.length>100)return res.status(400).json({error:"invalid_name"});patch.name=name}
  if(req.body?.phone!==undefined){const phone=String(req.body.phone).replace(/\D/g,"");if(phone.length<10||phone.length>13)return res.status(400).json({error:"invalid_phone"});patch.phone=phone}
  if(req.body?.vehicle!==undefined){const vehicle=String(req.body.vehicle).toUpperCase();if(!["MOTO","BIKE","CARRO"].includes(vehicle))return res.status(400).json({error:"invalid_vehicle"});patch.vehicle=vehicle}
  if(req.body?.email!==undefined){const email=String(req.body.email).trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:"invalid_email"});if(email!==existing.data().email){const duplicate=await drivers.where("email","==",email).limit(1).get();if(!duplicate.empty&&duplicate.docs.some(d=>d.id!==id))return res.status(409).json({error:"email_already_registered"});patch.email=email}}
  if(req.body?.feeCents!==undefined){const feeCents=req.body.feeCents;if(!Number.isInteger(feeCents)||feeCents<0||feeCents>100000)return res.status(400).json({error:"invalid_fee"});patch.feeCents=feeCents}
  if(req.body?.feeMode!==undefined){if(!["FIXED","FREIGHT"].includes(req.body.feeMode))return res.status(400).json({error:"invalid_fee_mode"});patch.feeMode=req.body.feeMode}
  if(Object.keys(patch).length===1)return res.status(400).json({error:"empty_update"});
  await ref.update(patch);return res.status(200).json({ok:true});
 }catch(e){console.error("drivers",e);return res.status(500).json({error:"internal_error"})}
}