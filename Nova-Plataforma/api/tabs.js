import {randomBytes} from "node:crypto";
import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";
function init(){if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})})}
export default async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 try{
 init();const header=req.headers.authorization||"";if(!header.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
 const user=await getAuth().verifyIdToken(header.slice(7),true),body=req.body||{},restaurantId=String(req.method==="GET"?req.query.restaurantId:body.restaurantId||"");
 if(!/^[\w-]{5,128}$/.test(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
 const db=getFirestore(),base=db.collection("restaurants").doc(restaurantId),member=await base.collection("members").doc(user.uid).get();
 if(!member.exists||member.data().active!==true||!["owner","manager"].includes(member.data().role))return res.status(403).json({error:"forbidden"});
 const tabs=base.collection("tabs");
 if(req.method==="GET"){const snap=await tabs.limit(300).get();return res.status(200).json({tabs:snap.docs.map(d=>({id:d.id,...d.data(),createdAt:d.data().createdAt?.toDate?.()?.toISOString()||null,updatedAt:d.data().updatedAt?.toDate?.()?.toISOString()||null}))})}
 const action=String(body.action||""),id=String(body.tabId||"");
 if(action==="OPEN"){
 const type=body.type==="TABLE"?"TABLE":body.type==="INDIVIDUAL"?"INDIVIDUAL":null,label=String(body.label||"").trim().slice(0,70);
 if(!type||!label)return res.status(400).json({error:"invalid_tab"});
 const ref=tabs.doc(type+"_"+label.toLowerCase().replace(/[^a-z0-9]/g,"_"));
 await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists&&snap.data().status!=="CLOSED")throw new Error("already_open");tx.set(ref,{type,label,status:"OPEN",items:[],totalCents:0,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),createdBy:user.uid,customerAccessToken:snap.exists&&snap.data().customerAccessToken||randomBytes(24).toString("hex")})});
 return res.status(200).json({ok:true,id:ref.id});
 }
 if(!/^[\w-]{3,130}$/.test(id))return res.status(400).json({error:"invalid_tab"});
 const ref=tabs.doc(id);
 if(action==="QR_TOKEN"){const snap=await ref.get();if(!snap.exists)return res.status(404).json({error:"not_found"});if(!snap.data().customerAccessToken)await ref.update({customerAccessToken:randomBytes(24).toString("hex")});return res.status(200).json({ok:true})}
 if(action==="ADD"){
 const productId=String(body.productId||""),qty=Number(body.qty||1);
 if(!/^[\w-]{5,128}$/.test(productId)||!Number.isInteger(qty)||qty<1||qty>50)return res.status(400).json({error:"invalid_item"});
 const product=await base.collection("products").doc(productId).get();
 if(!product.exists||product.data().active===false)return res.status(404).json({error:"product_unavailable"});
 const p=product.data(),price=Number(p.priceCents);
 if(!Number.isInteger(price)||price<0)return res.status(400).json({error:"invalid_price"});
 await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists||snap.data().status!=="OPEN")throw new Error("not_open");const data=snap.data();const kitchenRef=base.collection("orders").doc();tx.set(kitchenRef,{channel:"TABLE",table:(data.type==="TABLE"?"Mesa ":"Comanda ")+data.label,tabId:id,number:"M"+kitchenRef.id.slice(0,6).toUpperCase(),customerSnapshot:{name:(data.type==="TABLE"?"Mesa ":"Comanda ")+data.label},items:[{productId,name:String(p.name||"Produto"),qty,unitPriceCents:price,priceCents:price,totalCents:qty*price}],totalCents:0,status:"RECEIVED",paymentStatus:"PENDING",paymentMethod:"CASH",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});tx.update(ref,{items:[...(data.items||[]),{productId,name:String(p.name||"Produto"),qty,priceCents:price,addedAt:new Date().toISOString()}],totalCents:Number(data.totalCents||0)+qty*price,updatedAt:FieldValue.serverTimestamp()})});
 return res.status(200).json({ok:true});
 }
 if(action==="REQUEST_BILL"||action==="REOPEN"||action==="CLOSE"){
 if(action==="CLOSE"&&!["PIX","CASH","CARD_ON_DELIVERY"].includes(body.paymentMethod))return res.status(400).json({error:"invalid_payment"});
 await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error("not_found");const d=snap.data();if(action==="REQUEST_BILL"&&d.status!=="OPEN"||action==="REOPEN"&&d.status!=="BILL_REQUESTED"||action==="CLOSE"&&d.status!=="BILL_REQUESTED")throw new Error("invalid_status");const patch={status:action==="REQUEST_BILL"?"BILL_REQUESTED":action==="REOPEN"?"OPEN":"CLOSED",updatedAt:FieldValue.serverTimestamp()};if(action==="CLOSE"){patch.paymentMethod=body.paymentMethod;patch.closedAt=FieldValue.serverTimestamp();patch.closedBy=user.uid;const orderRef=base.collection("orders").doc("tabpayment_"+id+"_"+Date.now());tx.set(orderRef,{channel:"TABLE",table:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label,tabId:id,number:"C"+orderRef.id.slice(-8).toUpperCase(),customerSnapshot:{name:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label},items:d.items||[],totalCents:Number(d.totalCents||0),status:"COMPLETED",paymentStatus:"PAID",paymentMethod:body.paymentMethod,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});patch.financeOrderId=orderRef.id}tx.update(ref,patch)});
 return res.status(200).json({ok:true});
 }
 return res.status(400).json({error:"invalid_action"});
 }catch(e){if(["already_open","not_open","not_found","invalid_status"].includes(e.message))return res.status(409).json({error:e.message});console.error("tabs",e);return res.status(500).json({error:"internal_error"})}
}