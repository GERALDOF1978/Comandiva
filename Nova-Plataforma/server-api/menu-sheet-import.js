import {cert,getApps,initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
function adminApp(){if(getApps().length)return getApps()[0];const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL,privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,"\n");if(!projectId||!clientEmail||!privateKey)throw Error("firebase_not_configured");return initializeApp({credential:cert({projectId,clientEmail,privateKey})})}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
  const h=req.headers.authorization||"";if(!h.startsWith("Bearer "))return res.status(401).json({error:"Faça login novamente."});
  const {restaurantId,sheetId}=req.body||{};if(typeof restaurantId!=="string"||!/^[A-Za-z0-9_-]{5,128}$/.test(restaurantId)||typeof sheetId!=="string"||!/^[A-Za-z0-9_-]{10,150}$/.test(sheetId))return res.status(400).json({error:"Link inválido."});
  try{adminApp();let user;try{user=await getAuth().verifyIdToken(h.slice(7),true)}catch{return res.status(401).json({error:"Faça login novamente."})}
    const member=await getFirestore().doc("restaurants/"+restaurantId+"/members/"+user.uid).get();if(!member.exists||member.data().active!==true||!["owner","manager"].includes(member.data().role))return res.status(403).json({error:"Sem permissão de importar neste estabelecimento."});
    let url=new URL("https://docs.google.com/spreadsheets/d/"+sheetId+"/export?format=xlsx"),response;const signal=AbortSignal.timeout(10000);
    for(let i=0;i<5;i++){response=await fetch(url,{redirect:"manual",signal});if(![301,302,303,307,308].includes(response.status))break;const location=response.headers.get("location");if(!location)throw Error("redirect");const next=new URL(location,url);if(next.protocol!=="https:"||next.username||next.password||!(next.hostname==="docs.google.com"||next.hostname.endsWith(".googleusercontent.com")))return res.status(400).json({error:"A planilha precisa permitir leitura por quem tem o link. Ou baixe o Excel e envie o arquivo."});url=next}
    if(!response?.ok||!response.body)return res.status(400).json({error:"Não foi possível abrir a planilha. Verifique a permissão de leitura do link ou envie o Excel."});
    const max=4*1024*1024;if(Number(response.headers.get("content-length"))>max)return res.status(413).json({error:"Planilha maior que 4 MB."});const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();return res.status(413).json({error:"Planilha maior que 4 MB."})}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}
    const data=Buffer.concat(chunks);if(data.length<4||data.readUInt32LE(0)!==0x04034b50)return res.status(400).json({error:"O Google não disponibilizou o Excel. Verifique a permissão ou envie o arquivo baixado."});
    res.setHeader("Content-Type","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");res.status(200);return res.end(data);
  }catch(e){console.error("menu-sheet-import",e?.name);return res.status(502).json({error:"Falha ao consultar o Google Planilhas. Baixe a planilha em Excel e envie o arquivo."})}
}
