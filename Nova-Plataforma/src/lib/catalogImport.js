// Importacao isolada: nenhum acesso ao Firebase ou API do iFood neste arquivo.
// A leitura de JSON pressupoe um arquivo obtido legitimamente pelo estabelecimento.
const tidy = value => String(value ?? "").trim();
const canon = value => tidy(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function csvMatrix(input) {
  const text = String(input ?? "").replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let current = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (!cell || quoted) quoted = !quoted;
      else cell += c;
    } else if (c === delimiter && !quoted) {
      current.push(cell); cell = "";
    } else if ((c === "\r" || c === "\n") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      current.push(cell);
      if (current.some(v => tidy(v))) rows.push(current);
      current = []; cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("CSV com aspas não fechadas.");
  current.push(cell);
  if (current.some(v => tidy(v))) rows.push(current);
  return rows;
}

function parsePrice(value, cents = false) {
  if (value === null || value === undefined || tidy(value) === "") throw Error("Preço ausente.");
  if (cents) {
    const n = Number(tidy(value));
    if (!Number.isSafeInteger(n) || n < 0 || n > 100000000) throw Error("Preço em centavos inválido.");
    return n;
  }
  let s = tidy(value).replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error("Preço inválido.");
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 1000000) throw Error("Preço inválido.");
  return Math.round(n * 100);
}

function csvCatalog(text) {
  const matrix = csvMatrix(text);
  const header = (matrix.shift() || []).map(canon);
  const field = (record, ...names) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return record[i] ?? "";
    }
    return "";
  };
  if (!header.some(x => ["categoria", "category", "grupo"].includes(x)) ||
      !header.some(x => ["nome", "name", "produto", "product"].includes(x)) ||
      !header.some(x => ["preco_centavos", "preco", "valor", "price"].includes(x)))
    throw Error("CSV incompatível. Inclua categoria, nome e preco_centavos (ou preco).");
  const rows = [], skipped = [];
  for (let i = 0; i < matrix.length; i++) {
    const raw = matrix[i], categoria = tidy(field(raw, "categoria", "category", "grupo"));
    const nome = tidy(field(raw, "nome", "name", "produto", "product"));
    if (!categoria || !nome) { skipped.push("Linha " + (i + 2) + ": sem categoria/nome."); continue; }
    const isCents = header.includes("preco_centavos");
    const rawPrice = isCents ? field(raw, "preco_centavos") : field(raw, "preco", "valor", "price");
    let price;
    try { price = parsePrice(rawPrice, isCents); }
    catch (e) { throw Error("Linha " + (i + 2) + " (" + nome + "): " + e.message); }
    rows.push({categoria, nome, descricao: tidy(field(raw, "descricao", "description")),
      preco_centavos: price, imagem_url: tidy(field(raw, "imagem_url", "image_url", "foto"))});
  }
  return {source:"csv", rows, skipped};
}

function jsonCatalog(text) {
  let data;
  try { data = JSON.parse(text); }
  catch { throw Error("JSON inválido."); }
  const list = Array.isArray(data) ? data : data?.categories ?? data?.data?.categories ?? data?.data;
  if (!Array.isArray(list)) throw Error("JSON não contém lista de categorias do catálogo.");
  const rows = [], skipped = [];
  for (const category of list) {
    const categoryName = tidy(category?.name ?? category?.categoria);
    const items = category?.items ?? category?.products ?? [];
    if (!categoryName || !Array.isArray(items)) continue;
    for (const raw of items) {
      const item = raw?.item ?? raw;
      const product = raw?.products?.[0] ?? item?.products?.[0] ?? {};
      const name = tidy(product.name ?? item.name ?? item.nome);
      const label = categoryName + " / " + (name || "sem nome");
      const hasGroups = (raw?.optionGroups?.length ?? item?.optionGroups?.length ?? 0) > 0 ||
        (raw?.options?.length ?? item?.options?.length ?? 0) > 0;
      const isPizza = canon(category.template) === "pizza" || canon(item.type) === "pizza";
      if (isPizza || hasGroups) {
        skipped.push(label + ": produto com montagem/opcionais — revisar no cadastro especializado.");
        continue;
      }
      if (!name) { skipped.push(label + ": sem nome."); continue; }
      const priceValue = item?.price?.value ?? item?.price ?? raw?.price?.value ?? raw?.price;
      let price;
      try { price = parsePrice(priceValue); }
      catch { skipped.push(label + ": preço ausente ou inválido."); continue; }
      rows.push({categoria:categoryName, nome:name,
        descricao:tidy(product.description ?? item.description),
        preco_centavos:price, imagem_url:""});
    }
  }
  return {source:"ifood-json", rows, skipped};
}

export function parseCatalogImport(text, filename) {
  const name = tidy(filename).toLowerCase();
  if (name.endsWith(".csv")) return csvCatalog(text);
  if (name.endsWith(".json")) return jsonCatalog(text);
  throw Error("Arquivo não aceito. Use CSV (Excel: Salvar como CSV UTF-8) ou catálogo JSON autorizado.");
}
