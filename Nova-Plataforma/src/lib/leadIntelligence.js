// Análise comercial baseada em evidências públicas e revisão humana.
// "Não informado" NÃO significa "não existe". Sem crawling nem IA generativa.
const VALID = new Set(["sim","nao","desconhecido"]);
const CAPABILITY = {
  pizzaria: "montagem de pizzas por tamanho, sabores, bordas e adicionais",
  hamburgueria: "combos, adicionais e pedidos online de lanches",
  lanchonete: "cardápio digital, pedidos e retirada",
  marmitaria: "marmitas com tamanhos, proteínas e guarnições",
  acaiteria: "açaí com tamanhos e complementos",
  restaurante: "cardápio digital, PDV, mesas e delivery",
  cafeteria: "cardápio digital e retirada de pedidos",
  padaria: "cardápio, pedidos e retirada",
};
export function safePublicUrl(value) {
  if (!value || typeof value !== "string" || value.length > 500) return "";
  try {
    const u = new URL(value.trim());
    return ["https:","http:"].includes(u.protocol) && u.hostname && !u.username && !u.password ? u.href : "";
  } catch { return ""; }
}
export function normalizeDigitalAudit(raw = {}, lead = {}) {
  const baseline = {
    site: safePublicUrl(lead.website) ? "sim" : "desconhecido",
    menu: safePublicUrl(lead.menuUrl) ? "sim" : "desconhecido",
    orders: safePublicUrl(lead.orderUrl) ? "sim" : "desconhecido",
  };
  const normalized = { ...baseline };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const key of ["site","menu","orders"]) {
      if (VALID.has(raw[key])) normalized[key] = raw[key];
    }
  }
  return normalized;
}
export function analyzeOpportunity(lead = {}) {
  const audit = normalizeDigitalAudit(lead.digitalAudit, lead);
  const reasons = [], unknown = [];
  let score = 20;
  const segment = String(lead.segment || "");
  if (CAPABILITY[segment]) { score += 15; reasons.push("Segmento com recursos específicos no Dishy."); }
  if (String(lead.phone || "").replace(/\D/g,"").length >= 10) { score += 10; reasons.push("Telefone comercial informado."); }
  const gains = { site: 15, menu: 20, orders: 25 };
  const titles = { site: "site", menu: "cardápio digital", orders: "pedidos online" };
  for (const key of ["site","menu","orders"]) {
    if (audit[key] === "nao") {
      score += gains[key];
      reasons.push("Ausência de " + titles[key] + " registrada após verificação manual.");
    } else if (audit[key] === "desconhecido") {
      unknown.push(titles[key]);
    } else if (key === "orders") score -= 8;
    else if (key === "menu") score -= 5;
  }
  score = Math.max(0, Math.min(100,score));
  if (!reasons.length) reasons.push("Ainda faltam dados comerciais para avaliar a oportunidade.");
  const level = score >= 70 ? "Alta" : score >= 50 ? "Média" : "Em análise";
  return {
    score, level, reasons, unknown, audit,
    recommendation: audit.orders === "nao" ? "Mostrar como centralizar os pedidos online." :
      audit.menu === "nao" ? "Apresentar o cardápio digital interativo." :
      unknown.length ? "Conferir os canais atuais antes de oferecer a solução." :
      "Entender o fluxo atual de pedidos e identificar melhorias.",
    verified: Object.values(audit).some(value => value === "nao"),
  };
}
export function messageForLead(lead = {}) {
  const first = String(lead.name || "seu estabelecimento").trim().slice(0, 90);
  const area = CAPABILITY[lead.segment] || "cardápio digital e organização de pedidos";
  const audit = normalizeDigitalAudit(lead.digitalAudit, lead);
  const sentence = audit.orders === "nao"
    ? "Podemos mostrar como receber e organizar pedidos online sem depender de anotações manuais."
    : audit.menu === "nao"
      ? "Podemos mostrar como criar um cardápio digital interativo para os clientes."
      : "Gostaria de conhecer como você recebe e organiza os pedidos hoje.";
  return "Olá! Tudo bem? Sou da Dishy. Conheci " + first + " e gostaria de apresentar uma solução para " + area + ". " +
    sentence + " Posso compartilhar uma demonstração rápida? https://dishy.com.br/demonstracao";
}
export function followUpState(date, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return "sem_data";
  const d = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== date) return "sem_data";
  const today = now.toISOString().slice(0, 10);
  return date < today ? "atrasado" : date === today ? "hoje" : "futuro";
}
export function validFollowUpDate(date) {
  if (date === "" || date === null) return true;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === date &&
    date >= "2020-01-01" && date <= "2100-12-31";
}
