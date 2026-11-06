import React,{useEffect,useState} from "react";
import "./meta-pixel.css";

// Só medir visitas ao comercial e ao funil de cadastro, nunca o cardápio dos clientes.
const PIXEL_ID=String(import.meta.env.VITE_META_PIXEL_ID||"").trim();
const ENABLED=/^\d{10,20}$/.test(PIXEL_ID);
const CONSENT_KEY="dishy_meta_marketing_consent_v1";
const START_KEY="dishy_meta_registration_started_v1";
const CONVERSION_KEY="dishy_meta_pending_store_v1";
const ROUTES=new Set(["/","/anuncio","/cadastro","/cadastro-anuncio"]);
let initialized=false;
let pageTracked=false;

function path(){return window.location.pathname.replace(/\/+$/,"")||"/"}
function readConsent(){try{return window.localStorage.getItem(CONSENT_KEY)}catch{return null}}
function writeConsent(value){try{window.localStorage.setItem(CONSENT_KEY,value)}catch{}}
function openConsentFromUrl(){try{return new URLSearchParams(window.location.search).get("configurar_cookies")==="1"}catch{return false}}
function removeConsentUrlFlag(){try{const url=new URL(window.location.href);if(url.searchParams.has("configurar_cookies")){url.searchParams.delete("configurar_cookies");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash)}}catch{}}
function getPending(){try{return JSON.parse(window.sessionStorage.getItem(CONVERSION_KEY)||"null")}catch{return null}}
function clearPending(){try{window.sessionStorage.removeItem(CONVERSION_KEY)}catch{}}
function setup(){
  if(!ENABLED||typeof window==="undefined"||readConsent()!=="accepted")return false;
  if(!window.fbq){
    const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments)};
    fbq.queue=[];fbq.loaded=true;fbq.version="2.0";
    window.fbq=fbq;window._fbq=fbq;
    const script=document.createElement("script");
    script.async=true;script.src="https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  if(!initialized){window.fbq("init",PIXEL_ID);initialized=true}
  window.fbq("consent","grant");
  return true;
}
function recordPage(){
  if(!setup()||pageTracked||!ROUTES.has(path()))return;
  pageTracked=true;
  window.fbq("track","PageView");
  if(path()==="/anuncio")window.fbq("track","ViewContent",{content_name:"Dishy apresentação de anúncios"});
  const pending=getPending();
  if(pending){
    // O evento é enviado após a navegação de recarga, evitando perder a requisição.
    clearPending();
    if(Number(pending.createdAt)>Date.now()-10*60*1000){
      window.fbq("track","CompleteRegistration",{content_name:"Estabelecimento cadastrado no Dishy",status:"loja_criada"});
    }
  }
}
export function trackMetaRegistrationStart(){
  if(!setup()||!ROUTES.has(path()))return;
  try{
    if(window.sessionStorage.getItem(START_KEY)==="yes")return;
    window.sessionStorage.setItem(START_KEY,"yes");
  }catch{}
  window.fbq("trackCustom","StartRegistration",{content_name:"Dishy cadastro iniciado"});
}
export function queueMetaRestaurantRegistration(){
  if(!ENABLED||readConsent()!=="accepted")return;
  try{window.sessionStorage.setItem(CONVERSION_KEY,JSON.stringify({createdAt:Date.now()}))}catch{}
}
export default function DishyMetaPixel(){
  const eligible=ENABLED&&ROUTES.has(path());
  const [choice,setChoice]=useState(()=>openConsentFromUrl()?null:readConsent());
  const [details,setDetails]=useState(false);
  useEffect(()=>{if(eligible&&choice==="accepted")recordPage()},[eligible,choice]);
  if(!eligible)return null;
  const decide=value=>{
    writeConsent(value);setChoice(value);removeConsentUrlFlag();
    if(value==="rejected"&&typeof window.fbq==="function")window.fbq("consent","revoke");
    if(value==="accepted")recordPage();
  };
  if(choice==="accepted"||choice==="rejected")return <button type="button" className="dishyMetaCookieLink" onClick={()=>{setChoice(null);setDetails(false)}} aria-label="Alterar preferências de cookies de marketing">Preferências de cookies</button>;
  return <section className="dishyMetaConsent" aria-label="Permissão de cookies para anúncios">
    <div><strong>Privacidade e medição de anúncios</strong>
      <p>Podemos usar o Pixel da Meta para entender visitas e cadastros do Dishy. Isso só é ativado com sua permissão. Recusar não impede o cadastro.</p>
      {details&&<p>Se aceitar, a Meta poderá usar cookies e informações de navegação dessas páginas para medir anúncios. Nenhuma senha nem conteúdo do seu pedido é enviado pelo Dishy nesse evento. Você pode alterar sua escolha pelo botão “Cookies”.</p>}
      <button className="dishyMetaDetails" type="button" onClick={()=>setDetails(v=>!v)}>{details?"Ocultar detalhes":"Como funciona?"}</button>
    </div>
    <div className="dishyMetaConsentActions">
      <button type="button" className="dishyMetaReject" onClick={()=>decide("rejected")}>Recusar</button>
      <button type="button" className="dishyMetaAccept" onClick={()=>decide("accepted")}>Permitir medição</button>
    </div>
  </section>;
}
