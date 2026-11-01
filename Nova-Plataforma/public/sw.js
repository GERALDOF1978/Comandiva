/* Dishy PWA + Firebase Cloud Messaging: um único service worker para a raiz do aplicativo.
   Não interceptar navegação, APIs nem dados de estabelecimentos. */
const CACHE="dishy-static-v3";
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/dishy-icon.svg","/manifest.webmanifest"])));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
/* Sem fetch handler: preserva as rotas e evita interceptação de pedidos. */
try{
 importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
 importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
 firebase.initializeApp({
  apiKey:"AIzaSyDRz-z-eYe1WKQxjuC60EUbrSXEeACBiGA",
  authDomain:"saas-delivery-551a4.firebaseapp.com",
  projectId:"saas-delivery-551a4",
  messagingSenderId:"636977701177",
  appId:"1:636977701177:web:661d9d4ea96e6fe371c8e8"
 });
 const messaging=firebase.messaging();
 messaging.onBackgroundMessage(payload=>{
  const data=payload.data||{};
  const title=String(data.title||"Atualização do pedido");
  const body=String(data.body||"Confira o andamento do seu pedido.");
  const icon=/^https:\/\//i.test(data.icon||"")?data.icon:"/dishy-icon.svg?v=20261030-d";
  const image=/^https:\/\//i.test(data.image||"")?data.image:null;
  return self.registration.showNotification(title,{
   body,icon,...(image?{image}:{}),
   badge:"/dishy-icon.svg?v=20261030-d",
   tag:"dishy-order-"+String(data.orderId||"pedido"),
   renotify:true,data:{orderId:String(data.orderId||"")},
   requireInteraction:data.event==="DRIVER_ARRIVED"
  });
 });
}catch(error){console.error("dishy_push_worker_setup_failed",error?.message||String(error));}
self.addEventListener("notificationclick",event=>{event.notification.close();});
