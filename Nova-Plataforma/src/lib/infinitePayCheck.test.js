import {test} from "node:test";
import assert from "node:assert/strict";
import {approvedInfinitePayment} from "../../api/_infinitepay.js";
test("InfinitePay confirma somente valor original exato",()=>{
 assert.equal(approvedInfinitePayment({success:true,paid:true,amount:2550,paid_amount:2600,capture_method:"credit_card"},2550),true);
 assert.equal(approvedInfinitePayment({success:true,paid:true,amount:2500,capture_method:"pix"},2550),false);
 assert.equal(approvedInfinitePayment({success:true,paid:false,amount:2550,capture_method:"pix"},2550),false);
 assert.equal(approvedInfinitePayment({success:true,paid:true,amount:2550,capture_method:"boleto"},2550),false);
});
