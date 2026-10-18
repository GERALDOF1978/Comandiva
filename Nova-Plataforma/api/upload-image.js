import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

function adminApp(){
  if(getApps().length)return getApps()[0];
  const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL,privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey)throw new Error("Firebase Admin não configurado");
  return initializeApp({credential:cert({projectId,clientEmail,privateKey})});
}
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
  try{
    adminApp();
    const h=req.headers.authorization||"";
    if(!h.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
    const user=await getAuth().verifyIdToken(h.slice(7),true);
    const {restaurantId,image}=req.body||{};
    if(typeof restaurantId!=="string"||!restaurantId)return res.status(400).json({error:"invalid_restaurant"});
    if(typeof image!=="string"||!image.startsWith("data:image/")||image.length>6_000_000)return res.status(400).json({error:"invalid_image"});
    const member=await getFirestore().doc(`restaurants/${restaurantId}/members/${user.uid}`).get();
    if(!member.exists||member.data().active!==true||!["owner","manager"].includes(member.data().role))return res.status(403).json({error:"forbidden"});
    const key=process.env.IMGBB_API_KEY;
    if(!key)throw new Error("IMGBB_API_KEY ausente");
    const base64=image.split(",")[1];
    const body=new URLSearchParams({key,image:base64});
    const r=await fetch("https://api.imgbb.com/1/upload",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const data=await r.json();
    if(!r.ok||!data?.success||!data?.data?.url)throw new Error("Falha ImgBB");
    return res.status(200).json({ok:true,url:data.data.url,thumbUrl:data.data.thumb?.url||data.data.url});
  }catch(e){console.error("upload-image",e);return res.status(500).json({error:"upload_failed"})}
}
