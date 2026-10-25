import {startTabPix} from "./tab-pix.js";
import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
function init(){if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})})}
const clean=x=>String(x||"").trim();
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 try{init();const input=req.method==="GET"?req.query:req.body||{},slug=clean(input.slug),tabId=clean(input.tabId),access=clean(input.access);
 if(!/^[\w-]{2,128}$/.test(slug)||!/^[\w-]{3,130}$/.test(tabId)||!/^[a-f0-9]{48}$/.test(access))return res.status(400).json({error:"invalid_link"});
 const db=getFirestore(),mapping=await db.collection("restaurantSlugs").doc(slug).get();if(!mapping.exists||mapping.data().active===false)return res.status(404).json({error:"not_found"});
 const base=db.collection("restaurants").doc(mapping.data().restaurantId),ref=base.collection("tabs").doc(tabId),tab=await ref.get();
 if(!tab.exists||tab.data().customerAccessToken!==access)return res.status(403).json({error:"invalid_tab_link"});
 if(req.method==="GET"){const d=tab.data();const ordersSnap=await base.collection("orders").where("tabId","==",tabId).limit(200).get();const orders=ordersSnap.docs.filter(o=>o.data().channel==="TABLE"&&o.data().status!=="CANCELLED"&&!o.id.startsWith("tabpayment_")).map(o=>({id:o.id,number:o.data().number,status:o.data().status,items:(o.data().items||[]).map(i=>({name:i.name,qty:i.qty,priceCents:i.priceCents,totalCents:i.totalCents})),createdAt:o.data().createdAt?.toDate?.()?.toISOString()||null})).sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||""));return res.status(200).json({tab:{label:d.label,type:d.type,status:d.status,totalCents:Number(d.totalCents||0),pixPayment:d.pixPayment||null,orders}})}
 const action=clean(input.action);
 if(action==="ORDER"){
 const name=clean(input.name).slice(0,90),phone=clean(input.phone).replace(/\D/g,"").slice(0,15),items=input.items;
 if(name.length<2||phone.length<10||!Array.isArray(items)||!items.length||items.length>30)return res.status(400).json({error:"invalid_order"});
 const ids=items.map(x=>clean(x.productId));if(ids.some(x=>!/^[\w-]{5,128}$/.test(x)))return res.status(400).json({error:"invalid_items"});
 const productSnaps=await Promise.all(ids.map(id=>base.collection("products").doc(id).get()));
 const lines=[];for(let i=0;i<items.length;i++){const p=productSnaps[i],qty=Number(items[i].qty);if(!p.exists||p.data().active===false||p.data().sellAtTable===false||!Number.isInteger(qty)||qty<1||qty>30||!Number.isInteger(p.data().priceCents)||p.data().priceCents<0)return res.status(400).json({error:"invalid_item"});lines.push({productId:ids[i],name:clean(p.data().name),qty,priceCents:p.data().priceCents,totalCents:qty*p.data().priceCents})}
 const sum=lines.reduce((n,x)=>n+x.totalCents,0),orderRef=base.collection("orders").doc();
 await db.runTransaction(async tx=>{const current=await tx.get(ref);if(!current.exists||current.data().customerAccessToken!==access||current.data().status!=="OPEN")throw new Error("not_open");const d=current.data();tx.set(orderRef,{channel:"TABLE",table:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label,tabId,number:"M"+orderRef.id.slice(0,6).toUpperCase(),customerSnapshot:{name,phone},items:lines,totalCents:0,status:"RECEIVED",paymentStatus:"PENDING",paymentMethod:"CASH",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});tx.update(ref,{items:[...(d.items||[]),...lines.map(x=>({...x,addedAt:new Date().toISOString()}))],totalCents:Number(d.totalCents||0)+sum,customerPhones:[...new Set([...(d.customerPhones||[]),phone])],updatedAt:FieldValue.serverTimestamp()})});
 return res.status(200).json({ok:true,orderId:orderRef.id});
 }
 if(action==="CALL_WAITER"){
 const reason=clean(input.reason).slice(0,100);
 if(!["Chamar atendente","Pedir talheres","Pedir guardanapos","Solicitar ajuda"].includes(reason))return res.status(400).json({error:"invalid_reason"});
 const callRef=base.collection("serviceCalls").doc();
 await db.runTransaction(async tx=>{const current=await tx.get(ref);if(!current.exists||current.data().customerAccessToken!==access||current.data().status!=="OPEN")throw new Error("not_open");const d=current.data();tx.set(callRef,{tabId,table:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label,reason,status:"PENDING",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()})});
 return res.status(200).json({ok:true});
 }
 if(action==="CREATE_PIX"){const phone=clean(input.phone).replace(/\D/g,"");if(phone.length<10||!(tab.data().customerPhones||[]).includes(phone))return res.status(403).json({error:"phone_not_found"});try{return res.status(200).json({ok:true,payment:await startTabPix(base,ref,mapping.data().restaurantId)})}catch(e){return res.status(409).json({error:e.message})}}
 if(action==="REQUEST_BILL"){
 const phone=clean(input.phone).replace(/\D/g,"");if(phone.length<10)return res.status(400).json({error:"invalid_phone"});
 await db.runTransaction(async tx=>{const current=await tx.get(ref);if(!current.exists||current.data().customerAccessToken!==access||current.data().status!=="OPEN")throw new Error("not_open");if(!(current.data().customerPhones||[]).includes(phone))throw new Error("phone_not_found");tx.update(ref,{status:"BILL_REQUESTED",requestedPaymentMethod:["CASH","CARD_ON_DELIVERY"].includes(input.paymentMethod)?input.paymentMethod:null,updatedAt:FieldValue.serverTimestamp()})});
 return res.status(200).json({ok:true});
 }
 return res.status(400).json({error:"invalid_action"});
 }catch(e){if(e.message==="not_open")return res.status(409).json({error:"not_open"});if(e.message==="phone_not_found")return res.status(403).json({error:"phone_not_found"});console.error("public-tab",e);return res.status(500).json({error:"internal_error"})}
}