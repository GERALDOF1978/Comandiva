/** Dishy Leads AI — avaliação determinística de oportunidades.
 * Sem chamadas externas, sem acesso a dados de restaurantes e sem efeitos colaterais.
 */
export type LeadSignals = {
  hasWebsite?: boolean | null;
  hasOnlineOrdering?: boolean | null;
  hasDigitalMenu?: boolean | null;
  hasPublicBusinessContact?: boolean | null;
  isRelevantFoodBusiness?: boolean | null;
};
export type LeadAssessment = { score: number; reasons: string[]; eligible: boolean };
export function assessLead(signals: LeadSignals): LeadAssessment {
  if (signals.isRelevantFoodBusiness !== true) {
    return { score: 0, reasons: ["Segmento não confirmado como alimentação."], eligible: false };
  }
  let score = 30;
  const reasons: string[] = ["Estabelecimento do setor alimentício."];
  if (signals.hasWebsite === false) { score += 15; reasons.push("Sem site identificado na fonte consultada."); }
  if (signals.hasDigitalMenu === false) { score += 20; reasons.push("Sem cardápio digital identificado na fonte consultada."); }
  if (signals.hasOnlineOrdering === false) { score += 25; reasons.push("Sem pedidos online identificados na fonte consultada."); }
  if (signals.hasPublicBusinessContact === true) { score += 10; reasons.push("Canal comercial público disponível."); }
  return { score: Math.min(100, score), reasons, eligible: true };
}
