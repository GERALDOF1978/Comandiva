import test from "node:test";
import assert from "node:assert/strict";
import handler from "./delivery-route.js";

async function call(body,method="POST",fetchImpl=globalThis.fetch){
 const prev=globalThis.fetch;
 globalThis.fetch=fetchImpl;
 const res={statusCode:200,status(n){this.statusCode=n;return this},json(data){this.body=data;return this}};
 try{await handler({method,body},res);return res}finally{globalThis.fetch=prev}
}
test("rejeita ação desconhecida",async()=>assert.equal((await call({action:"deleteRestaurant"})).statusCode,400));
test("rejeita geocode com endereço longo",async()=>assert.equal((await call({action:"geocode",address:{address:"A".repeat(241),number:"2",city:"Rio Claro",state:"SP"}})).statusCode,400));
test("rejeita muitos endereços alternativos",async()=>assert.equal((await call({origin:{address:"A"},destination:{address:"B",fallbackAddresses:["a","b","c","d"]}})).statusCode,400));
test("rejeita coordenadas fora da faixa",async()=>assert.equal((await call({origin:{latitude:-95,longitude:10},destination:{latitude:1,longitude:1}})).statusCode,400));
test("rejeita método GET",async()=>assert.equal((await call({},"GET")).statusCode,405));
test("calcula rota com coordenadas válidas",async()=>{
 const mock=async()=>({ok:true,json:async()=>({code:"Ok",routes:[{distance:4000,duration:700}]})});
 const res=await call({origin:{latitude:-22.41,longitude:-47.56},destination:{latitude:-22.42,longitude:-47.57}},"POST",mock);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.distanceKm,4);
});
