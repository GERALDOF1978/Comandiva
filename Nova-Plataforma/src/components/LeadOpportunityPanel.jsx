import React, { useMemo, useState } from "react";
import { analyzeOpportunity, messageForLead, normalizeDigitalAudit, safePublicUrl } from "../lib/leadIntelligence.js";

const label = { site: "Site comercial", menu: "Cardápio digital", orders: "Pedidos online" };
const options = [
  ["desconhecido", "Ainda não verificado"],
  ["sim", "Sim, identificado"],
  ["nao", "Não, conferi manualmente"],
];
const box = { background: "#121d2d", padding: 15, borderRadius: 12, border: "1px solid #465771" };
const field = { background: "#0f1724", borderRadius: 9, border: "1px solid #53647b", color: "#fff", width: "100%", maxWidth: "100%", padding: "10px 12px" };
const action = { border: "1px solid #50617c", background: "#293b54", color: "#fff", padding: "10px 14px", borderRadius: 9, cursor: "pointer", fontWeight: 700 };
const primary = { ...action, background: "#ff7900", color: "#151515", borderColor: "#ff7900" };
const linkStyle = { color: "#9ad4ff", fontSize: 13 };

export default function LeadOpportunityPanel({ lead, saving, onSave, onCancel }) {
  const [digitalAudit, setDigitalAudit] = useState(() => normalizeDigitalAudit(lead.digitalAudit, lead));
  const [followUpOn, setFollowUpOn] = useState(lead.followUpOn || "");
  const [notes, setNotes] = useState(lead.notes || "");
  const [copyNotice, setCopyNotice] = useState("");
  const localLead = { ...lead, digitalAudit };
  const analysis = useMemo(() => analyzeOpportunity(localLead), [lead, digitalAudit]);
  const pitch = messageForLead(localLead);
  const sources = [
    ["Site informado", lead.website],
    ["Cardápio informado", lead.menuUrl],
    ["Pedidos online informados", lead.orderUrl],
    ["Instagram informado", lead.instagramUrl],
    ["Facebook informado", lead.facebookUrl],
    ["Fonte do cadastro", lead.sourceUrl],
  ].map(([title, url]) => [title, safePublicUrl(url)]).filter(([, href]) => href);

  async function copyPitch() {
    try {
      await navigator.clipboard.writeText(pitch);
      setCopyNotice("Mensagem copiada. Revise antes de enviar.");
    } catch {
      setCopyNotice("Selecione o texto da mensagem para copiar manualmente.");
    }
  }
  function submit(event) {
    event.preventDefault();
    onSave(lead, { digitalAudit, followUpOn, notes });
  }

  return <form onSubmit={submit} style={{ ...box, display: "grid", gap: 16, marginTop: 14 }}>
    <header>
      <h4 style={{ margin: "0 0 6px", fontSize: 17 }}>Análise comercial de {lead.name}</h4>
      <p style={{ fontSize: 13, color: "#b6c6dc", margin: 0 }}>Os links abaixo vêm de fontes públicas. Abra e confira manualmente antes de marcar a ausência ou existência de um serviço. Não pesquisamos sites privados.</p>
    </header>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {sources.length ? sources.map(([title, href]) => <a key={title + href} style={linkStyle} href={href} target="_blank" rel="noopener noreferrer">{title}</a>) :
        <span style={{ fontSize: 13, color: "#b6c6dc" }}>Nenhum link informado na fonte. Isso não significa que o estabelecimento não tenha presença online.</span>}
    </div>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
      {Object.entries(label).map(([key, title]) => <label key={key} style={{ display: "grid", gap: 6 }}>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <select value={digitalAudit[key]} style={field} aria-label={"Situação do " + title} onChange={e => setDigitalAudit(value => ({ ...value, [key]: e.target.value }))}>
          {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>)}
    </section>
    <div style={{ ...box, background: "#1c2d41", display: "grid", gap: 6 }}>
      <strong>Prioridade comercial: {analysis.score}/100 · {analysis.level}</strong>
      <span style={{ fontSize: 13 }}>Sugestão: {analysis.recommendation}</span>
      <ul style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.5 }}>
        {analysis.reasons.map(reason => <li key={reason}>{reason}</li>)}
      </ul>
      {analysis.unknown.length > 0 && <small style={{ color: "#c8d5e7" }}>Ainda não verificado: {analysis.unknown.join(", ")}.</small>}
    </div>
    <label style={{ display: "grid", gap: 5 }}>
      <strong>Próximo contato (lembrete no próprio Master)</strong>
      <input style={{ ...field, maxWidth: 250 }} type="date" value={followUpOn} onChange={e => setFollowUpOn(e.target.value)} aria-label="Data de retorno" />
      <small style={{ color: "#b6c6dc" }}>O lembrete aparece no funil quando você abrir o Master. Não envia WhatsApp automaticamente.</small>
    </label>
    <label style={{ display: "grid", gap: 5 }}>
      <strong>Observações comerciais</strong>
      <textarea style={field} rows={3} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: conferi o cardápio, pediu demonstração, retornar na terça..." />
    </label>
    <section style={{ display: "grid", gap: 8 }}>
      <strong>Abordagem comercial personalizada</strong>
      <textarea style={{ ...field, fontSize: 13 }} readOnly rows={5} value={pitch} aria-label="Mensagem comercial sugerida" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <button type="button" style={{ ...action, opacity: lead.status === "nao_contatar" ? 0.5 : 1 }} disabled={lead.status === "nao_contatar"} onClick={copyPitch}>Copiar mensagem</button>
        {lead.status === "nao_contatar" && <small>Contato bloqueado: o estabelecimento foi marcado como não contatar.</small>}
        {copyNotice && <small role="status">{copyNotice}</small>}
      </div>
    </section>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
      <button type="submit" disabled={saving} style={{ ...primary, opacity: saving ? 0.6 : 1 }}>{saving ? "Salvando…" : "Salvar análise e retorno"}</button>
      <button type="button" onClick={onCancel} disabled={saving} style={action}>Fechar</button>
    </div>
  </form>;
}
