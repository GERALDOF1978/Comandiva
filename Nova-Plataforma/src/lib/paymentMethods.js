export const AVAILABLE_PAYMENT_METHODS=Object.freeze(["PIX","CASH","CARD_ON_DELIVERY"]);
export const DEFAULT_PAYMENT_METHODS=Object.freeze([...AVAILABLE_PAYMENT_METHODS]);
/** Sem configuração explícita, mantém os métodos presenciais existentes. */
export function enabledPaymentMethods(config){
 if(!Array.isArray(config))return [...DEFAULT_PAYMENT_METHODS];
 return [...new Set(config.filter(method=>AVAILABLE_PAYMENT_METHODS.includes(method)))];
}
export function validPaymentMethods(config){
 return Array.isArray(config)&&config.length>=1&&config.length<=AVAILABLE_PAYMENT_METHODS.length&&config.every(method=>AVAILABLE_PAYMENT_METHODS.includes(method))&&new Set(config).size===config.length;
}
export const paymentMethodDescriptions={
 PIX:"PIX pelo Mercado Pago",
 CASH:"Dinheiro",
 CARD_ON_DELIVERY:"Cartão na maquininha"
};
