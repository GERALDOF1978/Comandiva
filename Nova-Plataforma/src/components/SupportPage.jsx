import React,{useEffect,useState} from "react";

const TYPES=[["setup","Implantação e configuração"],["menu","Cardápio e produtos"],["payments","PIX e pagamentos"],["orders","Pedidos e PDV"],["deliveries","Entregadores"],["other","Outro assunto"]];
const stateLabels={new:"Recebido",in_progress:"Em atendimento",resolved:"Resolvido"};

export default function SupportPage({user,membership}){
 const [config,setConfig]=useState({whatsapp:"",items:[]}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [form,setForm]=useState({kind:"setup",subject:"",message:"",contact:""});
 const rid=membership.restaurantId;
 async function request(action,body){
   const token=await user.getIdToken();
   const url="/api/create-restaurant"+(body?"":"?action="+encodeURIComponent(action)+"&restaurantId="+encodeURIComponent(rid));
   const response=await fetch(url,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify({action,restaurantId:rid,...body})}:{})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(({support_rate_limited:"Aguarde dois minutos antes de enviar outra solicitação.",support_access_denied:"Somente o proprietário ou gerente pode solicitar suporte.",invalid_support_request:"Confira os campos. Título: 5 a 120 caracteres; descrição: 15 a 2.000 caracteres.",invalid_contact:"Revise o telefone de contato."})[data.error]||"Não foi possível concluir a solicitação.");
   return data;
 }
 async function refresh(){try{const data=await request("supportTenant");setConfig({whatsapp:data.whatsapp||"",items:data.items||[]});setError("")}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{let active=true;refresh();return()=>{active=false}},[rid,user.uid]);
 async function submit(e){
   e.preventDefault();if(busy)return;setBusy(true);setError("");setMessage("");
   try{const data=await request("supportCreate",form);setMessage("Pedido de ajuda enviado! Protocolo: "+data.requestId.slice(0,9).toUpperCase()+". O Master recebeu sua solicitação.");setForm({kind:"setup",subject:"",message:"",contact:form.contact});await refresh()}
   catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const whatsapp=config.whatsapp&&/^55\d{10,11}$/.test(config.whatsapp)?config.whatsapp:"";
 const helpText="Olá! Sou da loja "+(membership.restaurantName||membership.name||"")+". Preciso de ajuda para configurar o Dishy.";
 return <section className="dishyHelpPage">
   <div className="dishyHelpIntro"><small>CENTRAL DE AJUDA DISHY</small><h2>Precisa de ajuda com seu estabelecimento?</h2><p>Estamos aqui para orientar você na montagem do cardápio, configuração de pagamentos, pedidos e entregas.</p></div>
   <div className="dishyHelpGrid">
     <article className="dishyHelpCard">
       <h3>Falar no WhatsApp</h3><p>Converse com a equipe de suporte do Dishy para tirar dúvidas durante a implantação.</p>
       {whatsapp?<a className="dishyHelpWhatsapp" href={"https://wa.me/"+whatsapp+"?text="+encodeURIComponent(helpText)} target="_blank" rel="noopener noreferrer">Abrir WhatsApp do suporte</a>:<p className="dishyHelpNotice">WhatsApp do suporte ainda não configurado. Use o formulário ao lado.</p>}
       <small>Seu contato é iniciado por você; o Dishy não envia mensagens automáticas por este botão.</small>
     </article>
     <article className="dishyHelpCard">
       <h3>Enviar pedido de ajuda</h3><p>Seu pedido chega diretamente ao painel Master do Dishy.</p>
       <form className="dishyHelpForm" onSubmit={submit}>
         <label>Assunto<select value={form.kind} onChange={e=>setForm(v=>({...v,kind:e.target.value}))}>{TYPES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
         <label>Título do pedido<input value={form.subject} onChange={e=>setForm(v=>({...v,subject:e.target.value}))} placeholder="Ex.: Preciso configurar os tamanhos das pizzas" maxLength={120} minLength={5} required/></label>
         <label>Descreva o que precisa<textarea value={form.message} onChange={e=>setForm(v=>({...v,message:e.target.value}))} rows={5} maxLength={2000} minLength={15} required placeholder="Conte onde está com dificuldade e o que tentou fazer."/></label>
         <label>WhatsApp para retorno (opcional)<input type="tel" value={form.contact} onChange={e=>setForm(v=>({...v,contact:e.target.value}))} maxLength={30} placeholder="(19) 99999-9999"/></label>
         <button type="submit" disabled={busy||loading}>{busy?"Enviando...":"Enviar ao suporte Dishy"}</button>
       </form>
       {message&&<p role="status" className="dishyHelpSuccess">{message}</p>}
       {error&&<p role="alert" className="dishyHelpError">{error}</p>}
     </article>
   </div>
   <section className="dishyHelpCard"><h3>Meus pedidos de ajuda</h3>{loading?<p>Carregando...</p>:config.items.length? <div className="dishyHelpTickets">{config.items.map(t=><div key={t.id}><strong>{t.subject}</strong><span>{stateLabels[t.status]||t.status}</span><small>{t.createdAt?new Date(t.createdAt).toLocaleString("pt-BR"):"Data indisponível"}</small></div>)}</div>:<p>Nenhuma solicitação registrada nesta loja.</p>}</section>
 </section>;
}
