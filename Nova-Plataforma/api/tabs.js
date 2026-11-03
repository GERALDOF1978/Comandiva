import {startTabPix} from "../server/tab-pix.js";
import {buildTableOrderLine} from "../src/lib/tableItemPricing.js";
import {enabledPaymentMethods} from "../src/lib/paymentMethods.js";
import {enabledServiceModes} from "../src/lib/serviceModes.js";
import {restaurantMayReceiveOrders} from "../src/lib/subscriptionAccess.js";
import {canAccessModule} from "../src/lib/staffPermissions.js";
import publicTabHandler from "../server/public-tab.js";
import {randomBytes} from "node:crypto";
import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";
function init(){if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n")})})}
export default async function handler(req,res){
 if(req.query?.public==="1"||req.body?.public===true)return publicTabHandler(req,res);
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"method_not_allowed"});
 try{
 init();const header=req.headers.authorization||"";if(!header.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
 const user=await getAuth().verifyIdToken(header.slice(7),true),body=req.body||{},restaurantId=String(req.method==="GET"?req.query.restaurantId:body.restaurantId||"");
 if(!/^[\w-]{5,128}$/.test(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
 const db=getFirestore(),base=db.collection("restaurants").doc(restaurantId),member=await base.collection("members").doc(user.uid).get();
 if(!member.exists||!canAccessModule(member.data(),"Mesas e comandas"))return res.status(403).json({error:"forbidden"});
 const tabs=base.collection("tabs");
 if(req.method==="GET"){const [snap,calls]=await Promise.all([tabs.limit(300).get(),base.collection("serviceCalls").where("status","==","PENDING").limit(100).get()]);return res.status(200).json({tabs:snap.docs.map(d=>({id:d.id,...d.data(),createdAt:d.data().createdAt?.toDate?.()?.toISOString()||null,updatedAt:d.data().updatedAt?.toDate?.()?.toISOString()||null})),serviceCalls:calls.docs.map(d=>({id:d.id,...d.data(),createdAt:d.data().createdAt?.toDate?.()?.toISOString()||null}))})}
 const action=String(body.action||""),id=String(body.tabId||"");
 if(["OPEN","ADD_BATCH","ADD"].includes(action)){
  const r=await base.get();if(!r.exists||r.data().status!=="active")return res.status(403).json({error:"restaurant_suspended"});
  const entitlement=await restaurantMayReceiveOrders(db,restaurantId);
  if(!entitlement.allowed)return res.status(403).json({error:entitlement.error});
 }
 if(action==="RESOLVE_SERVICE_CALL"){
 const callId=String(body.callId||"");if(!/^[a-zA-Z0-9_-]{5,128}$/.test(callId))return res.status(400).json({error:"invalid_call"});
 const callRef=base.collection("serviceCalls").doc(callId);
 await db.runTransaction(async tx=>{const snap=await tx.get(callRef);if(!snap.exists||snap.data().status!=="PENDING")throw new Error("invalid_status");tx.update(callRef,{status:"DONE",resolvedBy:user.uid,updatedAt:FieldValue.serverTimestamp()})});
 return res.status(200).json({ok:true});
 }
 if(action==="OPEN"){
 const type=body.type==="TABLE"?"TABLE":body.type==="INDIVIDUAL"?"INDIVIDUAL":null,label=String(body.label||"").trim().slice(0,70);
 if(!type||!label)return res.status(400).json({error:"invalid_tab"});
 const serviceSettings=await base.collection("settings").doc("public").get();
 if(!enabledServiceModes(serviceSettings.data()?.serviceModes).includes(type==="TABLE"?"TABLE":"TAB"))return res.status(403).json({error:"service_disabled"});
 const ref=tabs.doc(type+"_"+label.toLowerCase().replace(/[^a-z0-9]/g,"_"));
 await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists&&snap.data().status!=="CLOSED")throw new Error("already_open");tx.set(ref,{type,label,status:"OPEN",items:[],totalCents:0,customerPhones:[],createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),createdBy:user.uid,customerAccessToken:snap.exists&&snap.data().customerAccessToken||randomBytes(24).toString("hex")})});
 return res.status(200).json({ok:true,id:ref.id});
 }
 if(!/^[\w-]{3,130}$/.test(id))return res.status(400).json({error:"invalid_tab"});
 const ref=tabs.doc(id);
 if(action==="CREATE_PIX"){const cfg=await base.collection("settings").doc("public").get();if(!enabledPaymentMethods(cfg.data()?.paymentMethods).includes("PIX"))return res.status(400).json({error:"payment_method_disabled"});try{return res.status(200).json({ok:true,payment:await startTabPix(base,ref,restaurantId)})}catch(e){return res.status(409).json({error:e.message})}}
 if(action==="QR_TOKEN"){const snap=await ref.get();if(!snap.exists)return res.status(404).json({error:"not_found"});if(snap.data().status==="CLOSED")return res.status(409).json({error:"not_open"});let token=snap.data().customerAccessToken;if(!token){token=randomBytes(24).toString("hex");await ref.update({customerAccessToken:token})}return res.status(200).json({ok:true,token})}
 if(action==="ADD_BATCH"||action==="ADD"){
 const incoming=action==="ADD"?[{productId:body.productId,qty:body.qty||1,pizzaSelection:body.pizzaSelection,optionSelection:body.optionSelection}]:Array.isArray(body.items)?body.items:[];
 if(!incoming.length||incoming.length>100)return res.status(400).json({error:"invalid_items"});
 if(new Set(incoming.map(x=>String(x.productId||""))).size>60)return res.status(400).json({error:"invalid_items"});
 const entries=await Promise.all(incoming.map(async entry=>{
  const pid=String(entry.productId||"");if(!/^[A-Za-z0-9_-]{5,128}$/.test(pid))throw Error("invalid_item");
  const product=await base.collection("products").doc(pid).get();
  if(!product.exists)throw Error("product_unavailable");
  return buildTableOrderLine({id:pid,...product.data()},entry);
 }));
 const total=entries.reduce((n,x)=>n+x.totalCents,0);
 if(!Number.isSafeInteger(total)||total<0||total>100000000)return res.status(400).json({error:"invalid_total"});
 const orderRef=base.collection("orders").doc();
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists||snap.data().status!=="OPEN")throw Error("not_open");
  const d=snap.data();
  tx.set(orderRef,{channel:"TABLE",table:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label,tabId:id,number:"M"+orderRef.id.slice(0,6).toUpperCase(),customerSnapshot:{name:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label},items:entries,totalCents:0,status:"RECEIVED",paymentStatus:"PENDING",paymentMethod:"CASH",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  tx.update(ref,{items:[...(d.items||[]),...entries.map(x=>({...x,addedAt:new Date().toISOString()}))],totalCents:Number(d.totalCents||0)+total,updatedAt:FieldValue.serverTimestamp()});
 });
 return res.status(200).json({ok:true,orderId:orderRef.id});
 }
 if(action==="REQUEST_BILL"||action==="REOPEN"||action==="CLOSE"){
 if(action==="CLOSE"&&!["CASH","CARD_ON_DELIVERY"].includes(body.paymentMethod))return res.status(400).json({error:"invalid_payment"});
 if(action==="CLOSE"){const cfg=await base.collection("settings").doc("public").get();if(!enabledPaymentMethods(cfg.data()?.paymentMethods).includes(body.paymentMethod))return res.status(400).json({error:"payment_method_disabled"})}
 await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error("not_found");const d=snap.data();if(action==="REQUEST_BILL"&&(!(d.items||[]).length||Number(d.totalCents||0)<=0))throw new Error("empty_tab");if(action==="REQUEST_BILL"&&d.status!=="OPEN"||action==="REOPEN"&&d.status!=="BILL_REQUESTED"||action==="CLOSE"&&d.status!=="BILL_REQUESTED")throw new Error("invalid_status");const patch={status:action==="REQUEST_BILL"?"BILL_REQUESTED":action==="REOPEN"?"OPEN":"CLOSED",updatedAt:FieldValue.serverTimestamp()};if(action==="CLOSE"){patch.paymentMethod=body.paymentMethod;patch.closedAt=FieldValue.serverTimestamp();patch.closedBy=user.uid;const orderRef=base.collection("orders").doc("tabpayment_"+id+"_"+Date.now());tx.set(orderRef,{channel:"TABLE",table:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label,tabId:id,number:"C"+orderRef.id.slice(-8).toUpperCase(),customerSnapshot:{name:(d.type==="TABLE"?"Mesa ":"Comanda ")+d.label},items:d.items||[],totalCents:Number(d.totalCents||0),status:"COMPLETED",paymentStatus:"PAID",paymentMethod:body.paymentMethod,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});patch.financeOrderId=orderRef.id}tx.update(ref,patch)});
 return res.status(200).json({ok:true});
 }
 return res.status(400).json({error:"invalid_action"});
 }catch(e){if(["already_open","not_open","not_found","invalid_status","empty_tab","product_unavailable","invalid_price"].includes(e.message))return res.status(409).json({error:e.message});if(["invalid_items","invalid_item","invalid_product","invalid_quantity","invalid_pizza_selection","invalid_pizza_crust","invalid_pizza_price","invalid_option_selection","invalid_option_price","invalid_option_product","invalid_pizza_product","assembly_required","invalid_total"].includes(e.message))return res.status(400).json({error:e.message});console.error("tabs",e);return res.status(500).json({error:"internal_error"})}
}