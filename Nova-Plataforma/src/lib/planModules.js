// Catálogo de módulos para planos comerciais. O Painel Master NÃO pertence a nenhum plano.
export const PLAN_MODULES=[
  "Início","Pedidos","Cardápio","Clientes","Financeiro","Cozinha","PDV",
  "Mesas e comandas","Delivery","Entregadores","Promoções","Marketing",
  "Configurações","Meu plano","Funcionários e permissões","Equipe em serviço"
];
export const PLAN_ALWAYS_AVAILABLE=["Início","Configurações","Meu plano"];
export const PLAN_OPTIONAL_MODULES=PLAN_MODULES.filter(value=>!PLAN_ALWAYS_AVAILABLE.includes(value));
export function normalizePlanModules(modules){
  if(!Array.isArray(modules))return [...PLAN_MODULES]; // planos anteriores e teste não configurado
  const selected=new Set(modules);
  return PLAN_MODULES.filter(value=>PLAN_ALWAYS_AVAILABLE.includes(value)||selected.has(value));
}
export function validPlanModules(modules){
  return Array.isArray(modules)&&modules.length<=PLAN_MODULES.length
    &&modules.every(value=>typeof value==="string"&&PLAN_MODULES.includes(value))
    &&new Set(modules).size===modules.length;
}
