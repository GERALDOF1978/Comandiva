import React,{useEffect,useState} from "react";

export default function SubscriptionContractDialog({user,membership,plan,onClose}){
 const [name,setName]=useState(membership.restaurantName||membership.name||"");
 const [document,setDocument]=useState("");
 const [whatsapp,setWhatsapp]=useState("");
 const [preview,setPreview]=useState(null);
 const [accepted,setAccepted]=useState(false);
 const [allowWhatsapp,setAllowWhatsapp]=useState(false);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [success,setSuccess]=useState(null);
 const [billingEnabled,setBillingEnabled]=useState(false);
 const [checkoutBusy,setCheckoutBusy]=useState(false);
 const [checkoutUrl,setCheckoutUrl]=useState("");
 const [paymentMethod,setPaymentMethod]=useState("");
 const rid=membership.restaurantId;
 useEffect(()=>{let mounted=true;user.getIdToken().then(token=>fetch("/api/subscription-contract?action=billingStatus&restaurantId="+encodeURIComponent(rid),{headers:{Authorization:"Bearer "+token}})).then(r=>r.ok?r.json():{enabled:false}).then(data=>{if(mounted)setBillingEnabled(data.enabled===true)}).catch(()=>{});return()=>{mounted=false}},[rid,user.uid]);
 function change(setter,value){setter(value);setPreview(null);setAccepted(false);setAllowWhatsapp(false);setError("")}
 async function prepare(){
  setBusy(true);setError("");setSuccess(null);
  try{
   const token=await user.getIdToken();
   const url="/api/subscription-contract?restaurantId="+encodeURIComponent(rid)+"&planId="+encodeURIComponent(plan.id)+"&customerName="+encodeURIComponent(name.trim())+"&customerDocument="+encodeURIComponent(document.replace(/\D/g,""));
   const response=await fetch(url,{headers:{Authorization:"Bearer "+token}});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Falha ao gerar a prévia.");
   setPreview(data);
  }catch(e){setError(e.message||"Não foi possível carregar o contrato.")}finally{setBusy(false)}
 }
 async function sign(){
  if(!preview?.ready||!accepted||!allowWhatsapp)return;
  if(!window.confirm("Confirma que leu o documento e deseja registrar seu aceite eletrônico? A confirmação NÃO cobra nem ativa o plano automaticamente."))return;
  setBusy(true);setError("");
  try{
   const token=await user.getIdToken(),response=await fetch("/api/subscription-contract",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"accept",restaurantId:rid,planId:plan.id,contractVersion:preview.version,draftHash:preview.draftHash,draftTimestamp:preview.draftTimestamp,customerName:name.trim(),customerDocument:document.replace(/\D/g,""),whatsapp,acceptedTerms:true,authorizedWhatsApp:true})});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(({contract_not_ready:"O fornecedor responsável e o n8n ainda não foram habilitados.",contract_preview_expired:"A prévia venceu. Gere e confira novamente.",contract_preview_changed:"Os dados do plano mudaram. Gere a prévia novamente.",invalid_customer_identity:"Confira nome, CPF/CNPJ e WhatsApp."})[body.error]||body.error||"Não foi possível registrar o aceite.");
   setSuccess({id:body.contractId,status:body.deliveryStatus});
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function openCheckout(){
  if(!success?.id||!billingEnabled||checkoutBusy)return;
  if(!["pix","credit_card"].includes(paymentMethod)){setError("Escolha PIX ou cartão de crédito para continuar.");return;}
  if(!window.confirm("Abrir pagamento por "+(paymentMethod==="pix"?"PIX":"cartão de crédito")+" na InfinitePay? Esta cobrança é avulsa, sem débito recorrente automático. Se o teste gratuito estiver vigente, a mensalidade paga começará ao final do teste."))return;
  setCheckoutBusy(true);setError("");
  try{
   const token=await user.getIdToken(),response=await fetch("/api/subscription-contract?action=billingCheckout",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"checkout",restaurantId:rid,contractId:success.id,paymentMethod})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(({payment_not_due_yet:"O pagamento ficará disponível a partir de 7 dias antes do fim do teste ou do período pago.",another_invoice_exists_for_cycle:"Já existe uma cobrança para esse período. Consulte seu histórico.",plan_change_requires_master:"A mudança de plano durante uma assinatura ativa precisa ser aprovada no Master.",contract_plan_changed:"O plano mudou desde o aceite. Confira um novo contrato.",invoice_payment_method_locked:"Esta mensalidade já possui um link com outra forma de pagamento. Para evitar cobrança duplicada, consulte o suporte.",select_payment_method:"Selecione PIX ou cartão de crédito."})[data.error]||data.error||"Falha ao gerar cobrança.");
   if(!/^https:\/\//.test(data.checkoutUrl))throw Error("Link de checkout inválido.");
   setCheckoutUrl(data.checkoutUrl);window.location.assign(data.checkoutUrl);
  }catch(e){setError(e.message)}finally{setCheckoutBusy(false)}
 }
 const style={background:"#151d29",border:"1px solid #41516a",color:"#fff",borderRadius:10,padding:12,width:"100%",boxSizing:"border-box"};
 return <div role="presentation" style={{position:"fixed",inset:0,zIndex:20000,background:"rgba(0,0,0,.8)",overflowY:"auto",padding:"20px 12px"}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section role="dialog" aria-modal="true" aria-label="Minuta do contrato Dishy" style={{maxWidth:780,margin:"auto",borderRadius:18,background:"#202938",color:"#fff",padding:"20px",boxShadow:"0 20px 70px #0009"}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",marginBottom:14}}><div><small style={{color:"#f9a75e"}}>DISHY • CONTRATO DIGITAL</small><h2 style={{margin:"4px 0"}}>{plan.name}</h2><p style={{color:"#bfccda",margin:0}}>Confira o contrato antes de qualquer contratação.</p></div><button type="button" aria-label="Fechar contrato" onClick={onClose} style={{...style,width:"auto"}}>✕</button></div>
   <div role="group" aria-label="Escolha a forma de pagamento" style={{display:"grid",gap:9,marginBottom:18,padding:14,border:"1px solid #52617a",borderRadius:12,background:"#182332"}}>
    <strong>Como deseja pagar a mensalidade?</strong>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:10}}>
     <label style={{display:"flex",gap:10,alignItems:"flex-start",padding:12,border:"1px solid "+(paymentMethod==="pix"?"#ff8200":"#53657d"),background:paymentMethod==="pix"?"#302519":"#223045",borderRadius:10,cursor:"pointer"}}>
      <input type="radio" name="dishy_subscription_payment_method" value="pix" checked={paymentMethod==="pix"} onChange={()=>setPaymentMethod("pix")}/>
      <span><strong>PIX</strong><small style={{display:"block",marginTop:4,color:"#c3cfdd"}}>A cada mês, pague um novo link ou QR Code.</small></span>
     </label>
     <label style={{display:"flex",gap:10,alignItems:"flex-start",padding:12,border:"1px solid "+(paymentMethod==="credit_card"?"#ff8200":"#53657d"),background:paymentMethod==="credit_card"?"#302519":"#223045",borderRadius:10,cursor:"pointer"}}>
      <input type="radio" name="dishy_subscription_payment_method" value="credit_card" checked={paymentMethod==="credit_card"} onChange={()=>setPaymentMethod("credit_card")}/>
      <span><strong>Cartão de crédito</strong><small style={{display:"block",marginTop:4,color:"#c3cfdd"}}>Pagamento mensal no cartão; sem débito automático nesta versão.</small></span>
     </label>
    </div>
    <small style={{color:"#d6dce8"}}>A escolha é sua. A cobrança automática no cartão exige outra modalidade da InfinitePay e ainda não está integrada ao Dishy.</small>
   </div>
   {!success&&<div style={{display:"grid",gap:11,marginBottom:15}}>
    <label style={{display:"grid",gap:5}}>Nome do titular ou razão social<input style={style} value={name} maxLength={120} onChange={e=>change(setName,e.target.value)} placeholder="Nome completo ou razão social"/></label>
    <label style={{display:"grid",gap:5}}>CPF ou CNPJ do contratante<input style={style} value={document} maxLength={18} inputMode="numeric" onChange={e=>change(setDocument,e.target.value)} placeholder="Somente números"/></label>
    <label style={{display:"grid",gap:5}}>WhatsApp para receber o contrato<input style={style} value={whatsapp} maxLength={20} inputMode="tel" onChange={e=>change(setWhatsapp,e.target.value)} placeholder="(19) 99999-9999"/></label>
    <p style={{margin:0,fontSize:13,color:"#c5cedc"}}>Uma cópia será enviada também para o e-mail verificado da conta: <strong>{user.email}</strong>.</p>
    <button type="button" onClick={prepare} disabled={busy} style={{...style,background:"#ff8200",color:"#181818",fontWeight:800,cursor:"pointer"}}>{busy?"Aguarde...":"Gerar contrato para conferência"}</button>
   </div>}
   {preview&&!success&&<div style={{display:"grid",gap:12}}>
    {!preview.ready&&<p role="status" style={{padding:12,borderRadius:9,background:"#463326",color:"#ffe1c3"}}>{preview.reason} Você pode ler a minuta, mas o aceite e os envios ainda estão bloqueados.</p>}
    <pre tabIndex={0} style={{...style,whiteSpace:"pre-wrap",fontFamily:"inherit",fontSize:13,lineHeight:1.55,maxHeight:"46vh",overflowY:"auto"}}>{preview.text}</pre>
    {preview.ready&&<>
     <label style={{display:"flex",alignItems:"flex-start",gap:9}}><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> Li integralmente e aceito o contrato exibido acima, incluindo o plano e valor.</label>
     <label style={{display:"flex",alignItems:"flex-start",gap:9}}><input type="checkbox" checked={allowWhatsapp} onChange={e=>setAllowWhatsapp(e.target.checked)}/> Autorizo receber a cópia do contrato por WhatsApp e e-mail informados.</label>
     <button type="button" disabled={busy||!accepted||!allowWhatsapp} onClick={sign} style={{...style,background:accepted&&allowWhatsapp?"#ff8200":"#384453",color:accepted&&allowWhatsapp?"#171717":"#bcc8d5",fontWeight:800,cursor:"pointer"}}>{busy?"Registrando...":"Aceitar contrato e solicitar envio pelo n8n"}</button>
    </>}
   </div>}
   {success&&<div role="status" style={{padding:15,borderRadius:10,background:"#183e2d",lineHeight:1.6}}><strong>Aceite registrado.</strong><p style={{margin:"5px 0"}}>ID do contrato: {success.id}</p><p style={{margin:"5px 0"}}>{success.status==="handed_off_to_n8n"?"Evento recebido pelo n8n. A entrega dos dois canais deve ser verificada no workflow.":"Envio pendente de confirmação. O aceite foi preservado."}</p><p>Esse registro não efetua cobrança nem altera sua assinatura.</p>
     {billingEnabled?<button type="button" disabled={checkoutBusy||!paymentMethod} onClick={openCheckout} style={{background:"#ff8200",border:0,padding:13,borderRadius:9,fontWeight:800,color:"#1b1b1b",cursor:"pointer"}}>{checkoutBusy?"Abrindo InfinitePay...":paymentMethod==="pix"?"Pagar mensalidade com PIX":paymentMethod==="credit_card"?"Pagar mensalidade com cartão":"Escolha PIX ou cartão"}</button>:<p style={{fontSize:13}}>A etapa de pagamento está em preparação e só será liberada quando o prestador responsável e a conta InfinitePay estiverem configurados.</p>}
     {checkoutUrl&&<a href={checkoutUrl} target="_blank" rel="noreferrer" style={{display:"block",color:"#fff"}}>Abrir link de pagamento</a>}
    </div>}
   {error&&<p role="alert" style={{color:"#ffc1a6"}}>{error}</p>}
  </section>
 </div>;
}
