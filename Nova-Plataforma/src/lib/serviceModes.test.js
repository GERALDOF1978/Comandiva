import {test} from "node:test";
import assert from "node:assert/strict";
import {enabledServiceModes,validServiceModes} from "./serviceModes.js";
test("lojas antigas mantêm todos os modos",()=>assert.deepEqual(enabledServiceModes(undefined),["DELIVERY","PICKUP","TABLE","TAB"]));
test("cada loja escolhe modos separados",()=>assert.deepEqual(enabledServiceModes(["PICKUP","TAB"]),["PICKUP","TAB"]));
test("validação impede lista vazia e duplicados",()=>{assert.equal(validServiceModes([]),false);assert.equal(validServiceModes(["PICKUP","PICKUP"]),false);assert.equal(validServiceModes(["PICKUP","TAB"]),true)});
