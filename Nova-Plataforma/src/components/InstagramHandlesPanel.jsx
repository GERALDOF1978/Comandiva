import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collectPublicHandles, normalizeBusinessHandle, parseInstagram, reviewedForCaption } from "../lib/instagramHandles.js";

const panel = { background: "#18202e", border: "1px solid #364252", borderRadius: 14, padding: 16 };
const input = { background: "#101722", color: "#fff", border: "1px solid #566174", padding: "10px 12px", borderRadius: 8, width: "100%", minWidth: 0 };
const button = { border: "1px solid #3e4d62", borderRadius: 9, padding: "10px 14px", color: "#fff", background: "#293a52", fontWeight: 700, cursor: "pointer" };
const primary = { ...button, background: "#ff7900", color: "#161616", border: "1px solid #ff7900" };
const muted = { fontSize: 13, color: "#bdc8d8" };
const categories = {
  restaurante: "Restaurante", pizzaria: "Pizzaria", hamburgueria: "Hamburgueria",
  lanchonete: "Lanchonete", acaiteria: "Açaíteria", marmitaria: "Marmitaria",
  cafeteria: "Cafeteria", padaria: "Padaria",
};
const initial = { name: "", city: "Rio Claro", state: "SP", segment: "restaurante", handle: "", sourceUrl: "" };

function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  // Evita interpretação de fórmulas em planilhas ao abrir a lista exportada.
  const safe = /^[=+@\-\t]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function downloadCsv(rows) {
  const head = ["Arroba", "Estabelecimento", "Cidade", "UF", "Segmento", "Instagram", "Fonte"];
  const lines = [head, ...rows.map(item => [
    "@" + item.username, item.businessName, item.city, item.state, item.segment, item.url, item.sourceUrl,
  ])];
  const csv = "\uFEFF" + lines.map(row => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "dishy-arrobas-revisadas.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function InstagramHandlesPanel({ request, found, leads }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState(initial);
  const [cityFilter, setCityFilter] = useState("todas");
  const [segmentFilter, setSegmentFilter] = useState("todos");
  const [textFilter, setTextFilter] = useState("");
  const [showOnlyReviewed, setShowOnlyReviewed] = useState(false);
  const [pending, setPending] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request("handles");
      setItems(response.items || []);
      setError("");
    } catch (e) { setError(e.message || "Falha ao carregar @."); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { load(); }, [load]);

  const searchHandles = useMemo(() => collectPublicHandles(found), [found]);
  const leadHandles = useMemo(() => collectPublicHandles(leads), [leads]);
  const existing = useMemo(() => new Set(items.map(item => item.username)), [items]);
  const toImport = useMemo(() =>
    collectPublicHandles([...searchHandles, ...leadHandles]).filter(item => !existing.has(item.username)).slice(0, 50),
  [searchHandles, leadHandles, existing]);
  const cities = useMemo(() =>
    [...new Set(items.map(item => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  [items]);
  const filtered = useMemo(() => items.filter(item => {
    if (cityFilter !== "todas" && item.city !== cityFilter) return false;
    if (segmentFilter !== "todos" && item.segment !== segmentFilter) return false;
    if (showOnlyReviewed && item.status !== "revisada") return false;
    if (textFilter.trim()) {
      const haystack = [item.username, item.businessName, item.city].join(" ").toLocaleLowerCase("pt-BR");
      if (!haystack.includes(textFilter.trim().toLocaleLowerCase("pt-BR"))) return false;
    }
    return true;
  }), [items, cityFilter, segmentFilter, showOnlyReviewed, textFilter]);
  const reviewed = useMemo(() => filtered.filter(x => x.status === "revisada"), [filtered]);
  const selectedHandles = useMemo(() =>
    reviewedForCaption(items, selected, 5),
  [items, selected]);

  async function importPublic() {
    if (!toImport.length) return;
    setPending("import"); setError(""); setNotice("");
    try {
      const result = await request("handle_import", { items: toImport });
      await load();
      setNotice(result.created + " perfis públicos adicionados à lista para revisão.");
    } catch (e) { setError(e.message || "Não foi possível importar."); }
    finally { setPending(""); }
  }
  async function addManual(e) {
    e.preventDefault();
    const parsed = normalizeBusinessHandle(form);
    if (!parsed) {
      setError("Confira o @, nome, cidade e ramo. Informe um perfil comercial público válido.");
      return;
    }
    setPending("add"); setNotice(""); setError("");
    try {
      await request("handle_add", { item: form });
      await load();
      setForm(initial);
      setNotice("Perfil cadastrado. Confira o Instagram e marque como revisado para usá-lo nas postagens.");
    } catch (e) { setError(e.message || "Não foi possível cadastrar."); }
    finally { setPending(""); }
  }
  async function changeStatus(item, status) {
    setPending(item.username); setNotice(""); setError("");
    try {
      await request("handle_review", { username: item.username, status });
      if (status !== "revisada") setSelected(current => current.filter(v => v !== item.username));
      await load();
      setNotice(status === "revisada" ? "Perfil marcado como revisado." : "Preferência de menção atualizada.");
    } catch (e) { setError(e.message || "Não foi possível atualizar."); }
    finally { setPending(""); }
  }
  function toggle(username) {
    setSelected(current => current.includes(username) ? current.filter(x => x !== username) :
      current.length < 5 ? [...current, username] : current);
  }
  function selectFive() {
    setSelected(reviewed.slice(0, 5).map(item => item.username));
  }
  async function copyCaption() {
    if (!selectedHandles) return;
    try { await navigator.clipboard.writeText(selectedHandles); setNotice("Até 5 @ revisadas copiadas. Use somente quando forem relevantes à publicação."); }
    catch { setNotice("Copie manualmente o texto da caixa abaixo."); }
  }

  return <section aria-label="Arrobas de empresas do nicho" style={{ display: "grid", gap: 15 }}>
    <header style={{ ...panel, background: "linear-gradient(120deg,#152b49,#162432)" }}>
      <h3 style={{ fontSize: 21, margin: "0 0 8px" }}>@ Instagram do meu nicho</h3>
      <p style={{ ...muted, margin: 0 }}>Organize perfis comerciais de restaurantes, pizzarias, hamburguerias e outros estabelecimentos, por cidade e segmento. Use as @ somente em postagens pertinentes. Não há marcação ou publicação automática.</p>
    </header>
    {error && <p role="alert" style={{ margin: 0, borderRadius: 9, padding: 12, background: "#562830", color: "#ffe0e0" }}>{error}</p>}
    {notice && <p role="status" style={{ margin: 0, borderRadius: 9, padding: 12, background: "#21402f", color: "#d4f8dc" }}>{notice}</p>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10 }}>
      {[
        ["@ encontradas na busca", searchHandles.length],
        ["@ de empresas salvas", leadHandles.length],
        ["@ na minha lista", items.length],
        ["@ revisadas", items.filter(x => x.status === "revisada").length],
      ].map(([title, count]) =>
        <div key={title} style={panel}><small style={muted}>{title}</small><div style={{ fontSize: 25, fontWeight: 800 }}>{loading ? "…" : count}</div></div>
      )}
    </div>
    <div style={{ ...panel, display: "grid", gap: 10 }}>
      <h4 style={{ margin: 0 }}>Capturar @ de estabelecimentos encontrados</h4>
      <p style={{ ...muted, margin: 0 }}>Use a aba “Encontrar empresas” para pesquisar uma cidade. Aqui serão aproveitadas as @ que a fonte OpenStreetMap realmente informar, além das que você cadastrou nos leads. Nem todas as empresas possuem @ nos dados públicos.</p>
      <button type="button" style={{ ...primary, justifySelf: "start", opacity: !toImport.length || pending ? 0.55 : 1 }} disabled={Boolean(pending) || !toImport.length} onClick={importPublic}>
        {pending === "import" ? "Importando…" : "Adicionar " + toImport.length + " @ disponíveis à lista"}
      </button>
      <small style={muted}>Perfis duplicados são ignorados. Cada resultado entra como “A revisar”, não como perfil confirmado.</small>
    </div>
    <form onSubmit={addManual} style={{ ...panel, display: "grid", gap: 12 }}>
      <h4 style={{ margin: 0 }}>Adicionar @ pública manualmente</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        {[
          ["name", "Nome do estabelecimento"], ["handle", "@ ou link do Instagram"],
          ["city", "Cidade"], ["state", "UF"],
        ].map(([key, title]) => <label key={key} style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 13 }}>{title}</span>
          <input required style={input} maxLength={key === "state" ? 2 : 150} placeholder={key === "handle" ? "@empresa" : ""} value={form[key]} onChange={e => setForm(old => ({ ...old, [key]: e.target.value }))}/>
        </label>)}
        <label style={{ display: "grid", gap: 5 }}><span style={{ fontSize: 13 }}>Segmento</span>
          <select style={input} value={form.segment} onChange={e => setForm(old => ({ ...old, segment: e.target.value }))}>
            {Object.entries(categories).map(([id, title]) => <option value={id} key={id}>{title}</option>)}
          </select>
        </label>
      </div>
      <button type="submit" disabled={Boolean(pending)} style={{ ...primary, justifySelf: "start" }}>{pending === "add" ? "Salvando…" : "Adicionar perfil à lista"}</button>
    </form>

    <div style={{ ...panel, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
        <h4 style={{ margin: 0 }}>Minha lista de @</h4>
        <button type="button" onClick={load} disabled={loading || Boolean(pending)} style={button}>Atualizar</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 9 }}>
        <label style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 13 }}>Cidade</span>
          <select style={input} value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
            <option value="todas">Todas as cidades</option>
            {cities.map(city => <option key={city}>{city}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 13 }}>Segmento</span>
          <select style={input} value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)}>
            <option value="todos">Todos os segmentos</option>
            {Object.entries(categories).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}><span style={{ fontSize: 13 }}>Buscar perfil</span>
          <input style={input} value={textFilter} onChange={e => setTextFilter(e.target.value)} placeholder="Nome ou @"/>
        </label>
      </div>
      <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13 }}>
        <input type="checkbox" checked={showOnlyReviewed} onChange={e => setShowOnlyReviewed(e.target.checked)}/>
        Somente perfis revisados
      </label>
      <small style={muted}>{filtered.length} perfis exibidos. A lista armazena até 500 registros por consulta; não representa todas as contas do Instagram.</small>

      {filtered.length ? filtered.map(item => <article key={item.username} style={{ borderTop: "1px solid #364252", paddingTop: 12, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div>
            <a href={item.url || parseInstagram(item.username)?.url} target="_blank" rel="noopener noreferrer" style={{ color: "#b8dfff", fontWeight: 700 }}>@{item.username}</a>
            <div style={{ fontWeight: 600, marginTop: 5 }}>{item.businessName}</div>
            <small style={muted}>{item.city}/{item.state} · {categories[item.segment] || item.segment}</small>
          </div>
          <span style={{ ...muted, alignSelf: "start" }}>{item.status === "revisada" ? "Revisada por você" : item.status === "nao_mencionar" ? "Não mencionar" : "A revisar"}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center" }}>
          {item.sourceUrl && <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank" style={{ color: "#a2cfff", fontSize: 13 }}>Ver fonte pública</a>}
          {item.status === "revisada" ? <>
            <button type="button" style={button} disabled={Boolean(pending)} onClick={() => changeStatus(item, "sugerida")}>Voltar a revisar</button>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={selected.includes(item.username)} disabled={selected.length >= 5 && !selected.includes(item.username)} onChange={() => toggle(item.username)}/>
              Incluir na postagem
            </label>
          </> : item.status !== "nao_mencionar" ?
            <button type="button" disabled={Boolean(pending)} onClick={() => changeStatus(item, "revisada")} style={primary}>Já conferi o perfil</button> :
            <button type="button" style={button} disabled={Boolean(pending)} onClick={() => changeStatus(item, "sugerida")}>Reabrir revisão</button>
          }
          {item.status !== "nao_mencionar" && <button type="button" disabled={Boolean(pending)} style={button} onClick={() => changeStatus(item, "nao_mencionar")}>Não mencionar</button>}
        </div>
      </article>) : <p style={muted}>Nenhum perfil nesta seleção. Pesquise empresas ou adicione uma @ pública.</p>}
    </div>

    <div style={{ ...panel, display: "grid", gap: 10 }}>
      <h4 style={{ margin: 0 }}>Preparar menções para uma postagem</h4>
      <p style={{ ...muted, margin: 0 }}>Escolha somente perfis que você conferiu e que sejam relevantes ao conteúdo. Máximo de cinco @ por grupo. Esta ferramenta não publica nem envia marcações automaticamente.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={button} disabled={!reviewed.length} onClick={selectFive}>Selecionar até 5 revisadas</button>
        <button type="button" style={primary} disabled={!selectedHandles} onClick={copyCaption}>Copiar @ selecionadas</button>
        <button type="button" style={button} disabled={!items.some(x => x.status === "revisada")} onClick={() => downloadCsv(items.filter(x => x.status === "revisada"))}>Exportar lista revisada (CSV)</button>
      </div>
      <textarea aria-label="Arrobas preparadas para legenda" rows={2} readOnly value={selectedHandles} placeholder="As @ revisadas selecionadas aparecerão aqui." style={input}/>
      <small style={muted}>© OpenStreetMap contributors (ODbL), quando a fonte for OSM. Confira titularidade e configurações de menção da conta antes de postar.</small>
    </div>
  </section>;
}
