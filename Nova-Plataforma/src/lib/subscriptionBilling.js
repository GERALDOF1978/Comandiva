// Funções puras, compartilhadas entre cobranças e testes. Nenhum segredo aqui.
export const DISHY_SUBSCRIPTION_ORDER_PREFIX="dishy-sub-";
export const DISHY_INVOICE_MIN_CENTS=100;
export function toMillis(raw){
 if(raw instanceof Date)return raw.getTime();
 if(typeof raw?.toMillis==="function")return raw.toMillis();
 if(typeof raw?.toDate==="function")return raw.toDate().getTime();
 if(typeof raw==="string")return Date.parse(raw);
 if(typeof raw?.seconds==="number")return raw.seconds*1000;
 if(typeof raw==="number")return raw;
 return NaN;
}
export function addCalendarMonth(startMs){
 if(!Number.isFinite(startMs))throw Error("invalid_month_start");
 const d=new Date(startMs),day=d.getUTCDate(),year=d.getUTCFullYear(),month=d.getUTCMonth();
 const lastDay=new Date(Date.UTC(year,month+2,0)).getUTCDate();
 return Date.UTC(year,month+1,Math.min(day,lastDay),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds());
}
export function billingAnchor(subscription){
 const paid=toMillis(subscription?.paidUntil);
 if(Number.isFinite(paid)&&paid>0)return "r"+paid;
 return "initial";
}
export function subscriptionInvoiceId(restaurantId,subscription){
 if(!/^[a-zA-Z0-9_-]{5,128}$/.test(restaurantId))throw Error("invalid_restaurant");
 return restaurantId+"_"+billingAnchor(subscription);
}
export function subscriptionOrderNsu(invoiceId){
 if(!/^[a-zA-Z0-9_-]{5,160}$/.test(invoiceId))throw Error("invalid_invoice");
 return DISHY_SUBSCRIPTION_ORDER_PREFIX+invoiceId;
}
export function parseSubscriptionOrderNsu(orderNsu){
 if(typeof orderNsu!=="string"||!orderNsu.startsWith(DISHY_SUBSCRIPTION_ORDER_PREFIX))return null;
 const id=orderNsu.slice(DISHY_SUBSCRIPTION_ORDER_PREFIX.length);
 return /^[a-zA-Z0-9_-]{5,160}$/.test(id)?id:null;
}
export function checkoutPaymentApproved(response,expectedCents){
 return response?.success===true&&response?.paid===true&&
  Number.isSafeInteger(response.amount)&&response.amount===expectedCents&&
  ["pix","credit_card"].includes(response.capture_method);
}
export function currentPlanPeriodStart(subscription,nowMs=Date.now()){
 const paid=toMillis(subscription?.paidUntil),trial=subscription?.status==="trial"?toMillis(subscription.trialEndsAt):NaN;
 if(Number.isFinite(paid)&&paid>nowMs)return paid;
 if(Number.isFinite(trial)&&trial>nowMs)return trial;
 return nowMs;
}
export function billableNow(subscription,nowMs=Date.now()){
 const paid=toMillis(subscription?.paidUntil);
 const trial=subscription?.status==="trial"?toMillis(subscription.trialEndsAt):NaN;
 const anchor=Number.isFinite(paid)&&paid>nowMs?paid:Number.isFinite(trial)&&trial>nowMs?trial:NaN;
 return !Number.isFinite(anchor)||anchor-nowMs<=7*86400000;
}
