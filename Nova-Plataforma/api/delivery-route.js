const clean=v=>typeof v==="string"?v.trim():"";
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
async function geocodeAddress(q){
  const base=process.env.GEOCODER_BASE_URL||"https://nominatim.openstreetmap.org";
  const u=base+"/search?format=jsonv2&limit=1&countrycodes=br&q="+encodeURIComponent(q);
  const r=await fetch(u,{headers:{"User-Agent":"SaaS-Delivery/1.0 (+https://agendaaki.shop)","Accept-Language":"pt-BR"}});
  if(!r.ok)throw new Error("geocoder_unavailable");const d=await r.json();if(!d?.length)throw new Error("address_not_found");
  return{latitude:Number(d[0].lat),longitude:Number(d[0].lon),displayName:d[0].display_name};
}
async function routeDistance(a,b){
  const base=process.env.ROUTING_BASE_URL||"https://router.project-osrm.org";
  const u=base+"/route/v1/driving/"+a.longitude+","+a.latitude+";"+b.longitude+","+b.latitude+"?overview=false&steps=false";
  const r=await fetch(u,{headers:{"User-Agent":"SaaS-Delivery/1.0 (+https://agendaaki.shop)"}});
  if(!r.ok)throw new Error("routing_unavailable");const d=await r.json();if(d.code!=="Ok"||!d.routes?.length)throw new Error("route_not_found");
  return{distanceKm:Math.round((d.routes[0].distance/1000)*100)/100,durationMinutes:Math.max(1,Math.round(d.routes[0].duration/60))};
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
 try{
  const b=req.body||{},origin={latitude:num(b.origin?.latitude),longitude:num(b.origin?.longitude)},dest={latitude:num(b.destination?.latitude),longitude:num(b.destination?.longitude)};
  let o=origin,d=dest;
  if(o.latitude===null||o.longitude===null){const q=clean(b.origin?.address);if(!q)return res.status(400).json({error:"origin_required"});o=await geocodeAddress(q)}
  if(d.latitude===null||d.longitude===null){const q=clean(b.destination?.address);if(!q)return res.status(400).json({error:"destination_required"});d=await geocodeAddress(q)}
  const route=await routeDistance(o,d);return res.status(200).json({ok:true,...route,origin:{latitude:o.latitude,longitude:o.longitude},destination:{latitude:d.latitude,longitude:d.longitude}});
 }catch(e){console.error("delivery-route",e);const x=e.message;return res.status(x==="address_not_found"||x==="route_not_found"?422:502).json({error:x||"route_error"})}
}