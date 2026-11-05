import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";

const HOST="https://merchant-api.ifood.com.br";
let tokenCache={accessToken:"",until:0};

function admin(){
  if(getApps().length)return getApps()[0];
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey)throw Error("firebase_not_configured");
  return initializeApp({credential:cert({projectId,clientEmail,privateKey})});
}

async function accessToken(force=false){
  if(!force&&tokenCache.until>Date.now()+60000&&tokenCache.accessToken)return tokenCache.accessToken;
  if(!process.env.IFOOD_CLIENT_ID||!process.env.IFOOD_CLIENT_SECRET)throw Error("ifood_not_configured");
  const body=new URLSearchParams({grantType:"client_credentials",clientId:process.env.IFOOD_CLIENT_ID,clientSecret:process.env.IFOOD_CLIENT_SECRET});
  const response=await fetch(HOST+"/authentication/v1.0/oauth/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},
    body:body.toString(),signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw Error("ifood_auth_failed");
  const data=await response.json();
  if(!data.accessToken||typeof data.accessToken!=="string")throw Error("ifood_auth_failed");
  const ttl=Math.min(21600,Math.max(120,Number(data.expiresIn)||3600));
  tokenCache={accessToken:data.accessToken,until:Date.now()+ttl*1000};
  return tokenCache.accessToken;
}

async function ifoodGet(path,retry=true){
  const token=await accessToken();
  const response=await fetch(HOST+path,{
    headers:{Authorization:"Bearer "+token,Accept:"application/json"},
    signal:AbortSignal.timeout(15000)
  });
  if(response.status===401&&retry){await accessToken(true);return ifoodGet(path,false);}
  if(response.status===403)throw Error("ifood_store_not_authorized");
  if(!response.ok)throw Error("ifood_catalog_unavailable");
  return response.json();
}

function mapForTenant(id){
  // Whitelist configured by platform operator. Restaurant owners cannot select an unrelated merchant ID.
  let data;
  try {data=JSON.parse(process.env.IFOOD_RESTAURANT_MERCHANT_MAP||"{}");}
  catch{throw Error("ifood_mapping_invalid");}
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error("ifood_mapping_invalid");
  const merchantId=String(Object.prototype.hasOwnProperty.call(data,id)?data[id]:"");
  return /^[a-f0-9]{8}-[a-f0-9-]{27,36}$/i.test(merchantId)?merchantId:"";
}

function categoryList(data){
  const value=Array.isArray(data)?data:Array.isArray(data?.categories)?data.categories:Array.isArray(data?.data?.categories)?data.data.categories:[];
  return value.filter(c=>c&&typeof c==="object"&&c.id&&c.name).slice(0,100);
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","private, no-store");
  if(req.method!=="GET")return res.status(405).json({error:"method_not_allowed"});
  const restaurantId=String(req.query?.restaurantId||"");
  if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId))return res.status(400).json({error:"invalid_restaurant"});
  try{
    admin();
    const auth=String(req.headers.authorization||"");
    if(!auth.startsWith("Bearer "))return res.status(401).json({error:"unauthorized"});
    const user=await getAuth().verifyIdToken(auth.slice(7),true);
    const db=getFirestore();
    const restaurant=await db.collection("restaurants").doc(restaurantId).get();
    if(!restaurant.exists)return res.status(404).json({error:"restaurant_not_found"});
    const membership=await db.collection("restaurants").doc(restaurantId).collection("members").doc(user.uid).get();
    const owner=restaurant.data()?.ownerUid===user.uid||(membership.exists&&membership.data()?.active===true&&membership.data()?.role==="owner");
    if(!owner)return res.status(403).json({error:"owner_only"});
    if(!process.env.IFOOD_CLIENT_ID||!process.env.IFOOD_CLIENT_SECRET)return res.status(503).json({error:"ifood_not_configured"});
    const merchantId=mapForTenant(restaurantId);
    if(!merchantId)return res.status(409).json({error:"ifood_store_not_linked"});
    const categories=categoryList(await ifoodGet("/catalog/v2.0/merchants/"+encodeURIComponent(merchantId)+"/categories?include_items=true"));
    if(!categories.length)return res.status(200).json({source:"ifood",merchantId,categories:[],count:0});
    // Read-only API. No edits are made to either iFood or Dishy.
    const result=[];
    for(const category of categories){
      let items=Array.isArray(category.items)?category.items:null;
      if(!items){
        const payload=await ifoodGet("/catalog/v2.0/merchants/"+encodeURIComponent(merchantId)+"/categories/"+encodeURIComponent(String(category.id))+"/items");
        items=Array.isArray(payload)?payload:Array.isArray(payload?.items)?payload.items:Array.isArray(payload?.data)?payload.data:[];
      }
      if(items.length>500)throw Error("ifood_catalog_too_large");
      result.push({id:String(category.id),name:String(category.name).slice(0,140),template:category.template||"DEFAULT",items});
    }
    return res.status(200).json({source:"ifood",merchantId,categories:result,count:result.reduce((sum,c)=>sum+c.items.length,0)});
  }catch(e){
    const error=String(e?.message||"");
    const status=error==="ifood_store_not_authorized"?403:error==="ifood_not_configured"||error==="firebase_not_configured"?503:error==="ifood_mapping_invalid"?500:502;
    const exposed=["ifood_store_not_authorized","ifood_not_configured","ifood_auth_failed","ifood_catalog_unavailable","ifood_catalog_too_large","ifood_mapping_invalid"].includes(error)?error:"ifood_connection_failed";
    return res.status(status).json({error:exposed});
  }
}
