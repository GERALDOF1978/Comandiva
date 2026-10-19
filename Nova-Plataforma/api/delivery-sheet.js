export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"method_not_allowed"});
  const restaurantId=String(req.query?.restaurantId||"").trim();
  if(!restaurantId)return res.status(400).json({error:"restaurant_required"});
  const base=process.env.DELIVERY_SHEETS_WEBAPP_URL;
  const secret=process.env.DELIVERY_SHEETS_SECRET;
  if(!base)return res.status(503).json({error:"sheet_not_configured"});
  try{
    const url=new URL(base);
    url.searchParams.set("action","getDeliveryTable");
    url.searchParams.set("restaurantId",restaurantId);
    if(secret)url.searchParams.set("token",secret);
    const r=await fetch(url.toString(),{redirect:"follow"});
    const text=await r.text();let data={};
    try{data=JSON.parse(text)}catch{return res.status(502).json({error:"invalid_sheet_response"})}
    if(!r.ok||data.ok===false)return res.status(502).json({error:data.error||"sheet_request_failed"});
    const neighborhoods=Array.isArray(data.neighborhoods)?data.neighborhoods:[];
    return res.status(200).json({restaurantId,restaurantName:data.restaurantName||"",neighborhoods});
  }catch(e){
    console.error("delivery-sheet",e);
    return res.status(502).json({error:"sheet_unavailable"});
  }
}
