import {cert,getApps,initializeApp} from "firebase-admin/app";
import {FieldValue,getFirestore} from "firebase-admin/firestore";

function init(){
  if(getApps().length)return;
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey)throw new Error("Firebase Admin não configurado");
  initializeApp({credential:cert({projectId,clientEmail,privateKey})});
}
const clean=v=>typeof v==="string"?v.trim():"";
const n=v=>{if(v===null||v===undefined||v==="")return null;const x=Number(v);return Number.isFinite(x)?x:null};
const stripUndefined=v=>Array.isArray(v)?v.map(stripUndefined):v&&typeof v==="object"&&!v._methodName?Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).map(([k,x])=>[k,stripUndefined(x)])):v;
async function serverRoute(origin,destination){
 const routeBase=process.env.ROUTING_BASE_URL||"https://router.project-osrm.org",geoBase=process.env.GEOCODER_BASE_URL||"https://nominatim.openstreetmap.org";
 async function point(p,address){if(n(p?.latitude)!==null&&n(p?.longitude)!==null)return{latitude:n(p.latitude),longitude:n(p.longitude)};const queries=Array.isArray(address)?address:[address];for(const q of queries){if(!clean(q))continue;const r=await fetch(geoBase+"/search?format=jsonv2&limit=1&countrycodes=br&q="+encodeURIComponent(q),{headers:{"User-Agent":"SaaS-Delivery/1.0","Accept-Language":"pt-BR"}});if(!r.ok)throw new Error("geocoder_unavailable");const d=await r.json();if(d?.length)return{latitude:Number(d[0].lat),longitude:Number(d[0].lon)}}throw new Error("address_not_found")}
 const a=await point(origin,origin.address),b=await point(destination,destination.address),r=await fetch(routeBase+"/route/v1/driving/"+a.longitude+","+a.latitude+";"+b.longitude+","+b.latitude+"?overview=false",{headers:{"User-Agent":"SaaS-Delivery/1.0 (+https://agendaaki.shop)"}}),d=await r.json();if(!r.ok)throw new Error("routing_unavailable");if(d.code!=="Ok"||!d.routes?.length)throw new Error("route_not_found");return{distanceKm:Math.round(d.routes[0].distance/10)/100,durationMinutes:Math.max(1,Math.round(d.routes[0].duration/60)),destination:b}
}
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
  try{
    init(); const db=getFirestore(); const body=req.body||{};
    const slug=clean(body.slug), channel=body.channel, paymentMethod=body.paymentMethod;
    if(!slug||!["DELIVERY","PICKUP","TABLE"].includes(channel)||!["PIX","CASH","CARD_ON_DELIVERY"].includes(paymentMethod))return res.status(400).json({error:"invalid_order"});
    const name=clean(body.customer?.name),phone=clean(body.customer?.phone);
    if(name.length<2||phone.replace(/\D/g,"").length<10)return res.status(400).json({error:"invalid_customer"});
    if(channel==="DELIVERY"&&(!clean(body.delivery?.address)||!clean(body.delivery?.number)))return res.status(400).json({error:"invalid_address"});
    if(channel==="TABLE"&&!clean(body.table))return res.status(400).json({error:"invalid_table"});
    if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)return res.status(400).json({error:"invalid_items"});
    const slugDoc=await db.collection("restaurantSlugs").doc(slug).get();
    if(!slugDoc.exists||slugDoc.data().active===false)return res.status(404).json({error:"restaurant_not_found"});
    const restaurantId=slugDoc.data().restaurantId;
    const [restaurant,settings,deliveryConfig]=await Promise.all([db.collection("restaurants").doc(restaurantId).get(),db.collection("restaurants").doc(restaurantId).collection("settings").doc("public").get(),db.collection("restaurants").doc(restaurantId).collection("settings").doc("delivery").get()]);
    if(!restaurant.exists||restaurant.data().status!=="active"||!settings.exists||settings.data().published!==true)return res.status(403).json({error:"restaurant_unavailable"});
    let totalCents=0; const items=[];
    for(const raw of body.items){
      const qty=Number(raw.qty);
      if(!Number.isInteger(qty)||qty<1||qty>99)return res.status(400).json({error:"invalid_quantity"});
      const product=await db.collection("restaurants").doc(restaurantId).collection("products").doc(clean(raw.productId)).get();
      if(!product.exists||product.data().active===false)return res.status(400).json({error:"product_unavailable"});
      const p=product.data(),selected=[],groups=Array.isArray(p.optionGroups)?p.optionGroups:[];
      const incoming=Array.isArray(raw.options)?raw.options:[];
      for(const g of groups){
        const chosen=incoming.filter(o=>clean(o.group)===clean(g.name));
        if(g.required&&!chosen.length)return res.status(400).json({error:"required_option_missing"});
        if(chosen.length>Number(g.max||1))return res.status(400).json({error:"too_many_options"});
        for(const c of chosen){
          const valid=(g.options||[]).find(o=>clean(o.name)===clean(c.name));
          if(!valid)return res.status(400).json({error:"invalid_option"});
          selected.push({group:clean(g.name),name:clean(valid.name),priceCents:Number(valid.priceCents||0)});
        }
      }
      const unitPriceCents=Number(p.priceCents||0)+selected.reduce((n,o)=>n+o.priceCents,0);
      totalCents+=unitPriceCents*qty;
      items.push({productId:product.id,name:clean(p.name),qty,basePriceCents:Number(p.priceCents||0),unitPriceCents,options:selected,totalCents:unitPriceCents*qty});
    }
    if(totalCents<0||totalCents>100000000)return res.status(400).json({error:"invalid_total"});
    let deliveryFeeCents=0,originalDeliveryFeeCents=0,deliveryMeta=null;
    if(channel==="DELIVERY"){
      const cfg=deliveryConfig.exists?deliveryConfig.data():{},neighborhood=clean(body.delivery?.neighborhood),key=neighborhood.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
      if(cfg.mode!=="DISTANCE"&&!key)return res.status(400).json({error:"neighborhood_required"});
      const normalize=v=>clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
      if(cfg.mode==="DISTANCE"){
        const source=restaurant.data(),pub=settings.data();
        const street=clean(pub.address)||clean(source.address);
        const number=clean(pub.number)||clean(source.number);
        const city=clean(pub.city)||clean(source.city);
        const state=clean(pub.state)||clean(source.state);
        const neighborhoodOrigin=clean(pub.neighborhood)||clean(source.neighborhood);
        const embeddedNumber=/(?:^|[,\s])(?:n[º°.]?\s*)?\d{1,6}(?:\s*[-/]\s*[a-z0-9]+)?(?=\s*(?:,|-|$))/i.test(street);
        const originAddress=[street,number&&!embeddedNumber?number:"",neighborhoodOrigin,city,state,"Brasil"].filter(Boolean).join(", ");
        if(!street||(!number&&!embeddedNumber)||!city||!state)return res.status(422).json({error:"origin_address_incomplete"});
        const dest=body.delivery;
        if(!clean(dest.city)||!clean(dest.state)||!clean(dest.neighborhood))return res.status(422).json({error:"invalid_address"});
        const destinationAddress=[dest.address,dest.number,dest.neighborhood,dest.city,dest.state,"Brasil"].filter(Boolean).join(", ");
        const route=await serverRoute({address:originAddress},{address:destinationAddress});
        if(!Number.isFinite(route.distanceKm)||route.distanceKm<=0)return res.status(422).json({error:"route_not_found"});
        const ranges=await db.collection("restaurants").doc(restaurantId).collection("deliveryRanges").where("active","==",true).get();
        const match=ranges.docs.map(d=>({id:d.id,...d.data()})).filter(x=>Number.isFinite(Number(x.minKm))&&Number.isFinite(Number(x.maxKm))&&Number(x.maxKm)>Number(x.minKm)).sort((a,b)=>Number(a.minKm)-Number(b.minKm)).find(x=>route.distanceKm>=Number(x.minKm)&&route.distanceKm<=Number(x.maxKm));
        if(!match)return res.status(422).json({error:"outside_delivery_distance",distanceKm:route.distanceKm});
        if(totalCents<Number(match.minimumOrderCents||0))return res.status(422).json({error:"minimum_order",minimumOrderCents:Number(match.minimumOrderCents||0)});
        originalDeliveryFeeCents=Number(match.feeCents||0);
        if(!Number.isFinite(originalDeliveryFeeCents)||originalDeliveryFeeCents<0)return res.status(422).json({error:"invalid_delivery_fee"});
        const free=!!cfg.freeEnabled&&cfg.freeType==="RADIUS"&&route.distanceKm<=Number(cfg.freeMaxKm||0)&&totalCents>=Number(cfg.freeMinimumCents||0);
        deliveryFeeCents=free?0:originalDeliveryFeeCents;
        deliveryMeta={mode:"DISTANCE",distanceKm:route.distanceKm,routeMinutes:route.durationMinutes,rangeId:match.id,estimatedMinutes:Number(match.estimatedMinutes||0),freeShipping:free,originalFeeCents:originalDeliveryFeeCents};
      }else{
        const snap=await db.collection("restaurants").doc(restaurantId).collection("deliveryAreas").where("active","==",true).get();
        const area=snap.docs.map(d=>({id:d.id,...d.data()})).find(x=>normalize(x.neighborhoodKey||x.neighborhood)===key);
        if(!area)return res.status(422).json({error:"outside_delivery_area",neighborhood});
        if(totalCents<Number(area.minimumOrderCents||0))return res.status(422).json({error:"minimum_order",minimumOrderCents:Number(area.minimumOrderCents||0)});
        originalDeliveryFeeCents=Number(area.feeCents||0);
        const free=!!cfg.freeEnabled&&cfg.freeType==="NEIGHBORHOOD"&&totalCents>=Number(cfg.freeMinimumCents||0)&&key===normalize(cfg.freeNeighborhood);
        deliveryFeeCents=free?0:originalDeliveryFeeCents;
        deliveryMeta={mode:"NEIGHBORHOOD",neighborhood:area.neighborhood||neighborhood,areaId:area.id,estimatedMinutes:Number(area.estimatedMinutes||0),freeShipping:free,originalFeeCents:originalDeliveryFeeCents};
      }
    }
    const orderRef=db.collection("restaurants").doc(restaurantId).collection("orders").doc();
    const number=Date.now();
    try{
      const orderData=stripUndefined({number,channel,status:paymentMethod==="PIX"?"PENDING_PAYMENT":"RECEIVED",paymentStatus:"PENDING",paymentMethod,subtotalCents:totalCents,deliveryFeeCents,originalDeliveryFeeCents,totalCents:totalCents+deliveryFeeCents,customerSnapshot:{name,phone},deliverySnapshot:channel==="DELIVERY"?{cep:clean(body.delivery.cep),address:clean(body.delivery.address),number:clean(body.delivery.number),complement:clean(body.delivery.complement),neighborhood:clean(body.delivery.neighborhood),city:clean(body.delivery.city),state:clean(body.delivery.state),latitude:null,longitude:null,...deliveryMeta}:null,table:channel==="TABLE"?clean(body.table):null,items,source:"PUBLIC_MENU",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
      await orderRef.set(orderData);
    }catch(err){
      console.error("order-write",{name:err?.name,message:err?.message,code:err?.code,stack:err?.stack});
      const e=new Error("order_write_failed");
      e.firestoreCode=String(err?.code||err?.name||"unknown");
      e.writeMessage=String(err?.message||"unknown").slice(0,180);
      throw e;
    }
    return res.status(201).json({ok:true,orderId:orderRef.id,number,subtotalCents:totalCents,deliveryFeeCents,originalDeliveryFeeCents,totalCents:totalCents+deliveryFeeCents,paymentMethod,status:paymentMethod==="PIX"?"PENDING_PAYMENT":"RECEIVED"});
  }catch(e){console.error("create-order",e);const code=e?.message||"internal_error";const known=["address_not_found","route_not_found","geocoder_unavailable","routing_unavailable","order_write_failed","origin_address_incomplete"];const safe=known.includes(code)?code:code==="Firebase Admin não configurado"?"firebase_admin_not_configured":"internal_error";return res.status(safe==="origin_address_incomplete"?422:safe==="internal_error"?500:502).json({error:safe,...(code==="order_write_failed"?{firestoreCode:e.firestoreCode||"unknown",writeMessage:e.writeMessage||"unknown"}:{})})}
}