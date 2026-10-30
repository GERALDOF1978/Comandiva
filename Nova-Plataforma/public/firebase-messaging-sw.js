importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
firebase.initializeApp({apiKey:"AIzaSyDRz-z-eYe1WKQxjuC60EUbrSXEeACBiGA",authDomain:"saas-delivery-551a4.firebaseapp.com",projectId:"saas-delivery-551a4",messagingSenderId:"636977701177",appId:"1:636977701177:web:661d9d4ea96e6fe371c8e8"});
firebase.messaging();
self.addEventListener("notificationclick",event=>{event.notification.close();const url=event.notification.data?.url||"/";event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(windows=>{const target=windows.find(w=>w.url.includes(url));return target?target.focus():clients.openWindow(url)}))});
