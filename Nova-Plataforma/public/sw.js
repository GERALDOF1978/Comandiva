/* Dishy PWA — exibe notificações de status sem depender de bibliotecas remotas.
   O SDK Firebase na página continua responsável por registrar o token FCM. */
const CACHE="dishy-static-v4";
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/dishy-icon.svg","/manifest.webmanifest"])).catch(()=>{}));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
// Não interceptar fetch: pagamentos, pedidos e cardápio precisam sempre usar a rede.
self.addEventListener("push",event=>{
 let payload={};
 try{payload=event.data?.json()||{}}catch(error){console.warn("dishy_push_payload_invalid",error?.message||String(error))}
 const data=payload.data&&typeof payload.data==="object"?payload.data:{};
 const notification=payload.notification&&typeof payload.notification==="object"?payload.notification:{};
 const driverNotice=data.kind==="driver"&&data.event==="DRIVER_ASSIGNED";
 const orderId=String(data.orderId||notification.data?.orderId||"pedido").replace(/[^A-Za-z0-9_-]/g,"").slice(0,128)||"pedido";
 const tag=(driverNotice?"dishy-driver-":"dishy-order-")+orderId;
 const title=String(data.title||notification.title||"Dishy • atualização do pedido").slice(0,140);
 const body=String(data.body||notification.body||"Seu pedido recebeu uma atualização.").slice(0,250);
 const iconCandidate=String(data.icon||notification.icon||"");
 const icon=/^https:\/\/[^\s]+$/i.test(iconCandidate)?iconCandidate:"/dishy-icon.svg?v=20261102";
 const imageCandidate=String(data.image||notification.image||"");
 const image=/^https:\/\/[^\s]+$/i.test(imageCandidate)?imageCandidate:"";
 const options={
  body,icon,badge:"/dishy-icon.svg?v=20261102",
  ...(image?{image}:{}),
  tag,renotify:true,silent:false,
  ...(driverNotice?{vibrate:[180,100,180]}:{}),
  data:{kind:driverNotice?"driver":"customer",orderId,restaurantId:driverNotice?String(data.restaurantId||""):""},
  requireInteraction:data.event==="DRIVER_ARRIVED"
 };
 // Assumimos a entrega para garantir event.waitUntil e impedir o aviso genérico do Chrome.
 event.stopImmediatePropagation();
 event.waitUntil((async()=>{
  try{await self.registration.showNotification(title,options)}
  catch(error){
   console.error("dishy_push_show_failed",error?.message||String(error));
   await self.registration.showNotification("Dishy • atualização do pedido",{body:"O status do seu pedido mudou.",tag,renotify:true});
  }
  // Mantém o som e a atualização imediata do entregador no aplicativo aberto.
  if(driverNotice){
   try{
    const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of clients){
     if(client.visibilityState==="visible"){
      client.postMessage({isFirebaseMessaging:true,messageType:"push-received",data:{...data,swDisplayed:"1"}});
     }
    }
   }catch(error){console.warn("dishy_driver_push_forward_failed",error?.message||String(error))}
  }
 })());
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const data=event.notification.data||{};
 // Para clientes, a notificação é informativa: não abre links ou novas abas.
 if(data.kind!=="driver"||!/^[A-Za-z0-9_-]{5,128}$/.test(String(data.restaurantId||"")))return;
 const path="/?entregador="+encodeURIComponent(data.restaurantId);
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  const existing=windows.find(client=>{try{const url=new URL(client.url);return url.origin===self.location.origin&&url.searchParams.get("entregador")===data.restaurantId}catch{return false}});
  if(existing){await existing.focus();return}
  if(self.clients.openWindow)await self.clients.openWindow(path);
 })());
});