// Priorização explicável: somente atributos afirmativos, sem inferir
// que um estabelecimento não possui recursos quando a fonte não os informa.
export function leadScore(input = {}) {
  let score = 30;
  const reasons = ["Estabelecimento identificado no setor de alimentação."];
  if (input.phone) { score += 15; reasons.push("Contato comercial público disponível."); }
  if (input.website) { score += 5; reasons.push("Site comercial identificado."); }
  if (input.segment !== "outro") { score += 10; reasons.push("Segmento atendido pelo Dishy."); }
  return { score, reasons };
}
