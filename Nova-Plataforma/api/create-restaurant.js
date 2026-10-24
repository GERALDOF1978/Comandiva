import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {FieldValue,getFirestore} from "firebase-admin/firestore";

function getAdmin(){
  if(getApps().length) return getApps()[0];
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey) throw new Error("Firebase Admin não configurado");
  return initializeApp({credential:cert({projectId,clientEmail,privateKey})});
}
function slugify(v){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)}
export default async function handler(req,res){
  if(req.method!=="POST"&&req.method!=="GET") return res.status(405).json({error:"method_not_allowed"});
  try{
    getAdmin();
    const authHeader=req.headers.authorization||"";
    if(!authHeader.startsWith("Bearer ")) return res.status(401).json({error:"unauthorized"});
    const decoded=await getAuth().verifyIdToken(authHeader.slice(7),true);
    if(req.method==="GET"){
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

    }
    if(req.method==="GET"&&req.query.action==="employees"){
      const id=String(req.query.restaurantId||"");if(!/^[a-zA-Z0-9_-]{5,128}$/.test(id))return res.status(400).json({error:"invalid_restaurant"});
      const db=getFirestore(),access=await db.collection("restaurants").doc(id).collection("members").doc(decoded.uid).get();
      if(!access.exists||access.data().active!==true)return res.status(403).json({error:"access_denied"});
      const role=access.data().role||"employee";
      const permissionKeys=["Início","Pedidos","Cardápio","Clientes","Financeiro","Cozinha","Mesas e comandas","Delivery","Entregadores","Promoções","Marketing","Configurações","Meu plano","Funcionários e permissões"];
      const permissions=role==="owner"?permissionKeys:(Array.isArray(access.data().permissions)?access.data().permissions:[]);
      if(role!=="owner")return res.status(200).json({role,permissions,employees:[]});
      const members=await db.collection("restaurants").doc(id).collection("members").get();
      return res.status(200).json({role,permissions,employees:members.docs.map(d=>({uid:d.id,email:d.data().email||"",name:d.data().name||"",role:d.data().role||"employee",active:d.data().active===true,permissions:Array.isArray(d.data().permissions)?d.data().permissions:[]}))});
    }
    if(req.method==="POST"&&req.body?.action==="setEmployeePermissions"){
      const {restaurantId,uid,permissions,active}=req.body||{};
      const valid=v=>typeof v==="string"&&/^[a-zA-Z0-9_-]{5,128}$/.test(v);
      const allowed=["Início","Pedidos","Cardápio","Clientes","Financeiro","Cozinha","Mesas e comandas","Delivery","Entregadores","Promoções","Marketing","Configurações","Meu plano","Funcionários e permissões"];
      if(!valid(restaurantId)||!valid(uid)||!Array.isArray(permissions)||permissions.length>allowed.length||permissions.some(p=>!allowed.includes(p))||typeof active!=="boolean")return res.status(400).json({error:"invalid_permissions"});
      const db=getFirestore(),members=db.collection("restaurants").doc(restaurantId).collection("members");
      const owner=await members.doc(decoded.uid).get();
      if(!owner.exists||owner.data().role!=="owner"||owner.data().active!==true)return res.status(403).json({error:"owner_only"});
      const target=await members.doc(uid).get();
      if(!target.exists)return res.status(404).json({error:"employee_not_found"});
      if(target.data().role==="owner"||uid===decoded.uid)return res.status(403).json({error:"owner_cannot_be_changed"});
      const batch=db.batch();
      batch.update(target.ref,{permissions:[...new Set(permissions)],active,updatedAt:FieldValue.serverTimestamp()});
      batch.set(db.collection("userRestaurantAccess").doc(uid).collection("restaurants").doc(restaurantId),{active,role:target.data().role||"employee"},{merge:true});
      batch.create(db.collection("restaurants").doc(restaurantId).collection("audit").doc(),{action:"OWNER_UPDATE_EMPLOYEE_PERMISSIONS",actorUid:decoded.uid,targetUid:uid,createdAt:FieldValue.serverTimestamp()});
      await batch.commit();return res.status(200).json({ok:true});
    }
    if(["createPlan","setPlanActive","assignSubscription"].includes(req.body?.action)){
      const db=getFirestore(),master=await db.collection("platformAdmins").doc(decoded.uid).get();
      if(master.data()?.active!==true)return res.status(403).json({error:"master_access_denied"});
      const {action,planId,restaurantId,name,priceCents,active}=req.body;
      const validId=v=>typeof v==="string"&&/^[a-zA-Z0-9_-]{1,128}$/.test(v);
      const now=FieldValue.serverTimestamp();
      if(action==="createPlan"){
        if(!validId(planId)||planId==="trial"||typeof name!=="string"||name.trim().length<3||name.length>80||!Number.isSafeInteger(priceCents)||priceCents<0||priceCents>100000000)return res.status(400).json({error:"invalid_plan"});
        const ref=db.collection("plans").doc(planId);
        if((await ref.get()).exists)return res.status(409).json({error:"plan_exists"});
        await ref.create({name:name.trim(),priceCents,active:true,createdAt:now,updatedAt:now});
        return res.status(201).json({ok:true});
      }
      if(action==="setPlanActive"){
        if(!validId(planId)||typeof active!=="boolean")return res.status(400).json({error:"invalid_plan"});
        const ref=db.collection("plans").doc(planId);
        if(!(await ref.get()).exists)return res.status(404).json({error:"plan_not_found"});
        await ref.update({active,updatedAt:now});
        return res.status(200).json({ok:true});
      }
      if(!validId(restaurantId)||!validId(planId))return res.status(400).json({error:"invalid_subscription"});
      const restaurantRef=db.collection("restaurants").doc(restaurantId);
      if(!(await restaurantRef.get()).exists)return res.status(404).json({error:"restaurant_not_found"});
      if(planId!=="trial"){
        const plan=await db.collection("plans").doc(planId).get();
        if(!plan.exists||plan.data().active!==true)return res.status(400).json({error:"plan_unavailable"});
      }
      const batch=db.batch();
      batch.set(db.collection("subscriptions").doc(restaurantId),{restaurantId,planId,status:planId==="trial"?"trial":"pending_payment",updatedAt:now,...(planId==="trial"?{trialDurationDays:180}:{}),...(planId==="trial"?{trialEndsAt:new Date(Date.now()+180*86400000)}:{})},{merge:true});
      batch.update(restaurantRef,{planId,updatedAt:now});
      batch.create(restaurantRef.collection("audit").doc(),{action:"MASTER_ASSIGN_PLAN",planId,actorUid:decoded.uid,createdAt:now});
      await batch.commit();
      return res.status(200).json({ok:true});
    }
    if(req.body?.action==="setRestaurantStatus"){
      const db=getFirestore();
      const master=await db.collection("platformAdmins").doc(decoded.uid).get();
      if(master.data()?.active!==true)return res.status(403).json({error:"master_access_denied"});
      const {restaurantId,status}=req.body;
      if(typeof restaurantId!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(restaurantId)||!["active","suspended"].includes(status))return res.status(400).json({error:"invalid_request"});
      const ref=db.collection("restaurants").doc(restaurantId),snap=await ref.get();
      if(!snap.exists)return res.status(404).json({error:"restaurant_not_found"});
      const batch=db.batch(),now=FieldValue.serverTimestamp();
      batch.update(ref,{status,updatedAt:now});
      const slug=snap.data().slug;
      if(typeof slug==="string"&&/^[a-z0-9-]{1,80}$/.test(slug))batch.set(db.collection("restaurantSlugs").doc(slug),{active:status==="active"},{merge:true});
      batch.create(ref.collection("audit").doc(),{action:"MASTER_SET_STATUS",status,actorUid:decoded.uid,createdAt:now});
      await batch.commit();
      return res.status(200).json({ok:true});
    }
    if(!decoded.email) return res.status(400).json({error:"email_required"});
    const {name,type,phone}=req.body||{};
    if(typeof name!=="string"||name.trim().length<3||name.trim().length>100) return res.status(400).json({error:"invalid_name"});
    if(typeof type!=="string"||!["restaurant","pizzeria","snack_bar","marmitaria","bar","bakery","other"].includes(type)) return res.status(400).json({error:"invalid_type"});
    if(typeof phone!=="string"||phone.replace(/\D/g,"").length<10||phone.replace(/\D/g,"").length>13) return res.status(400).json({error:"invalid_phone"});

    const db=getFirestore();
    const existing=await db.collection("userRestaurantAccess").doc(decoded.uid).collection("restaurants").limit(1).get();
    if(!existing.empty) return res.status(409).json({error:"account_already_linked"});

    const restaurantRef=db.collection("restaurants").doc();
    const base=slugify(name)||"estabelecimento";
    let slug=base;
    let n=1;
    while((await db.collection("restaurantSlugs").doc(slug).get()).exists){slug=`${base}-${++n}`}

    const now=FieldValue.serverTimestamp();
    const batch=db.batch();
    batch.create(restaurantRef,{name:name.trim(),type,phone:phone.trim(),slug,status:"active",ownerUid:decoded.uid,planId:"trial",createdAt:now,updatedAt:now});
    batch.create(restaurantRef.collection("members").doc(decoded.uid),{uid:decoded.uid,email:decoded.email,name:decoded.name||"",role:"owner",active:true,createdAt:now});
    batch.create(db.collection("userRestaurantAccess").doc(decoded.uid).collection("restaurants").doc(restaurantRef.id),{restaurantId:restaurantRef.id,restaurantName:name.trim(),role:"owner",active:true,createdAt:now});
    batch.create(db.collection("restaurantSlugs").doc(slug),{restaurantId:restaurantRef.id,active:true,createdAt:now});
    batch.create(restaurantRef.collection("settings").doc("public"),{name:name.trim(),type,phone:phone.trim(),slug,published:false,createdAt:now,updatedAt:now});
    batch.create(db.collection("subscriptions").doc(restaurantRef.id),{restaurantId:restaurantRef.id,planId:"trial",status:"trial",trialEndsAt:new Date(Date.now()+180*86400000),trialDurationDays:180,createdAt:now});
    batch.create(restaurantRef.collection("audit").doc(),{action:"RESTAURANT_CREATED",actorUid:decoded.uid,actorEmail:decoded.email,createdAt:now});
    await batch.commit();
    return res.status(201).json({ok:true,restaurantId:restaurantRef.id,slug});
  }catch(e){
    console.error("create-restaurant",e);
    return res.status(500).json({error:"internal_error"});
  }
}