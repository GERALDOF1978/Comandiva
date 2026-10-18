import admin from "firebase-admin";

function getAdmin(){
  if(admin.apps.length) return admin.app();
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");
  if(!projectId||!clientEmail||!privateKey) throw new Error("Firebase Admin não configurado");
  return admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey})});
}
function slugify(v){return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)}
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"method_not_allowed"});
  try{
    getAdmin();
    const authHeader=req.headers.authorization||"";
    if(!authHeader.startsWith("Bearer ")) return res.status(401).json({error:"unauthorized"});
    const decoded=await admin.auth().verifyIdToken(authHeader.slice(7),true);
    if(!decoded.email) return res.status(400).json({error:"email_required"});
    const {name,type,phone}=req.body||{};
    if(typeof name!=="string"||name.trim().length<3||name.trim().length>100) return res.status(400).json({error:"invalid_name"});
    if(typeof type!=="string"||!["restaurant","pizzeria","snack_bar","marmitaria","bar","bakery","other"].includes(type)) return res.status(400).json({error:"invalid_type"});
    if(typeof phone!=="string"||phone.replace(/\D/g,"").length<10||phone.replace(/\D/g,"").length>13) return res.status(400).json({error:"invalid_phone"});

    const db=admin.firestore();
    const existing=await db.collection("userRestaurantAccess").doc(decoded.uid).collection("restaurants").limit(1).get();
    if(!existing.empty) return res.status(409).json({error:"account_already_linked"});

    const restaurantRef=db.collection("restaurants").doc();
    const base=slugify(name)||"estabelecimento";
    let slug=base;
    let n=1;
    while((await db.collection("restaurantSlugs").doc(slug).get()).exists){slug=`${base}-${++n}`}

    const now=admin.firestore.FieldValue.serverTimestamp();
    const batch=db.batch();
    batch.create(restaurantRef,{name:name.trim(),type,phone:phone.trim(),slug,status:"active",ownerUid:decoded.uid,planId:"trial",createdAt:now,updatedAt:now});
    batch.create(restaurantRef.collection("members").doc(decoded.uid),{uid:decoded.uid,email:decoded.email,name:decoded.name||"",role:"owner",active:true,createdAt:now});
    batch.create(db.collection("userRestaurantAccess").doc(decoded.uid).collection("restaurants").doc(restaurantRef.id),{restaurantId:restaurantRef.id,restaurantName:name.trim(),role:"owner",active:true,createdAt:now});
    batch.create(db.collection("restaurantSlugs").doc(slug),{restaurantId:restaurantRef.id,active:true,createdAt:now});
    batch.create(restaurantRef.collection("settings").doc("public"),{name:name.trim(),type,phone:phone.trim(),slug,published:false,createdAt:now,updatedAt:now});
    batch.create(db.collection("subscriptions").doc(restaurantRef.id),{restaurantId:restaurantRef.id,planId:"trial",status:"trial",createdAt:now});
    batch.create(restaurantRef.collection("audit").doc(),{action:"RESTAURANT_CREATED",actorUid:decoded.uid,actorEmail:decoded.email,createdAt:now});
    await batch.commit();
    return res.status(201).json({ok:true,restaurantId:restaurantRef.id,slug});
  }catch(e){
    console.error("create-restaurant",e);
    return res.status(500).json({error:"internal_error"});
  }
}