import React,{useEffect,useRef,useState} from "react";
const subjects={setup:"Implantação",menu:"Cardápio",payments:"Pagamentos",orders:"Pedidos/PDV",deliveries:"Entregas",other:"Outros"};
const statusOptions=[["new","Novo"],["in_progress","Em atendimento"],["resolved","Resolvido"]];

export default function MasterSupportPanel({user,active,onNewCount}){
 const [data,setData]=useState({items:[],unread:0,whatsapp:""}),[phone,setPhone]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState("");
 const previousCount=useRef(null);
 async function call(action,payload){
   const token=await user.getIdToken();
   const res=await fetch("/api/create-restaurant"+(payload?"":"?action="+encodeURIComponent(action)),{
     method:payload?"POST":"GET",
     headers:{Authorization:"Bearer "+token,...(payload?{"Content-Type":"application/json"}:{})},
     ...(payload?{body:JSON.stringify({action,...payload})}:{})
   });
   const response=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(({invalid_whatsapp:"Digite um número brasileiro válido com DDD.",master_only:"Apenas o Master pode visualizar esta fila."})[response.error]||response.error||"Não foi possível consultar o suporte.");
   return response;
 }
 async function refresh(){
   try{
     const result=await call("supportMaster");
     setData(result);setPhone(prev=>prev===null?"":result.whatsapp||"");
     if(previousCount.current!==null&&result.unread>previousCount.current&&typeof Notification!=="undefined"&&Notification.permission==="granted"){
       new Notification("Dishy Master — novo pedido de ajuda",{body:"Uma loja enviou uma solicitação de suporte.",tag:"dishy-master-support"});
     }
     previousCount.current=result.unread;
     onNewCount(result.unread||0);
     setError("");
   }catch(e){setError(e.message)}finally{setLoading(false)}
 }
 useEffect(()=>{refresh();const interval=setInterval(refresh,30000);return()=>clearInterval(interval)},[user.uid]);
 async function save(){
   setBusy("phone");setNotice("");setError("");
   try{const result=await call("supportMasterSave",{whatsapp:phone});setPhone(result.whatsapp);setData(v=>({...v,whatsapp:result.whatsapp}));setNotice("WhatsApp do suporte atualizado.")}catch(e){setError(e.message)}finally{setBusy("")}
 }
 async function change(id,status){
   setBusy(id);setError("");
   try{await call("supportMasterStatus",{id,status});setData(v=>({...v,items:v.items.map(t=>t.id===id?{...t,status}:t),unread:v.items.filter(t=>(t.id===id?status:t.status)==="new").length}));onNewCount(data.items.filter(t=>(t.id===id?status:t.status)==="new").length)}catch(e){setError(e.message)}finally{setBusy("")}
 }
 async function enableNotifications(){
   if(typeof Notification==="undefined"){setNotice("Este navegador não oferece notificações. O contador de chamados continua funcionando.");return;}
   const permission=await Notification.requestPermission();
   setNotice(permission==="granted"?"Avisos ativados enquanto o painel Master estiver aberto.":"Os avisos do navegador não foram ativados. Você continuará vendo os chamados aqui.");
 }
 const boxStyle={background:"#141d2b",border:"1px solid #35485c",borderRadius:14,padding:18,marginBottom:16};
 return <>
   {!active&&data.unread>0&&<p className="masterSupportAlert" role="status">🔔 {data.unread} {data.unread===1?"loja precisa":"lojas precisam"} de ajuda. Abra a aba Suporte.</p>}
   {active&&<div className="masterSupport">
     <section style={boxStyle}>
       <h2>Suporte aos estabelecimentos</h2>
       <p>Novos pedidos aparecem aqui automaticamente enquanto este painel estiver aberto. Confirme o assunto, marque o andamento e entre em contato com a loja.</p>
       <div className="masterSupportSettings">
         <label>WhatsApp oficial do suporte Dishy<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="55 + DDD + telefone"/></label>
         <button type="button" disabled={busy==="phone"} onClick={save}>{busy==="phone"?"Salvando...":"Salvar WhatsApp"}</button>
         <button type="button" onClick={enableNotifications}>Ativar aviso no navegador</button>
       </div>
       <small>O WhatsApp aparece no painel das lojas somente depois de configurado. Notificações do navegador dependem de permissão e do Master aberto; não são mensagens push em segundo plano.</small>
       {notice&&<p role="status">{notice}</p>}
       {error&&<p role="alert" className="masterSupportError">{error}</p>}
     </section>
     <div className="masterSupportCount"><strong>{data.unread} novos pedidos</strong> · {data.items.length} solicitações recentes</div>
     {loading?<p>Carregando chamados...</p>:data.items.length===0?<section style={boxStyle}>Nenhum pedido de ajuda recebido.</section>:<div className="masterSupportList">{data.items.map(t=><article key={t.id} style={boxStyle} className={t.status==="new"?"new":""}>
       <div className="masterSupportHeading"><div><small>{subjects[t.kind]||"Suporte"} • {t.createdAt?new Date(t.createdAt).toLocaleString("pt-BR"):""}</small><h3>{t.subject}</h3><strong>{t.restaurantName}</strong></div><span>{t.status==="new"?"Novo":t.status==="in_progress"?"Em atendimento":"Resolvido"}</span></div>
       <p>{t.message}</p>
       <div className="masterSupportContact"><span>Contato: {t.contact||t.email||"Não informado"}</span>{t.contact&&<a href={"https://wa.me/"+t.contact.replace(/\D/g,"").replace(/^(\d{10,11})$/,"55$1")+"?text="+encodeURIComponent("Olá! Aqui é o suporte Dishy. Recebemos seu pedido sobre: "+t.subject)} target="_blank" rel="noopener noreferrer">Responder no WhatsApp</a>}</div>
       <label>Status<select value={t.status||"new"} disabled={busy===t.id} onChange={e=>change(t.id,e.target.value)}>{statusOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
     </article>)}</div>}
   </div>}
 </>;
}
