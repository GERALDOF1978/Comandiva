import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const script=readFileSync(new URL("../../public/sw.js",import.meta.url),"utf8");
function makeWorker(visibleClients=[]){
 const handlers={};
 const notices=[];
 const opened=[];
 const self={
  location:{origin:"https://dishy-teste.onrender.com"},
  addEventListener:(name,fn)=>{handlers[name]=fn},
  skipWaiting:()=>{},
  clients:{
   claim:async()=>{},
   matchAll:async()=>visibleClients,
   openWindow:async(path)=>{opened.push(path)}
  },
  registration:{showNotification:async(title,options)=>{notices.push({title,options})}}
 };
 const context={self,caches:{open:async()=>({addAll:async()=>{}}),keys:async()=>[],delete:async()=>{}},console,URL};
 vm.runInNewContext(script,context);
 async function dispatch(payload){
  let pending,stopped=false;
  handlers.push({
   data:{json:()=>payload},
   stopImmediatePropagation:()=>{stopped=true},
   waitUntil:promise=>{pending=promise}
  });
  assert.equal(stopped,true);
  assert.ok(pending);
  await pending;
 }
 return {handlers,notices,opened,dispatch};
}
test("notificação de pedido usa título e logo do restaurante e substitui etapa anterior",async()=>{
 const w=makeWorker();
 const data={kind:"customer",event:"ACCEPTED",orderId:"pedido10",title:"Pedido aceito",body:"Seu pedido foi confirmado",icon:"https://example.com/logo.webp"};
 await w.dispatch({data});
 await w.dispatch({data:{...data,event:"READY",title:"Pedido pronto"}});
 assert.equal(w.notices.length,2);
 assert.equal(w.notices[0].title,"Pedido aceito");
 assert.equal(w.notices[1].title,"Pedido pronto");
 assert.equal(w.notices[0].options.icon,"https://example.com/logo.webp");
 assert.equal(w.notices[0].options.tag,"dishy-order-pedido10");
 assert.equal(w.notices[1].options.tag,"dishy-order-pedido10");
 assert.equal(w.notices[1].options.renotify,true);
 assert.equal(w.notices[1].options.data.kind,"customer");
 assert.equal(w.notices[1].options.data.url,undefined);
});
test("push com payload inválido mantém uma notificação informativa",async()=>{
 const w=makeWorker();
 await w.dispatch({});
 assert.match(w.notices[0].title,/Dishy/);
 assert.match(w.notices[0].options.body,/pedido/);
});
test("entregador recebe notificação e mensagem para tocar o alerta na tela aberta",async()=>{
 const messages=[];
 const client={visibilityState:"visible",postMessage:msg=>messages.push(msg)};
 const w=makeWorker([client]);
 await w.dispatch({data:{kind:"driver",event:"DRIVER_ASSIGNED",orderId:"z42",restaurantId:"abcde12345",title:"Entrega atribuída",body:"Seu novo pedido"}});
 assert.equal(w.notices[0].options.tag,"dishy-driver-z42");
 assert.equal(w.notices[0].options.data.kind,"driver");
 assert.equal(messages.length,1);
 assert.equal(messages[0].isFirebaseMessaging,true);
 assert.equal(messages[0].data.swDisplayed,"1");
});
test("clicar na notificação do cliente não abre nenhum endereço",async()=>{
 const w=makeWorker();
 w.handlers.notificationclick({notification:{data:{kind:"customer"},close:()=>{}},waitUntil:()=>{throw Error("Cliente não deve abrir página")}});
 assert.equal(w.opened.length,0);
});
