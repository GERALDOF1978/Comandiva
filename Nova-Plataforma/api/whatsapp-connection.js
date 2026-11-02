import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";

function init(){
 if(getApps().length)return;
 const {FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY}=process.env;
 if(!FIREBASE_PROJECT_ID||!FIREBASE_CLIENT_EMAIL||!FIREBASE_PRIVATE_KEY)throw Error("firebase_unavailable");
 initializeApp({credential:cert({projectId:FIREBASE_PROJECT_ID,clientEmail:FIREBASE_CLIENT_EMAIL,privateKey:FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n")})});
}
const safeId=value=>/^[A-Za-z0-9_-]{5,128}$/.test(value);
function evolutionConfig(){
 const raw=String(process.env.EVOLUTION_API_URL||"").trim(),apiKey=String(process.env.EVOLUTION_API_KEY||"").trim();
 if(!raw||!apiKey)return null;
 let url;
 try{url=new URL(raw)}catch{return null}
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)return null;
 return {base:url.toString().replace(/\/+$/,""),apiKey};
}
async function evolution(config,method,pathname,body){
 const response=await fetch(config.base+pathname,{method,headers:{apikey:config.apiKey,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 const data=await response.json().catch(()=>({}));
 return {status:response.status,ok:response.ok,data};
}
const normalizeQr=data=>{
 const q=data?.qrcode||data||{};
 const value=String(q?.base64||data?.base64||"");
 const code=String(q?.code||data?.code||"");
 return {
  image:value&&value.length<1500000&&(value.startsWith("data:image/png;base64,")||/^[A-Za-z0-9+/=\r\n]+$/.test(value))?(value.startsWith("data:")?value:"data:image/png;base64,"+value):null,
  code:code.length<2000?code:null,
  pairingCode:String(data?.pairingCode||q?.pairingCode||data?.codePairing||"").slice(0,32)||null
 };
};
const getState=x=>String(x?.instance?.state||x?.state||x?.instance?.status||"close").toLowerCase();
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 try{
  init();
  const header=String(req.headers.authorization||"");
  if(!header.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
  const user=await getAuth().verifyIdToken(header.slice(7),true);
  const restaurantId=String(req.method==="GET"?req.query?.restaurantId:req.body?.restaurantId||"");
  if(!safeId(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
  const base=getFirestore().collection("restaurants").doc(restaurantId);
  const [restaurant,member]=await Promise.all([base.get(),base.collection("members").doc(user.uid).get()]);
  if(!restaurant.exists)return res.status(404).json({error:"restaurant_not_found"});
  if(restaurant.data().ownerUid!==user.uid&&!(member.exists&&member.data().active===true&&member.data().role==="owner"))return res.status(403).json({error:"owner_only"});
  const config=evolutionConfig();
  if(!config)return res.status(503).json({error:"evolution_not_configured",configured:false});
  const previous=String(restaurant.data().whatsappInstance||"");
  const instance=/^[a-zA-Z0-9_-]{1,80}$/.test(previous)?previous:"dishy"+restaurantId.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,50);
  const path=encodeURIComponent(instance);
  const action=req.method==="GET"?"status":String(req.body?.action||"");
  if(!["status","connect","pair"].includes(action))return res.status(400).json({error:"invalid_action"});
  const probe=await evolution(config,"GET","/instance/connectionState/"+path);
  if(probe.ok&&getState(probe.data)==="open"){
   if(previous!==instance)await base.update({whatsappInstance:instance,whatsappConnectedAt:FieldValue.serverTimestamp()});
   return res.status(200).json({configured:true,connected:true,state:"open",instance});
  }
  if(action==="status")return res.status(200).json({configured:true,connected:false,state:probe.ok?getState(probe.data):"close",instance});
  const phone=String(req.body?.phone||"").replace(/\D/g,"");
  if(action==="pair"&&!/^55\d{10,11}$/.test(phone))return res.status(400).json({error:"invalid_phone"});
  let created=null;
  if(probe.status===404){
   const creation=await evolution(config,"POST","/instance/create",{instanceName:instance,integration:"WHATSAPP-BAILEYS",qrcode:true});
   if(!creation.ok&&creation.status!==409)return res.status(502).json({error:"evolution_create_failed"});
   if(creation.ok)created=creation.data;
  }else if(!probe.ok&&probe.status!==404){
   return res.status(502).json({error:"evolution_connection_unavailable"});
  }
  const endpoint="/instance/connect/"+path+(action==="pair"?"?number="+encodeURIComponent(phone):"");
  const response=await evolution(config,"GET",endpoint);
  if(!response.ok&&created===null)return res.status(502).json({error:"evolution_connect_failed"});
  const result=response.ok?response.data:created,qr=normalizeQr(result);
  if(!qr.image&&!qr.code&&created){
   const backup=normalizeQr(created);qr.image=backup.image;qr.code=backup.code;qr.pairingCode=qr.pairingCode||backup.pairingCode;
  }
  return res.status(200).json({configured:true,connected:false,state:"connecting",instance,qrImage:action==="connect"?qr.image:null,qrCode:action==="connect"?qr.code:null,pairingCode:action==="pair"?qr.pairingCode:null});
 }catch(e){
  console.error("dishy_whatsapp_connection",e?.name||"error");
  return res.status(503).json({error:"whatsapp_connection_unavailable"});
 }
}
