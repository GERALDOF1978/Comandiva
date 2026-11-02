import test from "node:test";
import assert from "node:assert/strict";
import {STAFF_MODULES,canAccessModule,canAccessAnyModule} from "./staffPermissions.js";
test("proprietário mantém acesso completo",()=>assert.equal(canAccessModule({role:"owner",active:true},"Financeiro"),true));
test("funcionário inativo não consegue agir",()=>assert.equal(canAccessModule({role:"attendant",active:false,permissions:["PDV"]},"PDV"),false));
test("gerente não recebe módulos além dos autorizados",()=>assert.equal(canAccessModule({role:"manager",active:true,permissions:["Pedidos"]},"Financeiro"),false));
test("PDV e turno podem ser concedidos",()=>{assert.ok(STAFF_MODULES.includes("PDV"));assert.ok(STAFF_MODULES.includes("Equipe em serviço"));assert.equal(canAccessAnyModule({role:"attendant",active:true,permissions:["PDV"]},["PDV","Pedidos"]),true)});
test("módulo desconhecido não pode ser autorizado",()=>assert.equal(canAccessModule({role:"owner",active:true},"Master"),false));
