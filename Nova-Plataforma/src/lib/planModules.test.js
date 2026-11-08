import test from "node:test";
import assert from "node:assert/strict";
import {PLAN_MODULES,PLAN_ALWAYS_AVAILABLE,normalizePlanModules,validPlanModules} from "./planModules.js";

test("planos antigos e teste sem configuração preservam todos os módulos",()=>{
 assert.deepEqual(normalizePlanModules(undefined),PLAN_MODULES);
 assert.deepEqual(normalizePlanModules(null),PLAN_MODULES);
});
test("um plano pode liberar apenas um conjunto escolhido, mantendo as telas essenciais",()=>{
 const modules=normalizePlanModules(["PDV","Pedidos"]);
 assert.deepEqual(modules,PLAN_MODULES.filter(m=>PLAN_ALWAYS_AVAILABLE.includes(m)||["PDV","Pedidos"].includes(m)));
 assert.equal(modules.includes("Financeiro"),false);
 assert.equal(modules.includes("Meu plano"),true);
});
test("um plano explicitamente sem opcionais não é interpretado como plano completo",()=>{
 assert.deepEqual(normalizePlanModules([]),PLAN_ALWAYS_AVAILABLE);
});
test("não aceita módulos desconhecidos, repetidos ou dados malformados",()=>{
 assert.equal(validPlanModules(["PDV","Pedidos"]),true);
 assert.equal(validPlanModules(["PDV","PDV"]),false);
 assert.equal(validPlanModules(["Área administrativa Master"]),false);
 assert.equal(validPlanModules("PDV"),false);
 assert.equal(validPlanModules(null),false);
});
