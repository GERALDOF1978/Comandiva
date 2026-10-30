import {getMessaging} from "firebase-admin/messaging";
import {getFirestore,FieldValue} from "firebase-admin/firestore";
export async function notifyCustomerPush(restaurantId,orderId,order,event){
 if(!order?.customerUid)return;
 const db=getFirestore();
 const subscriptions=await db.collection("restaurants").doc(restaurantId).collection("pushSubscriptions").where("uid","==",order.customerUid).limit(30).get();
 if(subscriptions.empty)return;
 const number=String(order.number||orderId);
 const titles={READY:"Seu pedido está pronto!",OUT_FOR_DELIVERY:"Seu pedido saiu para entrega!",DRIVER_ARRIVED:"Seu entregador chegou!"};
 const bodies={READY:`Pedido #${number} pronto para retirada ou entrega.`,OUT_FOR_DELIVERY:`Pedido #${number} está a caminho.`,DRIVER_ARRIVED:`O motoboy chegou com o pedido #${number}. Tenha em mãos seu código de confirmação.`};
 if(!titles[event])return;
 const slug=String(order.restaurantSlug||"");
 const link=slug?"/?loja="+encodeURIComponent(slug):"/";
 const tokens=subscriptions.docs.map(d=>d.data().token);
 const result=await getMessaging().sendEachForMulticast({tokens,notification:{title:titles[event],body:bodies[event]},webpush:{fcmOptions:{link},notification:{icon:"/favicon.ico",tag:"dishy-"+orderId+"-"+event,requireInteraction:event==="DRIVER_ARRIVED"}}},false);
 await Promise.all(result.responses.map(async(response,i)=>{if(!response.success&&["messaging/registration-token-not-registered","messaging/invalid-registration-token"].includes(response.error?.code))await subscriptions.docs[i].ref.delete()}));
 return result.successCount;
}
