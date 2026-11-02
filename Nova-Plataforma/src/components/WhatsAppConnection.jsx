import React,{useEffect,useState} from "react";
import {Phone} from "lucide-react";
import QRCode from "qrcode";
import {auth} from "../lib/firebase.js";
const errors={
 evolution_not_configured:"A Evolution API ainda não foi conectada ao servidor. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no ambiente do Dishy.",
 evolution_connection_unavailable:"Não foi possível consultar a Evolution API. Confira a URL, a chave e a instância.",
 evolution_create_failed:"A Evolution API não permitiu criar a instância. Confira a integração.",
 evolution_connect_failed:"Não foi possível gerar o QR Code. Confira se a instância está funcionando.",
 invalid_phone:"Digite um número brasileiro com DDD para gerar o código de pareamento.",
 owner_only:"Apenas o proprietário do estabelecimento pode conectar o WhatsApp.",
 whatsapp_connection_unavailable:"Falha temporária na consulta ao WhatsApp. Tente novamente."
};
export default function WhatsAppConnection({membership}){
 const [info,setInfo]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [qrImage,setQrImage]=useState(""),[pairCode,setPairCode]=useState(""),[phone,setPhone]=useState("");
 const [mode,setMode]=useState("qr");
 const restaurantId=membership.restaurantId;
 async function request(method,action){
  const user=auth.currentUser;if(!user)throw Error("Faça login novamente.");
  const body=method==="POST"?JSON.stringify({restaurantId,action,phone:phone.replace(/\D/g,"")}):undefined;
  const res=await fetch("/api/whatsapp-connection"+(method==="GET"?"?restaurantId="+encodeURIComponent(restaurantId):""),{method,headers:{Authorization:"Bearer "+await user.getIdToken(),...(body?{"Content-Type":"application/json"}:{})},...(body?{body}:{})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(errors[data.error]||"Não foi possível se comunicar com a Evolution API.");
  return data;
 }
 async function refresh(silent=false){
  if(!silent)setBusy(true);if(!silent)setError("");
  try{const data=await request("GET","status");setInfo(data);if(data.connected){setQrImage("");setPairCode("");setMessage("WhatsApp conectado. A entrega de notificações depende dos fluxos do n8n estarem publicados.")}}catch(e){if(!silent)setError(e.message)}finally{if(!silent)setBusy(false)}
 }
 useEffect(()=>{let active=true;(async()=>{try{const user=auth.currentUser;if(!user)return;const res=await fetch("/api/whatsapp-connection?restaurantId="+encodeURIComponent(restaurantId),{headers:{Authorization:"Bearer "+await user.getIdToken()}});const data=await res.json().catch(()=>({}));if(!active)return;if(res.ok)setInfo(data);else setError(errors[data.error]||"Não foi possível consultar a integração.")}catch(e){if(active)setError("Não foi possível consultar o WhatsApp.")}})();return()=>{active=false}},[restaurantId]);
 useEffect(()=>{if(info?.connected||(!qrImage&&!pairCode))return;const poll=setInterval(()=>refresh(true),10000);return()=>clearInterval(poll)},[info?.connected,qrImage,pairCode,restaurantId]);
 async function connect(action){setBusy(true);setError("");setMessage("");setQrImage("");setPairCode("");try{const data=await request("POST",action);setInfo(data);if(action==="pair"){if(data.pairingCode){setPairCode(data.pairingCode);setMessage("Abra o WhatsApp do número informado e digite o código de pareamento.")}else setError("A Evolution API não retornou um código de pareamento. Tente gerar o QR em outra tela.")}else if(data.qrImage){setQrImage(data.qrImage);setMessage("Escaneie com o WhatsApp em Aparelhos conectados.")}else if(data.qrCode){const img=await QRCode.toDataURL(data.qrCode,{width:300,margin:2});setQrImage(img);setMessage("Escaneie o QR Code no WhatsApp.")}else{setMessage("Conexão iniciada, mas ainda não há QR Code. Consulte o status e tente novamente.")}}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="panel big dishyIntegrationPanel"><div className="moduleIntro"><div className="moduleIcon"><Phone/></div><div><h2>WhatsApp para notificações</h2><p>Conecte o WhatsApp do restaurante à Evolution API para que os fluxos de avisos do n8n possam enviar mensagens sobre pedidos.</p></div></div>
 <p className="integrationStatus"><b>Status:</b> {info?.connected?"Conectado":info?.configured?"Aguardando conexão":"Integração não configurada"} {info?.instance&&<small>Instância: {info.instance}</small>}</p>
 <div className="integrationModeTabs"><button type="button" className={mode==="qr"?"active":""} onClick={()=>setMode("qr")}>Conectar por QR Code</button><button type="button" className={mode==="pair"?"active":""} onClick={()=>setMode("pair")}>Mesmo celular: usar código</button></div>
 {!info?.connected&&<div className="integrationConnect">
 {mode==="qr"?<><p>Abra esta página no computador ou em outro aparelho. No celular que tem o WhatsApp, acesse <b>Aparelhos conectados → Conectar um aparelho</b> e escaneie o QR Code abaixo.</p><button className="integrationPrimaryButton" type="button" onClick={()=>connect("connect")} disabled={busy}>{busy?"Consultando...":"Gerar QR Code do WhatsApp"}</button>{qrImage&&<img className="integrationQrImage" src={qrImage} alt="QR Code para conectar o WhatsApp à Evolution API"/>}</>:
 <><p>Se o QR Code aparecer no <b>mesmo celular</b> em que está o WhatsApp, não será possível escanear a própria tela. Use o código de pareamento.</p><label>WhatsApp do restaurante, com DDD<input value={phone} inputMode="tel" placeholder="5511999999999" onChange={e=>setPhone(e.target.value)} autoComplete="tel"/></label><button className="integrationPrimaryButton" type="button" disabled={busy||phone.replace(/\D/g,"").length<12} onClick={()=>connect("pair")}>{busy?"Gerando...":"Gerar código de pareamento"}</button>{pairCode&&<div className="integrationPairCode"><small>Código de pareamento</small><strong>{pairCode}</strong><button type="button" onClick={()=>navigator.clipboard.writeText(pairCode)}>Copiar código</button></div>}<p>No WhatsApp do próprio celular: <b>Configurações / ⋮ → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone</b>. Digite o código exibido aqui. Os nomes podem variar conforme a versão do WhatsApp.</p></>}
 </div>}
 <button type="button" className="integrationSecondaryButton" onClick={()=>refresh(false)} disabled={busy}>{busy?"Verificando...":"Verificar status da conexão"}</button>
 <details className="integrationTutorial"><summary>Passo a passo e orientações</summary><ol><li>Use um número do estabelecimento autorizado para receber e enviar notificações.</li><li>Tenha uma instância da Evolution API configurada no servidor Dishy.</li><li>Escolha QR Code para conectar por outra tela ou código de pareamento para usar o mesmo celular.</li><li>No WhatsApp, entre em Aparelhos conectados e confirme a conexão.</li><li>Use Verificar status até aparecer Conectado. Depois valide os eventos de notificação no n8n.</li></ol><p>O QR Code é temporário e deve ser gerado novamente se expirar. Conectar o número não publica automaticamente os fluxos de mensagens.</p><p>Envie apenas notificações esperadas pelos clientes, com respeito às regras e à privacidade do WhatsApp.</p></details>
 {error&&<p className="integrationError" role="alert">{error}</p>}{message&&<p className="integrationSuccess" role="status">{message}</p>}
 </section>
}
