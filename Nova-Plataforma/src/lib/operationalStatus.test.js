import {test} from "node:test";
import assert from "node:assert/strict";
import {isAcceptingOrders} from "./operationalStatus.js";
test("legacy restaurants accept new orders by default",()=>assert.equal(isAcceptingOrders({published:true}),true));
test("explicitly closed restaurant does not accept new orders",()=>assert.equal(isAcceptingOrders({acceptingOrders:false}),false));
test("explicitly opened restaurant accepts new orders",()=>assert.equal(isAcceptingOrders({acceptingOrders:true}),true));
