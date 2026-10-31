import {getMessaging} from "firebase-admin/messaging";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
export async function notifyCustomerPush(restaurantId,orderId,order,event){
 if(!order?.customerUid){console.warn("dishy_push_missing_customer_uid",{restaurantId,orderId,event});return 0;}
 const db=getFirestore();
 const subscriptions=await db.collection("restaurants").doc(restaurantId).collection("pushSubscriptions").where("uid","==",order.customerUid).limit(30).get();
 if(subscriptions.empty){console.warn("dishy_push_no_subscription",{restaurantId,orderId,event});return 0;}
 const number=String(order.number||orderId);
 const titles={ACCEPTED:"Seu pedido foi aceito!",PREPARING:"Seu pedido está em preparo!",COMPLETED:"Seu pedido foi concluído!",READY:"Seu pedido está pronto!",OUT_FOR_DELIVERY:"Seu pedido saiu para entrega!",DRIVER_ARRIVED:"Seu entregador chegou!"};
 const bodies={ACCEPTED:`Pedido #${number} confirmado pelo restaurante.`,PREPARING:`O restaurante está preparando seu pedido #${number}.`,COMPLETED:`Pedido #${number} concluído. Obrigado pela preferência!`,READY:`Pedido #${number} pronto para retirada ou entrega.`,OUT_FOR_DELIVERY:`Pedido #${number} está a caminho.`,DRIVER_ARRIVED:`O motoboy chegou com o pedido #${number}. Tenha em mãos seu código de confirmação.`};
 if(!titles[event])return 0;
 const slug=String(order.restaurantSlug||"");
 const host=String(process.env.PAYMENT_PUBLIC_HOST||"dishy.com.br").replace(/^https?:\/\//,"").replace(/\/$/,"");
 const link="https://"+host+(slug?"/?loja="+encodeURIComponent(slug):"/");
 const tokens=subscriptions.docs.map(d=>d.data().token);
 const result=await getMessaging().sendEachForMulticast({tokens,data:{title:titles[event],body:bodies[event],url:link,orderId:String(orderId),event},webpush:{headers:{Urgency:"high"}}},false);
 console.info("dishy_push_result",{restaurantId,orderId,event,success:result.successCount,failure:result.failureCount,errors:result.responses.filter(x=>!x.success).map(x=>x.error?.code||"unknown")});
 await Promise.all(result.responses.map(async(response,i)=>{if(!response.success&&["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(response.error?.code))await subscriptions.docs[i].ref.delete()}));
 return result.successCount;
}
