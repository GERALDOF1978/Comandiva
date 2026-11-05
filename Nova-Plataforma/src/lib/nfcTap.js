// InfiniteTap deep link: callback URL is never proof of payment.
export function buildInfiniteTapLink({amountCents,orderId,handle,paymentMethod="debit",installments=1}){
 if(!Number.isSafeInteger(amountCents)||amountCents<100||amountCents>100000000)throw Error("invalid_tap_amount");
 if(!/^[A-Za-z0-9_-]{5,128}$/.test(orderId))throw Error("invalid_tap_order");
 if(!/^[A-Za-z0-9_.-]{2,64}$/.test(handle))throw Error("invalid_tap_handle");
 if(!["credit","debit"].includes(paymentMethod))throw Error("invalid_tap_method");
 if(!Number.isInteger(installments)||installments<1||installments>12||(paymentMethod==="debit"&&installments!==1)||Math.floor(amountCents/installments)<100)throw Error("invalid_tap_installments");
 const resultUrl="https://dishy.com.br/login?tap_return=1";
 const params=new URLSearchParams({amount:String(amountCents),order_id:orderId,handle,payment_method:paymentMethod,installments:String(installments),result_url:resultUrl,app_client_referrer:"Dishy"});
 return "infinitepaydash://infinitetap-app?"+params.toString();
}
