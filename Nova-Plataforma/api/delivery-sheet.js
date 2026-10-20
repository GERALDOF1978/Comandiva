import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

function init(){
  if(getApps().length)return;
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey)throw new Error("Firebase Admin não configurado");
  initializeApp({credential:cert({projectId,clientEmail,privateKey})});
}
const clean=v=>String(v??"").trim();

async function sheetGet(base,restaurantId,secret,action="getDeliveryTable",city="",state=""){
  const url=new URL(base);
  url.searchParams.set("action",action);
  if(city)url.searchParams.set("city",city);
  if(state)url.searchParams.set("state",state);
  url.searchParams.set("restaurantId",restaurantId);
  if(secret)url.searchParams.set("token",secret);
  const r=await fetch(url.toString(),{redirect:"follow"});
  const text=await r.text();
  let data={};
  try{data=JSON.parse(text)}catch{throw new Error("invalid_sheet_response")}
  return{ok:r.ok&&data.ok!==false,data};
}

async function createSheet(base,payload,secret){
  const body={action:"createRestaurant",...payload};
  if(secret)body.token=secret;
  const r=await fetch(base,{method:"POST",redirect:"follow",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body)});
  const text=await r.text();let data={};
  try{data=JSON.parse(text)}catch{throw new Error("invalid_sheet_response")}
  if(!r.ok||data.ok===false)throw new Error(data.error||"sheet_create_failed");
  return data;
}

export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"method_not_allowed"});
  const restaurantId=clean(req.query?.restaurantId);
  const action=clean(req.query?.action)||"getDeliveryTable";
  const city=clean(req.query?.city),state=clean(req.query?.state);
  if(action!=="getDeliveryTable"&&action!=="getCityNeighborhoods"&&action!=="listCities")return res.status(400).json({error:"invalid_action"});
  if(action==="getCityNeighborhoods"&&!city)return res.status(400).json({error:"city_required"});
  if(action==="getDeliveryTable"&&!restaurantId)return res.status(400).json({error:"restaurant_required"});
  const base=process.env.DELIVERY_SHEETS_WEBAPP_URL,secret=process.env.DELIVERY_SHEETS_SECRET;
  if(!base)return res.status(503).json({error:"sheet_not_configured"});
  try{
    let result=await sheetGet(base,restaurantId,secret,action,city,state);
    if(action==="listCities"){if(!result.ok)return res.status(502).json({error:result.data?.error||"sheet_request_failed"});return res.status(200).json({cities:Array.isArray(result.data.cities)?result.data.cities:[]});}\n    if(action==="getCityNeighborhoods"){
      if(!result.ok)return res.status(502).json({error:result.data?.error||"sheet_request_failed"});
      return res.status(200).json({city,state,neighborhoods:Array.isArray(result.data.neighborhoods)?result.data.neighborhoods:[]});
    }
    if(!result.ok&&result.data?.error==="restaurant_not_found"){
      init();const db=getFirestore();
      const [restaurantSnap,publicSnap]=await Promise.all([
        db.doc("restaurants/"+restaurantId).get(),
        db.doc("restaurants/"+restaurantId+"/settings/public").get()
      ]);
      if(!restaurantSnap.exists)return res.status(404).json({error:"restaurant_not_found"});
      const restaurant=restaurantSnap.data()||{},pub=publicSnap.data()||{};
      const restaurantName=clean(pub.name||restaurant.name||restaurant.displayName||"Estabelecimento");
      const city=clean(pub.city||restaurant.city),state=clean(pub.state||restaurant.state);
      const address=clean([pub.address||restaurant.address,pub.number||restaurant.number,pub.neighborhood||restaurant.neighborhood,city,state].filter(Boolean).join(", "));
      await createSheet(base,{restaurantId,restaurantName,city,state,address},secret);
      result=await sheetGet(base,restaurantId,secret);
    }
    if(!result.ok)return res.status(result.data?.error==="restaurant_not_found"?404:502).json({error:result.data?.error||"sheet_request_failed"});
    const neighborhoods=Array.isArray(result.data.neighborhoods)?result.data.neighborhoods:[];
    return res.status(200).json({restaurantId,restaurantName:result.data.restaurantName||"",city:result.data.city||"",state:result.data.state||"",neighborhoods});
  }catch(e){
    console.error("delivery-sheet",e);
    return res.status(502).json({error:e.message||"sheet_unavailable"});
  }
}
