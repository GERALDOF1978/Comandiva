import React,{useEffect,useState} from "react";
import {auth} from "../lib/firebase.js";
import {AVAILABLE_PAYMENT_METHODS,enabledPaymentMethods,paymentMethodDescriptions} from "../lib/paymentMethods.js";
const labels={PIX:"PIX Mercado Pago",CASH:"Dinheiro",CARD_ON_DELIVERY:"Cartão na maquininha"};
export default function PaymentMethodsSettings({restaurantId}){
 const [methods,setMethods]=useState([...AVAILABLE_PAYMENT_METHODS]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(""),[error,setError]=useState("");
 const base="/api/create-restaurant";
 async function request(http,body){
  const user=auth.currentUser;
  if(!user)throw Error("Faça login novamente.");
  const response=await fetch(base+(http==="GET"?"?action=paymentOptions&restaurantId="+encodeURIComponent(restaurantId):""),{
   method:http,headers:{Authorization:"Bearer "+await user.getIdToken(),...(http==="POST"?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error==="owner_only"?"Somente o proprietário pode alterar pagamentos.":"Não foi possível consultar ou salvar os pagamentos.");
  return data;
 }
 useEffect(()=>{let live=true;setLoading(true);request("GET").then(data=>{if(live)setMethods(enabledPaymentMethods(data.paymentMethods))}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[restaurantId]);
 const toggle=method=>{setMessage("");setError("");setMethods(old=>old.includes(method)?old.filter(v=>v!==method):AVAILABLE_PAYMENT_METHODS.filter(v=>v===method||old.includes(v)))};
 async function save(){if(!methods.length){setError("Ative pelo menos uma forma de pagamento.");return}setBusy(true);setMessage("");setError("");try{const data=await request("POST",{action:"paymentOptions",restaurantId,paymentMethods:methods});setMethods(enabledPaymentMethods(data.paymentMethods));setMessage("Formas de pagamento salvas. O cardápio e o PDV serão atualizados com as opções permitidas.")}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="panel big dishyIntegrationPanel"><div className="moduleIntro"><div><h2>Formas de pagamento aceitas</h2><p>Escolha somente os meios aceitos pelo seu estabelecimento. O cliente não verá os métodos desativados.</p></div></div>
 <div className="paymentMethodsGrid">{AVAILABLE_PAYMENT_METHODS.map(method=><label key={method} className={"paymentMethodSetting"+(methods.includes(method)?" isActive":"")}><input type="checkbox" checked={methods.includes(method)} onChange={()=>toggle(method)} disabled={busy||loading}/><span><b>{labels[method]}</b><small>{paymentMethodDescriptions[method]}</small></span></label>)}</div>
 <p className="techNote">Exemplo: se deixar apenas Dinheiro marcado, somente Dinheiro ficará disponível no cardápio, no PDV e no fechamento presencial. Para aceitar PIX, configure primeiro as credenciais do Mercado Pago.</p>
 <button type="button" className="integrationPrimaryButton" onClick={save} disabled={loading||busy||!methods.length}>{loading?"Carregando...":busy?"Salvando...":"Salvar formas de pagamento"}</button>
 {!methods.length&&<p role="alert">Selecione pelo menos uma opção.</p>}{error&&<p role="alert" className="integrationError">{error}</p>}{message&&<p role="status" className="integrationSuccess">{message}</p>}
 </section>
}