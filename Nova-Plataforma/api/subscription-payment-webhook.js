import {getBillingDb,confirmBillingPayment} from "./_subscription-billing.js";
// A InfinitePay não assina webhooks. Nunca confiar no payload como prova de pagamento.
// O payment_check é obrigatório e a assinatura é atualizada em transação idempotente.
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({error:"method_not_allowed"});
 res.setHeader("Cache-Control","no-store");
 try{
  const body=req.body&&typeof req.body==="object"?req.body:{};
  const payment=body.data&&typeof body.data==="object"?body.data:body;
  const orderNsu=String(payment.order_nsu||""),slug=String(payment.invoice_slug||payment.slug||""),transactionNsu=String(payment.transaction_nsu||"");
  if(!orderNsu.startsWith("dishy-sub-")||!slug||!transactionNsu)return res.status(400).json({error:"invalid_payment_event"});
  const result=await confirmBillingPayment(getBillingDb(),{orderNsu,slug,transactionNsu});
  if(!result.ok)return res.status(result.code==="payment_not_verified"?409:400).json({error:result.code});
  return res.status(200).json({ok:true,invoiceId:result.invoiceId,activated:result.activated===true,reviewRequired:result.needsReview===true});
 }catch{
  return res.status(503).json({error:"verification_unavailable"});
 }
}
