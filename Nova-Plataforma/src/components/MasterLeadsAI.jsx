import React, { useCallback, useEffect, useMemo, useState } from "react";

const box = { background: "#18202e", border: "1px solid #364252", borderRadius: 14, padding: 16 };
const input = { background: "#101722", color: "#fff", border: "1px solid #566174", padding: "10px 12px", borderRadius: 8, width: "100%", minWidth: 0 };
const button = { border: "1px solid #3e4d62", borderRadius: 9, padding: "10px 14px", color: "#fff", background: "#293a52", fontWeight: 700, cursor: "pointer" };
const primary = { ...button, background: "#ff7900", color: "#161616", border: "1px solid #ff7900" };
const muted = { color: "#bdc8d8", fontSize: 13 };
const statusLabels = { novo: "Novo", contatado: "Contatado", interessado: "Interessado", demonstracao: "Demonstração", cliente: "Cliente", nao_contatar: "Não contatar" };
const categoryLabels = { todos: "Todos", restaurante: "Restaurantes", pizzaria: "Pizzarias", hamburgueria: "Hamburguerias", lanchonete: "Lanchonetes", acaiteria: "Açaíterias", marmitaria: "Marmitarias", cafeteria: "Cafeterias", padaria: "Padarias" };
const emptyLead = { name: "", city: "Rio Claro", state: "SP", segment: "restaurante", address: "", phone: "", website: "", notes: "" };

function salesMessage(lead) {
  const intro = "Olá! Tudo bem? Sou da Dishy e encontrei o estabelecimento " + lead.name + ".";
  return intro + " Trabalhamos com cardápio digital, pedidos online, PDV, delivery e PIX para negócios de alimentação. Posso lhe mostrar uma demonstração do sistema? https://dishy.com.br";
}
function getHttpUrl(text) {
  try { const u = new URL(text); return ["https:", "http:"].includes(u.protocol) ? u.href : null; } catch { return null; }
}
function normalPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const normalized = digits.length === 10 || digits.length === 11 ? "55" + digits : digits;
  return normalized.length >= 12 && normalized.length <= 13 ? normalized : "";
}
function BusinessCard({ lead, saved, saving, onAdd }) {
  const sourceUrl = getHttpUrl(lead.sourceUrl);
  const website = getHttpUrl(lead.website);
  return <article style={{ ...box, display: "grid", gap: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <strong style={{ fontSize: 16 }}>{lead.name}</strong>
        <p style={{ ...muted, margin: "4px 0 0" }}>{categoryLabels[lead.segment] || lead.segment} · {lead.city} / {lead.state}{lead.distanceKm !== undefined ? " · " + lead.distanceKm + " km" : ""}</p>
      </div>
      <span style={{ color: "#ffc282", fontWeight: 700 }}>Prioridade {lead.score ?? "—"}/100</span>
    </div>
    {lead.address && <p style={{ margin: 0, fontSize: 13 }}>📍 {lead.address}</p>}
    {lead.phone && <p style={{ margin: 0, fontSize: 13 }}>☎ {lead.phone}</p>}
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
      {website && <a href={website} target="_blank" rel="noopener noreferrer" style={{ color: "#9dd0ff" }}>Site comercial</a>}
      {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#9dd0ff" }}>Ver fonte</a>}
    </div>
    <p style={{ ...muted, margin: 0 }}>A pontuação indica apenas sinais públicos encontrados, não comprova que o negócio precisa do Dishy.</p>
    <button type="button" disabled={saving || saved} onClick={() => onAdd(lead)} style={{ ...primary, justifySelf: "start", opacity: saving || saved ? 0.55 : 1 }}>
      {saved ? "Adicionado ao funil" : saving ? "Adicionando…" : "+ Adicionar ao funil"}
    </button>
  </article>;
}

export default function MasterLeadsAI({ user }) {
  const [view, setView] = useState("search");
  const [city, setCity] = useState("Rio Claro");
  const [state, setState] = useState("SP");
  const [radiusKm, setRadiusKm] = useState("10");
  const [segment, setSegment] = useState("todos");
  const [found, setFound] = useState([]);
  const [leads, setLeads] = useState([]);
  const [form, setForm] = useState(emptyLead);
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const request = useCallback(async (action, payload = null) => {
    const token = await user.getIdToken();
    const res = await fetch("/api/master-leads" + (payload ? "" : "?action=" + encodeURIComponent(action)), {
      method: payload ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token, ...(payload ? { "Content-Type": "application/json" } : {}) },
      ...(payload ? { body: JSON.stringify({ action, ...payload }) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const messages = {
        unauthorized: "Sua sessão expirou. Entre novamente no Master.",
        master_only: "Sua conta não tem permissão de Master.",
        too_many_requests: "Aguarde 30 segundos entre as pesquisas.",
        search_provider_unavailable: "A fonte de empresas está temporariamente indisponível. Tente novamente mais tarde.",
        lead_already_exists: "Este estabelecimento já consta no funil.",
        invalid_search: "Revise a cidade, o estado e os filtros.",
      };
      throw Error(messages[data.error] || "Não foi possível concluir a operação (" + res.status + ").");
    }
    return data;
  }, [user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { const result = await request("list"); setLeads(result.items || []); setError(""); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { refresh(); }, [refresh]);

  const counts = useMemo(() => {
    const total = { all: leads.length };
    Object.keys(statusLabels).forEach(key => total[key] = leads.filter(x => x.status === key).length);
    return total;
  }, [leads]);
  const savedKeys = useMemo(() => new Set(leads.map(x => x.sourceId).filter(Boolean)), [leads]);
  const filtered = useMemo(() => leads.filter(lead => (lead.name + " " + lead.city + " " + lead.segment + " " + lead.status).toLocaleLowerCase("pt-BR").includes(filter.toLocaleLowerCase("pt-BR"))), [leads, filter]);

  async function search() {
    setPending("search"); setError(""); setMessage(""); setFound([]);
    try {
      const result = await request("discover", { city, state, radiusKm: Number(radiusKm), segment });
      setFound(result.items || []);
      setMessage(result.items?.length ? result.items.length + " estabelecimentos encontrados na fonte OpenStreetMap." : "Nenhum estabelecimento encontrado com estes filtros. Amplie o raio ou tente outra cidade.");
    } catch (e) { setError(e.message); }
    finally { setPending(""); }
  }
  async function add(lead) {
    setPending("add:" + (lead.sourceId || lead.name)); setError(""); setMessage("");
    try {
      await request("create", { lead });
      await refresh();
      setMessage("Estabelecimento adicionado ao funil.");
    } catch (e) { setError(e.message); }
    finally { setPending(""); }
  }
  async function update(item, status, notes) {
    setPending("update:" + item.id); setError(""); setMessage("");
    try { await request("update", { id: item.id, status, notes }); await refresh(); setEditing(null); setMessage("Contato atualizado."); }
    catch (e) { setError(e.message); }
    finally { setPending(""); }
  }
  async function copyText(item) {
    try { await navigator.clipboard.writeText(salesMessage(item)); setMessage("Mensagem copiada. Revise e envie manualmente."); }
    catch { setMessage("Não foi possível copiar. Selecione a mensagem no campo e copie manualmente."); setEditing({ ...item, showMessage: true }); }
  }

  return <section aria-label="Dishy Leads AI" style={{ display: "grid", gap: 16 }}>
    <div style={{ ...box, background: "linear-gradient(110deg,#132442,#1b2837)" }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>🎯 Dishy Leads AI</h2>
      <p style={{ ...muted, marginBottom: 0 }}>Prospecção comercial exclusiva do Master. Busca sob demanda, funil de contatos e mensagens para revisão. Sem disparos automáticos e sem n8n.</p>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
      {[["Empresas salvas", counts.all], ["Novas", counts.novo], ["Interessadas", counts.interessado], ["Clientes", counts.cliente]].map(([title, value]) => <div key={title} style={box}><small style={muted}>{title}</small><div style={{ fontWeight: 800, fontSize: 26, marginTop: 4 }}>{loading ? "…" : value}</div></div>)}
    </div>
    <nav aria-label="Seções Leads AI" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {[["search", "Encontrar empresas"], ["funnel", "Funil de vendas"], ["manual", "Cadastro manual"]].map(([id, label]) =>
        <button key={id} type="button" onClick={() => { setView(id); setError(""); setMessage(""); }} style={view === id ? primary : button}>{label}</button>
      )}
    </nav>
    {error && <p role="alert" style={{ color: "#fecaca", background: "#51232c", padding: 12, borderRadius: 8, margin: 0 }}>{error}</p>}
    {message && <p role="status" style={{ color: "#a8f0c8", background: "#18392d", padding: 12, borderRadius: 8, margin: 0 }}>{message}</p>}
    {view === "search" && <>
      <div style={{ ...box, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Buscar estabelecimentos públicos</h3>
        <p style={{ ...muted, margin: 0 }}>Fonte: OpenStreetMap. A cobertura varia por cidade; ausência de telefone ou site não significa que a empresa não tenha esses canais.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <label>Cidade<input aria-label="Cidade" style={input} value={city} maxLength={64} onChange={e => setCity(e.target.value)} /></label>
          <label>UF<input aria-label="UF" style={input} value={state} maxLength={2} onChange={e => setState(e.target.value.toUpperCase())} /></label>
          <label>Raio<select style={input} value={radiusKm} onChange={e => setRadiusKm(e.target.value)}>{[5, 10, 20, 30].map(v => <option key={v} value={v}>{v} km</option>)}</select></label>
          <label>Ramo<select style={input} value={segment} onChange={e => setSegment(e.target.value)}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        </div>
        <button type="button" style={{ ...primary, justifySelf: "start" }} disabled={Boolean(pending)} onClick={search}>{pending === "search" ? "Pesquisando…" : "🔎 Pesquisar empresas"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 12 }}>
        {found.map(lead => <BusinessCard key={lead.sourceId} lead={lead} saved={savedKeys.has(lead.sourceId)} saving={Boolean(pending)} onAdd={add} />)}
      </div>
      <p style={muted}>© OpenStreetMap contributors (licença ODbL). Dados públicos podem estar incompletos. Confira os dados antes de fazer contato. Não use mensagens em massa.</p>
    </>}
    {view === "funnel" && <div style={{ ...box, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Oportunidades salvas</h3>
        <button type="button" style={button} onClick={refresh} disabled={loading}>Atualizar</button>
      </div>
      <input value={filter} onChange={e => setFilter(e.target.value)} style={input} placeholder="Filtrar por estabelecimento, cidade ou status" aria-label="Filtrar contatos" />
      {loading ? <p>Carregando…</p> : filtered.length === 0 ? <p style={muted}>Nenhum contato encontrado. Pesquise empresas ou cadastre uma oportunidade.</p> :
        filtered.map(item => <article key={item.id} style={{ borderTop: "1px solid #3f4d62", paddingTop: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
            <div><strong>{item.name}</strong><p style={{ ...muted, margin: "5px 0" }}>{item.city}/{item.state} · {item.segment} · Prioridade {item.score}/100</p></div>
            <select aria-label={"Status de " + item.name} value={item.status} onChange={e => update(item, e.target.value, item.notes || "")} disabled={Boolean(pending)} style={{ ...input, width: "auto" }}>
              {Object.entries(statusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button style={{ ...button, opacity: item.status === "nao_contatar" ? 0.45 : 1 }} type="button" disabled={item.status === "nao_contatar"} onClick={() => copyText(item)}>Copiar abordagem</button>
            {normalPhone(item.phone) && item.status !== "nao_contatar" && <a target="_blank" rel="noopener noreferrer" href={"https://wa.me/" + normalPhone(item.phone) + "?text=" + encodeURIComponent(salesMessage(item))} style={{ ...button, textDecoration: "none" }}>Abrir WhatsApp</a>}
            <button style={button} type="button" onClick={() => setEditing(editing?.id === item.id ? null : item)}>Anotações</button>
          </div>
          {editing?.id === item.id && <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <textarea aria-label="Anotações do contato" rows={3} style={input} value={editing.notes || ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} maxLength={2000} />
            {editing.showMessage && <textarea readOnly rows={4} style={input} value={salesMessage(item)} aria-label="Mensagem sugerida" />}
            <button type="button" style={{ ...primary, justifySelf: "start" }} disabled={Boolean(pending)} onClick={() => update(item, item.status, editing.notes || "")}>Salvar observações</button>
          </div>}
        </article>)
      }
    </div>}
    {view === "manual" && <form style={{ ...box, display: "grid", gap: 12 }} onSubmit={e => { e.preventDefault(); add(form).then(() => { /* Não apagar dados se a API falhar. */ }); }}>
      <h3 style={{ margin: 0 }}>Cadastrar estabelecimento</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        {[["name", "Nome do estabelecimento"], ["city", "Cidade"], ["state", "UF"], ["address", "Endereço comercial"], ["phone", "Telefone comercial público"], ["website", "Site (https://)"]].map(([key, label]) => <label key={key}>{label}<input style={input} required={["name", "city", "state"].includes(key)} value={form[key]} onChange={e => setForm(x => ({ ...x, [key]: e.target.value }))} maxLength={key === "state" ? 2 : 250} /></label>)}
        <label>Segmento<select style={input} value={form.segment} onChange={e => setForm(x => ({ ...x, segment: e.target.value }))}>{Object.entries(categoryLabels).filter(([key]) => key !== "todos").map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label>
      </div>
      <label>Observações<textarea style={input} rows={3} maxLength={2000} value={form.notes} onChange={e => setForm(x => ({ ...x, notes: e.target.value }))} /></label>
      <button type="submit" disabled={Boolean(pending)} style={{ ...primary, justifySelf: "start" }}>{pending ? "Salvando…" : "Salvar no funil"}</button>
    </form>}
  </section>;
}
