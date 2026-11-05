import React,{useEffect,useState} from "react";
import {auth} from "../lib/firebase.js";

// InfinitePay é opcional. O checkout abre no site oficial da operadora;
// o pagamento é confirmado exclusivamente pela API no servidor.
export default function InfinitePaySettings({restaurantId}){
 const [form,setForm]=useState({handle:"",apiKey:""}),[info,setInfo]=useState(null);
 const [providers,setProviders]=useState({PIX:"mercado_pago",CARD_ONLINE:"mercado_pago"});
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function request(method,action,body){
  const user=auth.currentUser;if(!user)throw Error("Faça login novamente.");
  const url="/api/create-restaurant"+(method==="GET"?"?action="+action+"&restaurantId="+encodeURIComponent(restaurantId):"");
  const response=await fetch(url,{method,headers:{Authorization:"Bearer "+await user.getIdToken(),...(method==="POST"?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify({action,restaurantId,...body})}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(({owner_only:"Só o proprietário pode alterar estas configurações.",credentials_locked:"As credenciais estão bloqueadas. Libere a edição para trocar.",infinitepay_not_configured:"Cadastre primeiro a InfinitePay.",mercado_pago_not_configured:"Cadastre primeiro o Mercado Pago.",invalid_infinitepay_credentials:"Confira a InfiniteTag e a chave API do Checkout Integrado.",encryption_key_not_configured:"O servidor não tem a chave de criptografia configurada."})[data.error]||"Não foi possível salvar a configuração ("+String(data.error||response.status)+").");
  return data;
 }
 useEffect(()=>{let live=true;setLoading(true);Promise.all([request("GET","infinitepayCredentials"),request("GET","gatewaySelection")]).then(([a,b])=>{if(!live)return;setInfo(a);setForm({handle:a.handle||"",apiKey:""});setProviders(b.providers||{PIX:"mercado_pago",CARD_ONLINE:"mercado_pago"})}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[restaurantId]);
 const locked=!!info?.configured&&!editing;
 async function saveCredentials(e){e.preventDefault();if(info?.configured&&!editing)return;if(info?.configured&&!window.confirm("Substituir a chave da InfinitePay? Confira antes de continuar."))return;setBusy(true);setError("");setMessage("");try{const data=await request("POST","infinitepayCredentials",{...form,confirmReplace:!!info?.configured});setInfo(data);setEditing(false);setForm({handle:data.handle||"",apiKey:""});setMessage("InfinitePay cadastrada e protegida. Faça uma transação real de baixo valor antes de ativá-la.")}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function saveProviders(){setBusy(true);setError("");setMessage("");try{const data=await request("POST","gatewaySelection",{providers});setProviders(data.providers);setMessage("Provedores salvos. Os novos pedidos utilizarão as opções escolhidas. Pedidos antigos permanecem com seu provedor original.")}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="panel big dishyIntegrationPanel"><div className="moduleIntro"><div><h2>InfinitePay · opção adicional</h2><p>Configure uma segunda operadora de Pix e cartão, sem substituir automaticamente o Mercado Pago.</p></div></div>
 <p className="integrationStatus"><b>InfinitePay:</b> {loading?"Carregando...":info?.configured?"Cadastrada e protegida — teste real pendente":"Não configurada"}</p>
 <form className="integrationCredentialForm" onSubmit={saveCredentials}>
 <label>InfiniteTag do estabelecimento (sem $)<input type="text" value={form.handle} disabled={locked||busy||loading} required onChange={e=>setForm(v=>({...v,handle:e.target.value}))} placeholder="sua-infinite-tag"/></label>
 <label>Chave API do Checkout Integrado<input type="password" value={locked?"••••••••••••":form.apiKey} disabled={locked||busy||loading} required onChange={e=>setForm(v=>({...v,apiKey:e.target.value}))} placeholder="inchk_..."/></label>
 <div className="integrationActionRow">{locked?<button type="button" className="integrationSecondaryButton" disabled={busy} onClick={()=>{if(window.confirm("Liberar a edição da chave InfinitePay?")){setEditing(true);setForm(v=>({...v,apiKey:""}))}}}>Liberar edição das chaves</button>:<><button className="integrationPrimaryButton" type="submit" disabled={busy||loading}>{busy?"Salvando...":"Salvar e proteger InfinitePay"}</button>{info?.configured&&<button type="button" className="integrationSecondaryButton" onClick={()=>{setEditing(false);setForm({handle:info.handle||"",apiKey:""})}}>Cancelar edição</button>}</>}</div></form>
 <details className="integrationTutorial"><summary>Como cadastrar a InfinitePay</summary><ol><li>No aplicativo ou portal InfinitePay, vá a <b>Checkout → Configurações</b>.</li><li>Ative <b>Checkout Integrado</b> e crie uma chave API de produção.</li><li>Copie a InfiniteTag (sem o símbolo $) e a chave iniciada em <b>inchk_</b>.</li><li>Cadastre aqui e faça uma compra real de baixo valor para confirmar o retorno de pagamento.</li><li>A InfinitePay abre seu próprio checkout: não fornece ao Dishy o QR Code Pix para exibir no cardápio.</li></ol><a href="https://www.infinitepay.io/checkout-documentacao" target="_blank" rel="noopener noreferrer">Documentação oficial da InfinitePay</a></details>
 <div className="integrationCredentialForm"><h3>Qual operadora processa cada pagamento?</h3><p>Mercado Pago permanece como padrão. A InfinitePay é usada apenas quando selecionada abaixo e com cadastro concluído.</p>
 {[["PIX","PIX online"],["CARD_ONLINE","Cartão online"]].map(([key,label])=><label key={key}>{label}<select value={providers[key]||"mercado_pago"} disabled={busy||loading} onChange={e=>setProviders(v=>({...v,[key]:e.target.value}))}><option value="mercado_pago">Mercado Pago</option><option value="infinitepay" disabled={!info?.configured}>InfinitePay (checkout externo)</option></select></label>)}
 <p className="techNote"><b>Recebimento:</b> os valores caem na conta InfinitePay vinculada à InfiniteTag/chave API deste restaurante. <b>Experiência do comprador:</b> a InfinitePay abre sua própria página de pagamento, inclusive quando o pedido é PIX. Ela não disponibiliza QR Code PIX embutido no Dishy. Para exibir o PIX diretamente no cardápio ou no PDV, mantenha Mercado Pago como operadora do PIX. O checkout InfinitePay também pode oferecer cartão.</p>
 <button className="integrationPrimaryButton" type="button" disabled={loading||busy} onClick={saveProviders}>{busy?"Salvando...":"Salvar operadora de cada pagamento"}</button></div>
 {error&&<p className="integrationError" role="alert">{error}</p>}{message&&<p className="integrationSuccess" role="status">{message}</p>}
 </section>
}
