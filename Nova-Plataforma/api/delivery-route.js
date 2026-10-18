const clean=v=>typeof v==="string"?v.trim():"";
const num=v=>{if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null};
const baseGeo=()=>process.env.GEOCODER_BASE_URL||"https://nominatim.openstreetmap.org";
const headers={"User-Agent":"SaaS-Delivery/1.0","Accept-Language":"pt-BR"};
async function geocodeAddress(q){
  const queries=Array.isArray(q)?q:[q];
  for(const raw of queries){
    const text=clean(raw);if(!text)continue;
    const r=await fetch(baseGeo()+"/search?format=jsonv2&limit=1&countrycodes=br&q="+encodeURIComponent(text),{headers});
    if(!r.ok)throw new Error("geocoder_unavailable");
    const d=await r.json();
    if(d?.length)return{latitude:Number(d[0].lat),longitude:Number(d[0].lon),displayName:d[0].display_name};
  }
  throw new Error("address_not_found");
}
async function reversePoint(latitude,longitude){
  const r=await fetch(baseGeo()+"/reverse?format=jsonv2&zoom=18&addressdetails=1&lat="+encodeURIComponent(latitude)+"&lon="+encodeURIComponent(longitude),{headers});
  if(!r.ok)throw new Error("geocoder_unavailable");
  const d=await r.json();if(d.error)throw new Error("address_not_found");
  const a=d.address||{};
  return{latitude:Number(d.lat),longitude:Number(d.lon),address:a.road||a.pedestrian||a.residential||a.footway||"",number:a.house_number||"",neighborhood:a.suburb||a.neighbourhood||a.quarter||a.city_district||"",city:a.city||a.town||a.municipality||a.village||"",state:a.state_code||a.state||"",cep:a.postcode||"",displayName:d.display_name||""};
}
async function routeDistance(a,b){
  const base=process.env.ROUTING_BASE_URL||"https://router.project-osrm.org";
  const r=await fetch(base+"/route/v1/driving/"+a.longitude+","+a.latitude+";"+b.longitude+","+b.latitude+"?overview=false&steps=false",{headers});
  if(!r.ok)throw new Error("routing_unavailable");
  const d=await r.json();if(d.code!=="Ok"||!d.routes?.length)throw new Error("route_not_found");
  return{distanceKm:Math.round((d.routes[0].distance/1000)*100)/100,durationMinutes:Math.max(1,Math.round(d.routes[0].duration/60))};
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
 try{
  const b=req.body||{};
  if(b.action==="reverse"){
    const lat=num(b.latitude),lon=num(b.longitude);
    if(lat===null||lon===null||lat<-90||lat>90||lon<-180||lon>180)return res.status(400).json({error:"invalid_coordinates"});
    try{return res.status(200).json({ok:true,...await reversePoint(lat,lon)})}catch(e){return res.status(e.message==="address_not_found"?422:502).json({error:e.message})}
  }
  const origin={latitude:num(b.origin?.latitude),longitude:num(b.origin?.longitude)},dest={latitude:num(b.destination?.latitude),longitude:num(b.destination?.longitude)};
  let o=origin,d=dest;
  if(o.latitude===null||o.longitude===null){const q=clean(b.origin?.address);if(!q)return res.status(400).json({error:"origin_required"});try{o=await geocodeAddress(q)}catch(e){return res.status(e.message==="address_not_found"?422:502).json({error:e.message==="address_not_found"?"origin_not_found":"geocoder_unavailable"})}}
  if(d.latitude===null||d.longitude===null){const q=clean(b.destination?.address),fallbacks=Array.isArray(b.destination?.fallbackAddresses)?b.destination.fallbackAddresses:[];if(!q&&!fallbacks.length)return res.status(400).json({error:"destination_required"});try{d=await geocodeAddress([q,...fallbacks])}catch(e){return res.status(e.message==="address_not_found"?422:502).json({error:e.message==="address_not_found"?"destination_not_found":"geocoder_unavailable"})}}
  const route=await routeDistance(o,d);
  return res.status(200).json({ok:true,...route,origin:{latitude:o.latitude,longitude:o.longitude},destination:{latitude:d.latitude,longitude:d.longitude}});
 }catch(e){console.error("delivery-route",e);const x=e.message;return res.status(x==="address_not_found"||x==="route_not_found"?422:502).json({error:x||"route_error"})}
}