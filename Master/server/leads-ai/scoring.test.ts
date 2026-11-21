import { describe, expect, it } from "vitest";
import { assessLead } from "./scoring";
describe("Dishy Leads AI lead scoring", () => {
  it("não qualifica segmentos desconhecidos", () => {
    expect(assessLead({}).eligible).toBe(false);
  });
  it("não presume ausência de recursos quando dados são desconhecidos", () => {
    expect(assessLead({ isRelevantFoodBusiness: true }).score).toBe(30);
  });
  it("pontua sinais negativos confirmados e contato público", () => {
    expect(assessLead({ isRelevantFoodBusiness: true, hasWebsite: false, hasDigitalMenu: false, hasOnlineOrdering: false, hasPublicBusinessContact: true }).score).toBe(100);
  });
});
