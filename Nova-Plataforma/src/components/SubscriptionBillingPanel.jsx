import React,{useEffect,useState} from "react";

const statuses={
 pending:"Aguardando pagamento",creating:"Preparando checkout",
 error:"Falha ao criar checkout",paid:"Pago",
 paid_needs_review:"Pagamento em conferência",canceled:"Cancelado"
};
export default function SubscriptionBillingPanel({user,membership}){
 const [invoices,setInvoices]=useState([]),[enabled,setEnabled]=useState(false);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const restaurantId=membership.restaurantId;
 async function refresh(){
  try{
   const token=await user.getIdToken();
   const r=await fetch("/api/subscription-billing?restaurantId="+encodeURIComponent(restaurantId),{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error("Não foi possível consultar as mensalidades.");
   setInvoices(Array.isArray(data.invoices)?data.invoices:[]);
   setEnabled(data.enabled===true);setError("");
  }catch(e){setError(e.message)}finally{setLoading(false)}
 }
 useEffect(()=>{refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer)},[user.uid,restaurantId]);
 const format=cent=>((Number(cent)||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 return <section style={{marginTop:22}} aria-label="Mensalidades e pagamentos">
  <h3>Mensalidades e pagamentos</h3>
  <p style={{color:"#aebacb"}}>Pagamentos por PIX ou cartão na InfinitePay. A renovação é por uma cobrança nova; não há débito automático no cartão.</p>
  {loading?<p>Consultando mensalidades...</p>:invoices.length===0?<p>{enabled?"Nenhuma mensalidade emitida. Escolha um plano, leia e aceite o contrato.":"As cobranças serão liberadas depois da configuração comercial da conta responsável."}</p>:
  <div style={{display:"grid",gap:10}}>
   {invoices.map(invoice=><article key={invoice.id} style={{border:"1px solid #42516a",borderRadius:12,padding:14,display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
    <div><strong>{invoice.planName} · {format(invoice.priceCents)}</strong><p style={{margin:"4px 0",fontSize:13}}>{statuses[invoice.status]||invoice.status}</p>
     {invoice.status==="paid"&&invoice.periodEndAt&&<small>Próximo vencimento: {new Date(invoice.periodEndAt).toLocaleDateString("pt-BR")}</small>}
    </div>
    {invoice.status==="pending"&&invoice.checkoutUrl&&invoice.expiresAtMs>Date.now()&&<a href={invoice.checkoutUrl} target="_blank" rel="noreferrer" style={{background:"#ff8200",color:"#1b1b1b",fontWeight:800,padding:"11px 14px",borderRadius:9}}>Abrir pagamento</a>}
   </article>)}
  </div>}
  {error&&<p role="alert" style={{color:"#fbb"}}>{error}</p>}
  <button type="button" onClick={refresh} style={{marginTop:12,padding:"9px 13px",border:"1px solid #51627b",borderRadius:8,background:"transparent",color:"inherit",cursor:"pointer"}}>Atualizar situação</button>
 </section>;
}
