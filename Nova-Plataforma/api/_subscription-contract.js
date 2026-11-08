import {createHash} from "node:crypto";

// Texto-base para revisão jurídica. Nunca ativar aceites sem identificar o prestador real.
export const DISHY_CONTRACT_VERSION="2026-11-08-draft-1";
export const CONTRACT_REQUIRED_FIELDS=["issuerName","issuerDocument","issuerEmail","issuerAddress"];
export function contractIssuerReady(config){
 return config?.enabled===true &&
   CONTRACT_REQUIRED_FIELDS.every(k=>typeof config[k]==="string"&&config[k].trim().length>=5)&&
   /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.issuerEmail);
}
export function cleanContractContact(raw){
 return String(raw||"").replace(/\D/g,"").slice(0,13);
}
export function createSubscriptionContractText({issuer,customer,restaurant,plan,acceptedAt}){
 const name=String(issuer.issuerName||"").trim(),doc=String(issuer.issuerDocument||"").trim();
 const client=String(customer.name||"").trim(),clientDoc=String(customer.document||"").trim();
 const planName=String(plan.name||"").trim(),amount=(Number(plan.priceCents)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const modules=(Array.isArray(plan.modules)?plan.modules:[]).join(", ");
 const when=new Date(acceptedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"});
 return `CONTRATO DE LICENÇA DE USO E PRESTAÇÃO DE SERVIÇOS — DISHY
Versão: ${DISHY_CONTRACT_VERSION}
Prestador responsável: ${name} — Documento: ${doc}
Endereço: ${issuer.issuerAddress}
Contato: ${issuer.issuerEmail}
Contratante: ${client} — Documento: ${clientDoc}
Estabelecimento: ${restaurant.name}
E-mail cadastrado: ${customer.email}
Data e horário da manifestação de aceite: ${when} (Brasília)

1. OBJETO. O prestador identificado acima disponibiliza ao contratante, enquanto vigente a assinatura, acesso não exclusivo ao software Dishy para gestão do estabelecimento e aos módulos correspondentes ao plano contratado.

2. PLANO E PREÇO. Plano: ${planName}. Mensalidade de referência: ${amount}. Recursos contratados: ${modules}. Alterações de plano e preço exigem nova comunicação e aceite quando mudarem os termos essenciais. Não se presume autorização para débito automático.

3. TESTE GRATUITO. Novos cadastros podem receber até 37 dias gratuitos nas condições da oferta vigente. O período gratuito não gera cobrança automática nem autoriza débito ou renovação onerosa sem contratação expressa.

4. PAGAMENTO E ATIVAÇÃO. As condições de cobrança, vencimento e meio de pagamento devem ser apresentadas e confirmadas antes da cobrança. O aceite deste contrato, isoladamente, não comprova quitação, não processa pagamento e não ativa um plano pago. A ativação depende de pagamento confirmado e registrado pelo prestador.

5. USO DO SERVIÇO. O contratante responde pelos dados de seu cardápio, produtos, preços, funcionamento, funcionários, tributos e atendimento ao consumidor. É proibido compartilhar acessos de forma insegura, usar a plataforma para fraude ou realizar práticas ilícitas.

6. DADOS E SEGURANÇA. As partes devem observar a legislação de proteção de dados aplicável. O contratante é responsável pelas decisões referentes aos dados pessoais de seus clientes no serviço e o prestador atua conforme as funções efetivamente exercidas. Medidas de segurança e obrigações de cada parte serão detalhadas na política de privacidade e nos instrumentos pertinentes.

7. SUPORTE E DISPONIBILIDADE. O suporte é disponibilizado pelos canais informados no aplicativo. Interrupções programadas ou incidentes serão comunicados quando cabível. Eventuais garantias de disponibilidade e prazos de atendimento somente valem quando formalmente pactuados.

8. CANCELAMENTO, INADIMPLÊNCIA E DADOS. O cliente poderá solicitar cancelamento pelos canais disponibilizados. Não haverá cobrança futura indevida após cancelamento efetivo, ressalvados valores legitimamente devidos. Eventual suspensão por inadimplência exige comunicação prévia e respeito às condições contratadas. Os procedimentos e prazos de exportação e exclusão de dados devem observar a política comunicada ao contratante e a legislação.

9. DOCUMENTOS FISCAIS. As obrigações de emissão de documentos fiscais aplicáveis permanecem sob responsabilidade do prestador efetivo, conforme a legislação. Um comprovante de pagamento não substitui documento fiscal quando este for obrigatório.

10. ACEITE ELETRÔNICO E COMUNICAÇÕES. O contratante concorda com o uso de meio eletrônico para manifestação de aceite e recebimento de cópia do contrato pelo e-mail informado e, mediante concordância, WhatsApp. O registro técnico do aceite, a identificação da conta e o resumo criptográfico do documento são mantidos para comprovação. Comunicações contratuais não autorizam marketing não solicitado.

11. LEGISLAÇÃO E DISPOSIÇÕES GERAIS. Aplicam-se as normas brasileiras pertinentes. As partes buscarão solução amigável para divergências, respeitadas as regras legais de competência e proteção do consumidor quando aplicáveis.

Este documento reflete as condições aceitas pelo contratante. A versão integral e seu resumo criptográfico deverão ser preservados pelo Dishy. Redigido como minuta inicial, sujeito à revisão jurídica antes da ativação comercial.`;
}
export function contractHash(text){return createHash("sha256").update(text,"utf8").digest("hex")}
