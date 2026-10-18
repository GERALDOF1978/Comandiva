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
async function serverRoute(origin,destination){
 const routeBase=process.env.ROUTING_BASE_URL||"https://router.project-osrm.org",geoBase=process.env.GEOCODER_BASE_URL||"https://nominatim.openstreetmap.org";
 async function point(p,address){if(n(p?.latitude)!==null&&n(p?.longitude)!==null)return{latitude:n(p.latitude),longitude:n(p.longitude)};const r=await fetch(geoBase+"/search?format=jsonv2&limit=1&countrycodes=br&q="+encodeURIComponent(address),{headers:{"User-Agent":"SaaS-Delivery/1.0 (+https://agendaaki.shop)","Accept-Language":"pt-BR"}}),d=await r.json();if(!r.ok||!d?.length)throw new Error("address_not_found");return{latitude:Number(d[0].lat),longitude:Number(d[0].lon)}}
 const a=await point(origin,origin.address),b=await point(destination,destination.address),r=await fetch(routeBase+"/route/v1/driving/"+a.longitude+","+a.latitude+";"+b.longitude+","+b.latitude+"?overview=false",{headers:{"User-Agent":"SaaS-Delivery/1.0 (+https://agendaaki.shop)"}}),d=await r.json();if(!r.ok||d.code!=="Ok"||!d.routes?.length)throw new Error("route_not_found");return{distanceKm:Math.round(d.routes[0].distance/10)/100,durationMinutes:Math.max(1,Math.round(d.routes[0].duration/60)),destination:b}
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
      const cfg=deliveryConfig.exists?deliveryConfig.data():{mode:"NEIGHBORHOOD"},neighborhood=clean(body.delivery?.neighborhood),key=neighborhood.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
      let distanceKm=null,verifiedDestination=null,routeDurationMinutes=null;
      if(cfg.mode==="DISTANCE"||(cfg.freeEnabled&&cfg.freeType==="RADIUS")){
        const origin={latitude:settings.data().latitude,longitude:settings.data().longitude,address:clean(settings.data().address)},destination={latitude:body.delivery?.latitude,longitude:body.delivery?.longitude,address:[clean(body.delivery?.address),clean(body.delivery?.number),neighborhood,clean(body.delivery?.city),clean(body.delivery?.state),clean(body.delivery?.cep),"Brasil"].filter(Boolean).join(", ")};
        const route=await serverRoute(origin,destination);distanceKm=route.distanceKm;verifiedDestination=route.destination;routeDurationMinutes=route.durationMinutes;
      }
      if(cfg.mode==="DISTANCE"){
        if(!Number.isFinite(distanceKm)||distanceKm<0)return res.status(400).json({error:"distance_required"});
        const snap=await db.collection("restaurants").doc(restaurantId).collection("deliveryRanges").where("active","==",true).get();
        const range=snap.docs.map(d=>({id:d.id,...d.data()})).find(x=>distanceKm>=Number(x.minKm)&&distanceKm<=Number(x.maxKm));
        if(!range)return res.status(422).json({error:"outside_delivery_area"});
        if(totalCents<Number(range.minimumOrderCents||0))return res.status(422).json({error:"minimum_order",minimumOrderCents:Number(range.minimumOrderCents||0)});
        originalDeliveryFeeCents=Number(range.feeCents||0);deliveryMeta={mode:"DISTANCE",distanceKm,routeDurationMinutes,rangeId:range.id,estimatedMinutes:Number(range.estimatedMinutes||0)};
      }else{
        if(!key)return res.status(400).json({error:"neighborhood_required"});
        const snap=await db.collection("restaurants").doc(restaurantId).collection("deliveryAreas").where("active","==",true).get();
        const area=snap.docs.map(d=>({id:d.id,...d.data()})).find(x=>clean(x.neighborhoodKey)===key);
        if(!area)return res.status(422).json({error:"outside_delivery_area"});
        if(totalCents<Number(area.minimumOrderCents||0))return res.status(422).json({error:"minimum_order",minimumOrderCents:Number(area.minimumOrderCents||0)});
        originalDeliveryFeeCents=Number(area.feeCents||0);deliveryMeta={mode:"NEIGHBORHOOD",neighborhood,areaId:area.id,estimatedMinutes:Number(area.estimatedMinutes||0)};
      }
      let free=false;if(cfg.freeEnabled&&totalCents>=Number(cfg.freeMinimumCents||0)){if(cfg.freeType==="RADIUS"&&Number.isFinite(distanceKm)&&distanceKm<=Number(cfg.freeMaxKm||0))free=true;if(cfg.freeType==="NEIGHBORHOOD"&&key&&key===clean(cfg.freeNeighborhood).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim())free=true}
      deliveryFeeCents=free?0:originalDeliveryFeeCents;deliveryMeta={...deliveryMeta,freeShipping:free,originalFeeCents:originalDeliveryFeeCents};
    }
    const counter=db.collection("restaurants").doc(restaurantId).collection("counters").doc("orders");
    const orderRef=db.collection("restaurants").doc(restaurantId).collection("orders").doc();
    const number=await db.runTransaction(async tx=>{const c=await tx.get(counter);const next=(c.exists?Number(c.data().value||0):0)+1;tx.set(counter,{value:next,updatedAt:FieldValue.serverTimestamp()},{merge:true});tx.create(orderRef,{number:next,channel,status:paymentMethod==="PIX"?"PENDING_PAYMENT":"RECEIVED",paymentStatus:"PENDING",paymentMethod,subtotalCents:totalCents,deliveryFeeCents,originalDeliveryFeeCents,totalCents:totalCents+deliveryFeeCents,customerSnapshot:{name,phone},deliverySnapshot:channel==="DELIVERY"?{cep:clean(body.delivery.cep),address:clean(body.delivery.address),number:clean(body.delivery.number),complement:clean(body.delivery.complement),neighborhood:clean(body.delivery.neighborhood),city:clean(body.delivery.city),state:clean(body.delivery.state),latitude:verifiedDestination?.latitude??(Number.isFinite(Number(body.delivery.latitude))?Number(body.delivery.latitude):null),longitude:verifiedDestination?.longitude??(Number.isFinite(Number(body.delivery.longitude))?Number(body.delivery.longitude):null),...deliveryMeta}:null,table:channel==="TABLE"?clean(body.table):null,items,source:"PUBLIC_MENU",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});return next});
    return res.status(201).json({ok:true,orderId:orderRef.id,number,subtotalCents:totalCents,deliveryFeeCents,originalDeliveryFeeCents,totalCents:totalCents+deliveryFeeCents,paymentMethod,status:paymentMethod==="PIX"?"PENDING_PAYMENT":"RECEIVED"});
  }catch(e){console.error("create-order",e);return res.status(500).json({error:"internal_error"})}
}