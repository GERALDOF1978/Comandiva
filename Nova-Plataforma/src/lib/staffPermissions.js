// Regra de permissão aplicada também nas APIs, nunca só escondendo botões.
export const STAFF_MODULES=Object.freeze(["Equipe em serviço","Início","Pedidos","Cardápio","Clientes","Financeiro","Cozinha","PDV","Mesas e comandas","Delivery","Entregadores","Promoções","Marketing","Configurações","Meu plano","Funcionários e permissões"]);
export function canAccessModule(member, module){
 if(!member||member.active!==true||!STAFF_MODULES.includes(module))return false;
 if(member.role==="owner")return true;
 return Array.isArray(member.permissions)&&member.permissions.includes(module);
}
export function canAccessAnyModule(member, modules){
 return Array.isArray(modules)&&modules.some(module=>canAccessModule(member,module));
}
