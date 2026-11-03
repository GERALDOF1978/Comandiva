// Regras únicas de acesso comercial. Não grava cobrança nem altera pedidos existentes.
export const NEW_TRIAL_DAYS=180;
export function subscriptionAccess(record,now=Date.now()){
 if(!record||typeof record!=="object")return {allowed:false,error:"subscription_unavailable"};
 if(record.status==="active"&&record.planId!=="trial")return {allowed:true,status:"active"};
 if(record.status!=="trial"||record.planId!=="trial")return {allowed:false,error:"subscription_inactive"};
 const raw=record.trialEndsAt;
 const expiration=raw instanceof Date?raw.getTime()
  :typeof raw?.toMillis==="function"?raw.toMillis()
  :typeof raw?.toDate==="function"?raw.toDate().getTime()
  :typeof raw==="string"?Date.parse(raw)
  :typeof raw?.seconds==="number"?raw.seconds*1000:NaN;
 if(!Number.isFinite(expiration))return {allowed:false,error:"subscription_unavailable"};
 return expiration>now?{allowed:true,status:"trial",trialEndsAt:expiration}:{allowed:false,error:"subscription_expired",trialEndsAt:expiration};
}
export async function restaurantMayReceiveOrders(db,restaurantId,now=Date.now()){
 const snapshot=await db.collection("subscriptions").doc(restaurantId).get();
 // Compatibilidade: estabelecimentos criados antes do módulo de planos podem não ter
 // documento de assinatura. Não interromper os pedidos atuais; o Master deve migrá-los.
 if(!snapshot.exists)return {allowed:true,status:"legacy_without_subscription"};
 return subscriptionAccess(snapshot.data(),now);
}
