import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
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
    if(req.method==="GET"&&req.query.action==="publicBrand"){const snap=await getFirestore().doc("platformSettings/branding").get(),d=snap.data()||{};res.setHeader("Cache-Control","public, max-age=60, s-maxage=300");return res.status(200).json({logoUrl:d.logoUrl||"",bannerUrl:d.bannerUrl||""})}
    if(req.method==="GET"&&req.query.action==="tenantManifest"){
      const slug=String(req.query.slug||"").trim().toLowerCase();
      if(!/^[a-z0-9-]{1,90}$/.test(slug))return res.status(400).json({error:"invalid_slug"});
      const db=getFirestore(),mapping=await db.collection("restaurantSlugs").doc(slug).get();
      if(!mapping.exists)return res.status(404).json({error:"restaurant_not_found"});
      const restaurantId=String(mapping.data()?.restaurantId||"");
      if(!/^[\w-]{5,128}$/.test(restaurantId))return res.status(404).json({error:"restaurant_not_found"});
      const [settingsDoc,restaurantDoc,brandDoc]=await Promise.all([db.collection("restaurants").doc(restaurantId).collection("settings").doc("public").get(),db.collection("restaurants").doc(restaurantId).get(),db.doc("platformSettings/branding").get()]);
      const settings=settingsDoc.data()||{},restaurant=restaurantDoc.data()||{},brand=brandDoc.data()||{};
      const name=String(settings.name||restaurant.name||"Cardápio").trim().slice(0,80);
      const icon=String(settings.logoUrl||brand.logoUrl||"");
      const safeIcon=/^https:\/\/[^\s"<>]+$/i.test(icon)?icon:"/dishy-icon.svg";
      const extension=(()=>{try{return new URL(safeIcon,"https://dishy.com.br").pathname.split(".").pop()?.toLowerCase()}catch{return "svg"}})();
      const mime={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",svg:"image/svg+xml"}[extension]||"image/webp";
      const manifest={id:"/cardapio/"+slug,name,short_name:name.slice(0,24),description:"Cardápio digital de "+name,start_url:"/?loja="+encodeURIComponent(slug),scope:"/",display:"standalone",background_color:"#ffffff",theme_color:/^#[0-9a-f]{6}$/i.test(settings.brandPrimary||"")?settings.brandPrimary:"#ff7000",icons:safeIcon==="/dishy-icon.svg"?[{src:safeIcon,sizes:"any",type:"image/svg+xml",purpose:"any"}]:[{src:safeIcon,sizes:"any",type:mime,purpose:"any"},{src:"/dishy-icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"}]};
      res.setHeader("Content-Type","application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control","public, max-age=60, s-maxage=300");
      return res.status(200).send(JSON.stringify(manifest));
    }
    const authHeader=req.headers.authorization||"";
    if(!authHeader.startsWith("Bearer ")) return res.status(401).json({error:"unauthorized"});
    const decoded=await getAuth().verifyIdToken(authHeader.slice(7),true);
    if(req.method==="POST"&&req.body?.action==="posSale"){
      const body=req.body||{},rid=String(body.restaurantId||"");
      if(!/^[a-zA-Z0-9_-]{5,128}$/.test(rid))return res.status(400).json({error:"invalid_restaurant"});
      const db=getFirestore(),restaurant=db.collection("restaurants").doc(rid);
      const [restaurantSnap,member,access]=await Promise.all([restaurant.get(),restaurant.collection("members").doc(decoded.uid).get(),db.collection("userRestaurantAccess").doc(decoded.uid).collection("restaurants").doc(rid).get()]);
      if(!restaurantSnap.exists)return res.status(404).json({error:"restaurant_not_found"});
      const isOwner=restaurantSnap.data().ownerUid===decoded.uid||(member.exists&&member.data().active===true&&member.data().role==="owner");
      const isMember=access.exists&&access.data().active===true;
      if(!isOwner&&!isMember)return res.status(403).json({error:"access_denied"});
      if(!isOwner){const perms=member.data()?.permissions||access.data()?.permissions||[];if(!Array.isArray(perms)||!perms.includes("PDV"))return res.status(403).json({error:"pos_permission_required"})}
      const method=String(body.paymentMethod||"");
      if(!["CASH","CARD_ON_DELIVERY","PIX"].includes(method))return res.status(400).json({error:"pos_payment_not_supported"});
      const raw=Array.isArray(body.items)?body.items:[];
      if(!raw.length||raw.length>40)return res.status(400).json({error:"invalid_items"});
      const grouped=new Map();
      for(const item of raw){const id=String(item.productId||""),qty=Number(item.quantity);if(!/^[a-zA-Z0-9_-]{5,128}$/.test(id)||!Number.isInteger(qty)||qty<1||qty>99)return res.status(400).json({error:"invalid_item"});grouped.set(id,(grouped.get(id)||0)+qty)}
      if([...grouped.values()].some(q=>q>99))return res.status(400).json({error:"invalid_quantity"});
      const entries=await Promise.all([...grouped.keys()].map(id=>restaurant.collection("products").doc(id).get()));
      const items=[];let totalCents=0;
      for(const snap of entries){const p=snap.data();if(!snap.exists||p.active===false||p.available===false)return res.status(409).json({error:"product_unavailable"});const price=Number(p.priceCents),quantity=grouped.get(snap.id);if(!Number.isSafeInteger(price)||price<0)return res.status(409).json({error:"invalid_product_price"});items.push({productId:snap.id,name:String(p.name||"Produto").slice(0,120),quantity,qty:quantity,unitPriceCents:price,priceCents:price,totalCents:price*quantity});totalCents+=price*quantity}
      if(totalCents<=0||totalCents>100000000)return res.status(400).json({error:"invalid_total"});
      const ref=restaurant.collection("orders").doc(),now=FieldValue.serverTimestamp();
      const ready=items.every(item=>{const p=entries.find(d=>d.id===item.productId).data();return p.requiresPreparation===false});
      const status=method==="PIX"?"PENDING_PAYMENT":ready?"READY":"RECEIVED";
      await ref.create({code:"PDV-"+ref.id.slice(0,6).toUpperCase(),number:"PDV-"+ref.id.slice(0,6).toUpperCase(),channel:"PICKUP",source:"POS",customer:{name:String(body.customerName||"Balcão").trim().slice(0,80)||"Balcão",phone:""},customerSnapshot:{name:String(body.customerName||"Balcão").trim().slice(0,80)||"Balcão"},customerName:String(body.customerName||"Balcão").trim().slice(0,80)||"Balcão",items,totalCents,subtotalCents:totalCents,deliveryFeeCents:0,paymentMethod:method,paymentStatus:method==="PIX"?"PENDING":"PAID",status,requiresPreparation:!ready,createdAt:now,updatedAt:now,...(method!=="PIX"?{paidAt:now}:{}),createdBy:decoded.uid,notes:String(body.notes||"").slice(0,500)});
      if(method==="PIX"){
        try{
          const cfg=(await restaurant.collection("privateIntegrations").doc("mercadoPago").get()).data(),key=process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
          if(!cfg?.encryptedAccessToken||!/^[a-fA-F0-9]{64}$/.test(key||""))throw Error("payment_not_configured");
          const decipher=createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),Buffer.from(cfg.iv,"base64"));decipher.setAuthTag(Buffer.from(cfg.authTag,"base64"));
          const token=Buffer.concat([decipher.update(Buffer.from(cfg.encryptedAccessToken,"base64")),decipher.final()]).toString("utf8");
          const base=process.env.PAYMENT_PUBLIC_HOST||process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
          const webhook=base?"https://"+String(base).replace(/^https?:\/\//,"").replace(/\/$/,"")+"/api/create-order?action=payment-status&restaurantId="+encodeURIComponent(rid):null;
          const payload={transaction_amount:totalCents/100,description:"Venda PDV "+ref.id.slice(0,6),payment_method_id:"pix",payer:{email:"pdv-"+ref.id+"@example.com",first_name:"Balcao"},external_reference:rid+":"+ref.id,...(webhook?{notification_url:webhook}:{})};
          const response=await fetch("https://api.mercadopago.com/v1/payments",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json","X-Idempotency-Key":ref.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
          const mp=await response.json(),data=mp.point_of_interaction?.transaction_data||{};
          if(!response.ok||!data.qr_code||!mp.id)throw Error("pix_creation_failed");
          await ref.update({provider:"mercado_pago",providerPaymentId:String(mp.id),updatedAt:FieldValue.serverTimestamp()});
          return res.status(201).json({ok:true,orderId:ref.id,code:"PDV-"+ref.id.slice(0,6).toUpperCase(),totalCents,payment:{qrCode:data.qr_code,qrCodeBase64:data.qr_code_base64||null}});
        }catch(e){await ref.update({paymentStatus:"ERROR",paymentError:String(e.message).slice(0,100)}).catch(()=>{});return res.status(502).json({error:e.message==="payment_not_configured"?"payment_not_configured":"pix_creation_failed",orderId:ref.id})}
      }
      return res.status(201).json({ok:true,orderId:ref.id,code:"PDV-"+ref.id.slice(0,6).toUpperCase(),totalCents,ready});

    }
    if((req.method==="GET"&&req.query.action==="platformBrand")||(req.method==="POST"&&req.body?.action==="platformBrand")){
      const admin=await getFirestore().doc("platformAdmins/"+decoded.uid).get();
      if(!admin.exists||admin.data().active!==true)return res.status(403).json({error:"master_only"});
      const ref=getFirestore().doc("platformSettings/branding");
      if(req.method==="GET"){const snap=await ref.get();return res.status(200).json({logoUrl:snap.data()?.logoUrl||"",bannerUrl:snap.data()?.bannerUrl||""})}
      const logoUrl=String(req.body.logoUrl||""),bannerUrl=String(req.body.bannerUrl||"");
      if([logoUrl,bannerUrl].some(v=>v&&(!/^https:\/\//i.test(v)||v.length>2048)))return res.status(400).json({error:"invalid_brand_url"});
      await ref.set({logoUrl,bannerUrl,updatedBy:decoded.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return res.status(200).json({ok:true});
    }
    if((req.method==="GET"&&req.query.action==="pointTerminals")||(req.method==="POST"&&req.body?.action==="pointSelectTerminal")){
      const rid=String(req.method==="GET"?req.query.restaurantId:req.body?.restaurantId||"");
      if(!/^[a-zA-Z0-9_-]{5,128}$/.test(rid))return res.status(400).json({error:"invalid_restaurant"});
      const restaurant=getFirestore().collection("restaurants").doc(rid);
      const [rs,member]=await Promise.all([restaurant.get(),restaurant.collection("members").doc(decoded.uid).get()]);
      if(!rs.exists)return res.status(404).json({error:"restaurant_not_found"});
      if(rs.data().ownerUid!==decoded.uid&&!(member.exists&&member.data().active===true&&member.data().role==="owner"))return res.status(403).json({error:"owner_only"});
      const integration=(await restaurant.collection("privateIntegrations").doc("mercadoPago").get()).data()||{};
      if(!integration.encryptedAccessToken)return res.status(409).json({error:"mercado_pago_not_connected"});
      const key=process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
      if(!/^[a-fA-F0-9]{64}$/.test(key||""))return res.status(503).json({error:"encryption_key_not_configured"});
      const decipher=createDecipheriv("aes-256-gcm",Buffer.from(key,"hex"),Buffer.from(integration.iv,"base64"));decipher.setAuthTag(Buffer.from(integration.authTag,"base64"));
      const token=Buffer.concat([decipher.update(Buffer.from(integration.encryptedAccessToken,"base64")),decipher.final()]).toString("utf8");
      const mp=await fetch("https://api.mercadopago.com/point/integration-api/devices",{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000)});
      const payload=await mp.json().catch(()=>({}));
      if(!mp.ok)return res.status(502).json({error:"point_devices_unavailable",providerStatus:mp.status});
      const terminals=(Array.isArray(payload.devices)?payload.devices:Array.isArray(payload)?payload:[]).map(d=>({id:String(d.id||""),name:String(d.name||d.id||""),status:String(d.status||"unknown")})).filter(d=>d.id);
      if(req.method==="GET"){
        const selected=(await restaurant.collection("privateIntegrations").doc("mercadoPagoPoint").get()).data()||{};
        return res.status(200).json({terminals,selectedTerminalId:selected.terminalId||null,enabled:false,reason:"awaiting_terminal_validation"});
      }
      const id=String(req.body.terminalId||"");
      if(!terminals.some(t=>t.id===id))return res.status(400).json({error:"terminal_not_in_account"});
      await restaurant.collection("privateIntegrations").doc("mercadoPagoPoint").set({terminalId:id,accountId:integration.accountId||"",enabled:false,validationStatus:"PENDING_HARDWARE_TEST",updatedBy:decoded.uid,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return res.status(200).json({ok:true,selectedTerminalId:id,enabled:false,validationStatus:"PENDING_HARDWARE_TEST"});
    }
    if((req.method==="GET"&&req.query.action==="mpCredentials")||(req.method==="POST"&&req.body?.action==="mpCredentials")){
      const restaurantId=String(req.method==="GET"?req.query.restaurantId:req.body?.restaurantId||"");
      if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
      const db=getFirestore(),restaurant=db.collection("restaurants").doc(restaurantId);
      const [member,restaurantSnap]=await Promise.all([restaurant.collection("members").doc(decoded.uid).get(),restaurant.get()]);
      if(!restaurantSnap.exists)return res.status(404).json({error:"restaurant_not_found"});
      if(restaurantSnap.data().ownerUid!==decoded.uid&&(!member.exists||member.data().active!==true||member.data().role!=="owner"))return res.status(403).json({error:"owner_only"});
      const ref=restaurant.collection("privateIntegrations").doc("mercadoPago");
      if(req.method==="GET"){
        const snap=await ref.get(),data=snap.data()||{};
        return res.status(200).json({configured:!!data.encryptedAccessToken,publicKey:data.publicKey||"",lastVerifiedAt:data.lastVerifiedAt?.toDate?.()?.toISOString?.()||null});
      }
      const accessToken=String(req.body.accessToken||"").trim(),publicKey=String(req.body.publicKey||"").trim();
      if(!/^APP_USR-[A-Za-z0-9-]{20,}$/.test(accessToken)||!/^APP_USR-[A-Za-z0-9-]{10,}$/.test(publicKey))return res.status(400).json({error:"invalid_production_credentials"});
      const keyHex=process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
      if(!/^[a-fA-F0-9]{64}$/.test(keyHex||""))return res.status(503).json({error:"encryption_key_not_configured"});
      const mp=await fetch("https://api.mercadopago.com/users/me",{headers:{Authorization:"Bearer "+accessToken},signal:AbortSignal.timeout(10000)});
      if(!mp.ok)return res.status(400).json({error:"mercado_pago_credentials_rejected"});
      const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",Buffer.from(keyHex,"hex"),iv);
      const encrypted=Buffer.concat([cipher.update(accessToken,"utf8"),cipher.final()]);
      await ref.set({provider:"mercado_pago",encryptedAccessToken:encrypted.toString("base64"),iv:iv.toString("base64"),authTag:cipher.getAuthTag().toString("base64"),publicKey,accountId:String((await mp.json()).id||""),lastVerifiedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),updatedBy:decoded.uid});
      return res.status(200).json({ok:true,configured:true});
    }
    if((req.method==="GET"&&req.query.action==="shifts")||(req.method==="POST"&&req.body?.action==="shift")){
      const restaurantId=String(req.method==="GET"?req.query.restaurantId:req.body?.restaurantId||"");
      if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
      const db=getFirestore(),restaurant=db.collection("restaurants").doc(restaurantId);
      const actor=await restaurant.collection("members").doc(decoded.uid).get();
      if(!actor.exists||actor.data().active!==true)return res.status(403).json({error:"access_denied"});
      const role=actor.data().role;
      const supervisor=role==="owner"||(role==="manager"&&Array.isArray(actor.data().permissions)&&actor.data().permissions.includes("Equipe em serviço"));
      const shifts=restaurant.collection("staffShifts");
      if(req.method==="GET"){
        const snap=supervisor?await shifts.limit(150).get():await shifts.where("uid","==",decoded.uid).limit(20).get();
        return res.status(200).json({supervisor,shifts:snap.docs.map(d=>({uid:d.id,name:d.data().name||"",email:d.data().email||"",status:d.data().status||"off",requestedAt:d.data().requestedAt?.toDate?.()?.toISOString?.()||null,startedAt:d.data().startedAt?.toDate?.()?.toISOString?.()||null,endedAt:d.data().endedAt?.toDate?.()?.toISOString?.()||null}))});
      }
      const operation=String(req.body.operation||"");
      const uid=operation==="request"?decoded.uid:String(req.body.uid||"");
      if(!/^[a-zA-Z0-9_-]{5,128}$/.test(uid))return res.status(400).json({error:"invalid_employee"});
      if(operation!=="request"&&!supervisor)return res.status(403).json({error:"supervisor_only"});
      if(!["request","approve","end","reject"].includes(operation))return res.status(400).json({error:"invalid_operation"});
      const member=await restaurant.collection("members").doc(uid).get();
      if(!member.exists||member.data().active!==true||member.data().role==="owner")return res.status(403).json({error:"invalid_employee"});
      const ref=shifts.doc(uid),now=FieldValue.serverTimestamp();
      await db.runTransaction(async tx=>{
        const current=await tx.get(ref),status=current.exists?current.data().status:"off";
        if(operation==="request"&&status!=="off"&&status!=="ended"&&status!=="rejected")throw new Error("shift_already_pending_or_active");
        if(operation==="approve"&&status!=="pending")throw new Error("shift_not_pending");
        if(operation==="end"&&status!=="active")throw new Error("shift_not_active");
        if(operation==="reject"&&status!=="pending")throw new Error("shift_not_pending");
        const next=operation==="request"?"pending":operation==="approve"?"active":operation==="end"?"ended":"rejected";
        tx.set(ref,{uid,name:member.data().name||"",email:member.data().email||"",status:next,updatedAt:now,...(operation==="request"?{requestedAt:now,startedAt:null,endedAt:null}:operation==="approve"?{startedAt:now,approvedBy:decoded.uid}:operation==="end"?{endedAt:now,endedBy:decoded.uid}:{rejectedAt:now,rejectedBy:decoded.uid})},{merge:true});
        tx.set(restaurant.collection("audit").doc(),{action:"SHIFT_"+operation.toUpperCase(),actorUid:decoded.uid,targetUid:uid,createdAt:now});
      });
      return res.status(200).json({ok:true});
    }
    if(req.method==="GET"&&req.query.action==="employees"){
      const id=String(req.query.restaurantId||"");if(!/^[a-zA-Z0-9_-]{5,128}$/.test(id))return res.status(400).json({error:"invalid_restaurant"});
      const db=getFirestore(),access=await db.collection("restaurants").doc(id).collection("members").doc(decoded.uid).get();
      if(!access.exists||access.data().active!==true)return res.status(403).json({error:"access_denied"});
      const role=access.data().role||"employee";
      const permissionKeys=["Início","Pedidos","Cardápio","Clientes","Financeiro","Cozinha","Mesas e comandas","Delivery","Entregadores","Promoções","Marketing","Configurações","Meu plano","Funcionários e permissões","Equipe em serviço"];
      const permissions=role==="owner"?permissionKeys:(Array.isArray(access.data().permissions)?access.data().permissions:[]);
      if(role!=="owner")return res.status(200).json({role,permissions,employees:[]});
      const members=await db.collection("restaurants").doc(id).collection("members").get();
      return res.status(200).json({role,permissions,employees:members.docs.map(d=>({uid:d.id,email:d.data().email||"",name:d.data().name||"",role:d.data().role||"employee",active:d.data().active===true,permissions:Array.isArray(d.data().permissions)?d.data().permissions:[]}))});
    }
    if(req.method==="GET"){
        const restaurantId=String(req.query.restaurantId||"");if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
  const db=getFirestore();const access=await db.collection("userRestaurantAccess").doc(decoded.uid).collection("restaurants").doc(restaurantId).get();
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
    if(req.method==="POST"&&req.body?.action==="addEmployee"){
      const {restaurantId,email,name,role,permissions}=req.body||{};
      const valid=v=>typeof v==="string"&&/^[a-zA-Z0-9_-]{5,128}$/.test(v);
      const roles=["manager","attendant","kitchen","driver","finance","employee"];
      const modules=["Início","Pedidos","Cardápio","Clientes","Financeiro","Cozinha","Mesas e comandas","Delivery","Entregadores","Promoções","Marketing","Configurações","Meu plano","Funcionários e permissões"];
      if(!valid(restaurantId)||typeof email!=="string"||email.length>254||!email.includes("@")||!roles.includes(role)||!Array.isArray(permissions)||permissions.some(p=>!modules.includes(p)))return res.status(400).json({error:"invalid_employee"});
      const db=getFirestore(),restaurant=db.collection("restaurants").doc(restaurantId),owner=await restaurant.collection("members").doc(decoded.uid).get();
      if(!owner.exists||owner.data().role!=="owner"||owner.data().active!==true)return res.status(403).json({error:"owner_only"});
      let target;try{target=await getAuth().getUserByEmail(email.trim().toLowerCase())}catch(e){if(e.code==="auth/user-not-found")return res.status(404).json({error:"employee_account_not_found"});throw e}
      if(target.uid===decoded.uid)return res.status(400).json({error:"cannot_add_self"});
      const existing=await restaurant.collection("members").doc(target.uid).get();
      if(existing.exists)return res.status(409).json({error:"employee_already_exists"});
      const restaurantSnap=await restaurant.get();if(!restaurantSnap.exists)return res.status(404).json({error:"restaurant_not_found"});
      const batch=db.batch(),now=FieldValue.serverTimestamp();
      batch.create(restaurant.collection("members").doc(target.uid),{uid:target.uid,email:target.email,name:typeof name==="string"?name.trim().slice(0,100):"",role,permissions:[...new Set(permissions)],active:true,createdAt:now});
      batch.set(db.collection("userRestaurantAccess").doc(target.uid).collection("restaurants").doc(restaurantId),{restaurantId,restaurantName:restaurantSnap.data().name||"",role,active:true,createdAt:now});
      batch.create(restaurant.collection("audit").doc(),{action:"OWNER_ADD_EMPLOYEE",actorUid:decoded.uid,targetUid:target.uid,createdAt:now});
      await batch.commit();return res.status(201).json({ok:true});
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