// Monta somente dados reais do pedido, que o n8n usa na primeira mensagem.
export function acceptedWhatsAppPayload({order,restaurant,orderId,fallbackInstance="",menuHost="dishy.com.br"}){
 const o=order||{},r=restaurant||{};
 const phone=String(o.customerSnapshot?.phone||"").replace(/\D/g,"");
 const instance=String(r.whatsappInstance||fallbackInstance||"").trim();
 const items=(Array.isArray(o.items)?o.items:[]).map(i=>({
  qty:Number(i.qty),name:String(i.name||"").trim(),
  totalCents:Number(i.totalCents??Number(i.unitPriceCents||i.priceCents||0)*Number(i.qty||0)),
  options:Array.isArray(i.options)?i.options.map(opt=>({name:String(opt?.name||"").trim()})).filter(opt=>opt.name):[]
 }));
 const slug=String(r.slug||"").trim();
 const host=String(menuHost||"dishy.com.br").replace(/^https?:\/\//i,"").replace(/\/.*$/,"").trim();
 const trackingUrl=/^[a-z0-9-]{1,90}$/.test(slug)&&/^[a-z0-9.-]+(?::\d+)?$/i.test(host)?"https://"+host+"/?loja="+encodeURIComponent(slug):"";
 return {event:"ORDER_ACCEPTED",restaurantName:String(r.name||r.displayName||"Restaurante"),
  customerName:String(o.customerSnapshot?.name||"Cliente"),orderNumber:String(o.number||orderId),
  customerPhone:phone,whatsappInstance:instance,items,totalCents:Number(o.totalCents||0),
  deliveryFeeCents:Number(o.deliveryFeeCents||0),channel:String(o.channel||""),
  paymentMethod:String(o.paymentMethod||""),paymentStatus:String(o.paymentStatus||"PENDING"),
  ...(trackingUrl?{trackingUrl}:{})};
}
