import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
import {DISHY_CONTRACT_VERSION,createSubscriptionContractText,contractHash,cleanContractContact} from "./_subscription-contract.js";
import {normalizePlanModules} from "../src/lib/planModules.js";

function admin(){
 if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})});
}
function issuer(){
 return {issuerName:process.env.DISHY_CONTRACT_ISSUER_NAME||"",issuerDocument:process.env.DISHY_CONTRACT_ISSUER_DOCUMENT||"",issuerAddress:process.env.DISHY_CONTRACT_ISSUER_ADDRESS||"",issuerEmail:process.env.DISHY_CONTRACT_ISSUER_EMAIL||""};
}
function signingReady(v){
 return process.env.DISHY_CONTRACT_ENABLED==="true"&&process.env.DISHY_CONTRACT_LEGAL_REVIEWED==="true"
 &&Object.values(v).every(x=>typeof x==="string"&&x.trim().length>=5)
 &&/^https:\/\//.test(process.env.N8N_CONTRACT_WEBHOOK_URL||"")
 &&String(process.env.N8N_CONTRACT_WEBHOOK_TOKEN||"").length>=20;
}
const idPattern=/^[a-zA-Z0-9_-]{5,128}$/;
export default async function handler(req,res){
 res.setHeader("Cache-Control","private, no-store");
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 try{
  admin();
  const token=String(req.headers.authorization||"");
  if(!token.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
  const user=await getAuth().verifyIdToken(token.slice(7),true);
  if(user.email_verified!==true||!user.email)return res.status(403).json({error:"email_not_verified"});
  const db=getFirestore(),rid=String(req.method==="GET"?req.query?.restaurantId||"":req.body?.restaurantId||""),planId=String(req.method==="GET"?req.query?.planId||"":req.body?.planId||"");
  if(!idPattern.test(rid)||!idPattern.test(planId)||planId==="trial")return res.status(400).json({error:"invalid_plan_or_restaurant"});
  const rsRef=db.collection("restaurants").doc(rid);
  const [rs,member,linked,planDoc]=await Promise.all([rsRef.get(),rsRef.collection("members").doc(user.uid).get(),db.collection("userRestaurantAccess").doc(user.uid).collection("restaurants").doc(rid).get(),db.collection("plans").doc(planId).get()]);
  if(!rs.exists||!planDoc.exists||planDoc.data()?.active!==true)return res.status(404).json({error:"not_found"});
  if(!member.exists||member.data()?.role!=="owner"||member.data()?.active!==true||!linked.exists||linked.data()?.active!==true)return res.status(403).json({error:"owner_only"});
  const plan={name:planDoc.data().name||planId,priceCents:planDoc.data().priceCents,modules:normalizePlanModules(planDoc.data().modules)};
  if(!Number.isSafeInteger(plan.priceCents)||plan.priceCents<0)return res.status(409).json({error:"invalid_plan_price"});
  const provider=issuer(),ready=signingReady(provider);
  const previewIssuer=ready?provider:{issuerName:"[PRESTADOR RESPONSÁVEL A INFORMAR]",issuerDocument:"[DOCUMENTO DO PRESTADOR]",issuerAddress:"[ENDEREÇO]",issuerEmail:"[E-MAIL]"};
  if(req.method==="GET"){
   const customer={name:String(rs.data().name||"Contratante"),document:"[CPF/CNPJ DO CONTRATANTE]",email:user.email};
   const text=createSubscriptionContractText({issuer:previewIssuer,customer,restaurant:{name:rs.data().name||"Estabelecimento"},plan,acceptedAt:Date.now()});
   return res.status(200).json({ready,version:DISHY_CONTRACT_VERSION,planId,name:plan.name,priceCents:plan.priceCents,text,reason:ready?null:"O fornecedor legal, a revisão do contrato e o webhook n8n precisam estar configurados antes do aceite.",channels:["email","whatsapp"]});
  }
  if(req.body?.action!=="accept"||req.body?.contractVersion!==DISHY_CONTRACT_VERSION||req.body?.acceptedTerms!==true||req.body?.authorizedWhatsApp!==true)return res.status(400).json({error:"acceptance_required"});
  if(!ready)return res.status(409).json({error:"contract_not_ready"});
  const name=String(req.body.customerName||"").trim().slice(0,120),document=String(req.body.customerDocument||"").replace(/\D/g,""),phone=cleanContractContact(req.body.whatsapp);
  const national=phone.startsWith("55")&&phone.length>=12?phone.slice(2):phone;
  if(name.length<5||![11,14].includes(document.length)||![10,11].includes(national.length))return res.status(400).json({error:"invalid_customer_identity"});
  const now=new Date(),text=createSubscriptionContractText({issuer:provider,customer:{name,document,email:user.email},restaurant:{name:rs.data().name||"Estabelecimento"},plan,acceptedAt:now.toISOString()});
  const sha256=contractHash(text);
  const contractId=contractHash([rid,user.uid,planId,document,DISHY_CONTRACT_VERSION,plan.priceCents,contractHash(JSON.stringify(plan.modules))].join("|")).slice(0,40);
  const ref=db.collection("subscriptionContracts").doc(contractId),outbox=db.collection("contractDeliveryOutbox").doc(contractId);
  let newContract=false;
  await db.runTransaction(async tx=>{
   const existing=await tx.get(ref);
   if(existing.exists)return;
   newContract=true;
   tx.create(ref,{restaurantId:rid,actorUid:user.uid,planId,planName:plan.name,priceCents:plan.priceCents,modules:plan.modules,customer:{name,document,email:user.email,whatsapp:phone},issuer:provider,version:DISHY_CONTRACT_VERSION,contractText:text,sha256,acceptedAt:FieldValue.serverTimestamp(),state:"accepted_awaiting_payment",deliveryStatus:"queued"});
   tx.create(outbox,{contractId,restaurantId:rid,status:"queued",eventType:"CONTRACT_ACCEPTED",toEmail:user.email,toWhatsApp:phone,sha256,contractText:text,createdAt:FieldValue.serverTimestamp()});
  });
  if(!newContract)return res.status(200).json({ok:true,alreadyAccepted:true,contractId,deliveryStatus:"not_resent"});
  let handoff=false;
  try{
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
   try{
    const reply=await fetch(process.env.N8N_CONTRACT_WEBHOOK_URL,{method:"POST",signal:ctrl.signal,headers:{"Content-Type":"application/json","X-Dishy-Contract-Key":process.env.N8N_CONTRACT_WEBHOOK_TOKEN},body:JSON.stringify({eventType:"CONTRACT_ACCEPTED",eventId:contractId,restaurantId:rid,planId,planName:plan.name,toEmail:user.email,toWhatsApp:phone,contractVersion:DISHY_CONTRACT_VERSION,sha256,contractText:text,contractPortalUrl:"https://dishy.com.br/login"})});
    handoff=reply.ok;
   }finally{clearTimeout(timer)}
  }catch{/* permanece na fila; a equipe verificará o envio */}
  const status=handoff?"handed_off_to_n8n":"queued";
  await Promise.allSettled([ref.update({deliveryStatus:status,deliveryUpdatedAt:FieldValue.serverTimestamp()}),outbox.update({status,deliveryUpdatedAt:FieldValue.serverTimestamp()})]);
  return res.status(201).json({ok:true,contractId,sha256,deliveryStatus:status,subscriptionChanged:false,paymentMade:false});
 }catch(err){return res.status(500).json({error:"contract_processing_failed"});}
}
