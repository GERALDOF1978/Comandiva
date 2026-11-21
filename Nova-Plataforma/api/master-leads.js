import { createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Endpoint exclusivo do Master. Nunca usar SDK cliente para ler ou gravar prospects.
function setupAdmin() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw Error("firebase_admin_not_configured");
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const statuses = new Set(["novo", "contatado", "interessado", "demonstracao", "cliente", "nao_contatar"]);
const segments = new Set(["todos", "restaurante", "pizzaria", "hamburgueria", "lanchonete", "acaiteria", "marmitaria", "cafeteria", "padaria"]);
const safe = (value, max = 150) => String(value ?? "").trim().slice(0, max);
const urlText = value => {
  const candidate = safe(value, 500);
  if (!candidate) return "";
  try { const u = new URL(candidate); return ["https:", "http:"].includes(u.protocol) ? u.toString() : ""; } catch { return ""; }
};
function leadScore(input) {
  let score = 30;
  const reasons = ["Estabelecimento identificado no setor de alimentação."];
  if (input.phone) { score += 15; reasons.push("Contato comercial público disponível."); }
  if (input.website) { score += 5; reasons.push("Site comercial identificado."); }
  if (input.segment !== "outro") { score += 10; reasons.push("Segmento atendido pelo Dishy."); }
  return { score, reasons };
}
function normalizeLead(raw) {
  const lead = {
    name: safe(raw?.name, 120),
    city: safe(raw?.city, 80),
    state: safe(raw?.state || "SP", 2).toUpperCase(),
    segment: safe(raw?.segment || "outro", 40),
    address: safe(raw?.address, 250),
    phone: safe(raw?.phone, 40),
    website: urlText(raw?.website),
    sourceUrl: urlText(raw?.sourceUrl),
    sourceId: safe(raw?.sourceId, 100),
    notes: safe(raw?.notes, 2000),
  };
  if (lead.name.length < 2 || lead.city.length < 2 || !/^[A-Z]{2}$/.test(lead.state)) return null;
  return lead;
}
function idFor(lead) {
  const origin = lead.sourceId || [lead.name, lead.city, lead.state, lead.address].join("|");
  return createHash("sha256").update(origin.toLocaleLowerCase("pt-BR")).digest("hex").slice(0, 40);
}
function determineSegment(tags = {}) {
  const amenity = tags.amenity || "";
  const shop = tags.shop || "";
  if (amenity === "restaurant") return "restaurante";
  if (amenity === "fast_food") return /pizza/i.test(tags.name || "") ? "pizzaria" : "lanchonete";
  if (amenity === "cafe") return "cafeteria";
  if (shop === "bakery") return "padaria";
  if (shop === "confectionery" || shop === "pastry") return "cafeteria";
  if (amenity === "ice_cream") return "acaiteria";
  return "outro";
}
function kmBetween(a, b, c, d) {
  const rad = x => x * Math.PI / 180;
  const p = rad(c - a), q = rad(d - b);
  const h = Math.sin(p / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(q / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
async function getJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "User-Agent": "DishyLeadsAI/0.1 (https://dishy.com.br; business discovery)", "Accept": "application/json", ...options.headers },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error("data_provider_unavailable");
  return response.json();
}
async function discover({ city, state, radiusKm, segment }) {
  const query = city + ", " + state + ", Brasil";
  const geocodes = await getJson("https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=" + encodeURIComponent(query));
  if (!Array.isArray(geocodes) || !geocodes[0]) return [];
  const lat = Number(geocodes[0].lat), lon = Number(geocodes[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const radius = Math.round(radiusKm * 1000);
  const q = '[out:json][timeout:12];(nwr(around:' + radius + ',' + lat + ',' + lon + ')["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)$"];nwr(around:' + radius + ',' + lat + ',' + lon + ')["shop"~"^(bakery|pastry|confectionery)$"];);out center 130;';
  const data = await getJson("https://overpass.kumi.systems/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: q }),
  });
  const seen = new Set();
  const leads = [];
  for (const item of data?.elements || []) {
    const tags = item.tags || {};
    if (!tags.name) continue;
    const type = determineSegment(tags);
    const name = safe(tags.name, 120);
    if (segment !== "todos" && type !== segment && !(segment === "pizzaria" && /pizza/i.test(name)) && !(segment === "hamburgueria" && /burger|hamb[uú]rg/i.test(name)) && !(segment === "marmitaria" && /marmit/i.test(name))) continue;
    const la = Number(item.lat ?? item.center?.lat), lo = Number(item.lon ?? item.center?.lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || kmBetween(lat, lon, la, lo) > radiusKm) continue;
    const sourceId = "osm:" + item.type + ":" + item.id;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const address = [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"]].filter(Boolean).join(", ");
    const lead = normalizeLead({ name, city, state, address, segment: type, phone: tags["contact:phone"] || tags.phone, website: tags["contact:website"] || tags.website, sourceUrl: "https://www.openstreetmap.org/" + item.type + "/" + item.id, sourceId });
    if (lead) leads.push({ ...lead, ...leadScore(lead), distanceKm: Math.round(kmBetween(lat, lon, la, lo) * 10) / 10 });
  }
  return leads.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 50);
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "method_not_allowed" });
  try {
    setupAdmin();
    const authorization = String(req.headers.authorization || "");
    if (!authorization.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
    let decoded;
    try { decoded = await getAuth().verifyIdToken(authorization.slice(7), true); }
    catch { return res.status(401).json({ error: "unauthorized" }); }
    const db = getFirestore();
    const admin = await db.collection("platformAdmins").doc(decoded.uid).get();
    if (!admin.exists || admin.data()?.active !== true) return res.status(403).json({ error: "master_only" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = req.method === "GET" ? safe(req.query?.action || "list", 30) : safe(body.action, 30);
    const collection = db.collection("platformLeads");
    if (req.method === "GET" && action === "list") {
      const snap = await collection.orderBy("updatedAt", "desc").limit(250).get();
      return res.status(200).json({ items: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
    }
    if (req.method === "POST" && action === "discover") {
      const city = safe(body.city, 64), state = safe(body.state || "SP", 2).toUpperCase();
      const radiusKm = Number(body.radiusKm || 10), segment = safe(body.segment || "todos", 30);
      if (!/^[\p{L}\s.'-]{2,64}$/u.test(city) || !/^[A-Z]{2}$/.test(state) || ![5, 10, 20, 30].includes(radiusKm) || !segments.has(segment)) return res.status(400).json({ error: "invalid_search" });
      const rateRef = db.collection("platformLeadSearchLimits").doc(decoded.uid);
      const now = Date.now();
      const allowed = await db.runTransaction(async tx => {
        const previous = await tx.get(rateRef);
        if (now - Number(previous.data()?.lastSearchAt || 0) < 30000) return false;
        tx.set(rateRef, { lastSearchAt: now, uid: decoded.uid });
        return true;
      });
      if (!allowed) return res.status(429).json({ error: "too_many_requests" });
      try { return res.status(200).json({ items: await discover({ city, state, radiusKm, segment }), attribution: "© OpenStreetMap contributors — ODbL" }); }
      catch (e) { console.error("master-leads discovery provider", e?.message); return res.status(502).json({ error: "search_provider_unavailable" }); }
    }
    if (req.method === "POST" && action === "create") {
      const lead = normalizeLead(body.lead);
      if (!lead) return res.status(400).json({ error: "invalid_lead" });
      const ref = collection.doc(idFor(lead));
      const now = Date.now();
      const doc = { ...lead, ...leadScore(lead), status: "novo", createdAt: now, updatedAt: now, createdBy: decoded.uid };
      try { await ref.create(doc); } catch (e) { if (e?.code === 6 || String(e?.message).includes("ALREADY_EXISTS")) return res.status(409).json({ error: "lead_already_exists" }); throw e; }
      return res.status(201).json({ item: { id: ref.id, ...doc } });
    }
    if (req.method === "POST" && action === "update") {
      const id = safe(body.id, 64), status = safe(body.status, 30), notes = safe(body.notes, 2000);
      if (!/^[a-f0-9]{40}$/.test(id) || !statuses.has(status)) return res.status(400).json({ error: "invalid_update" });
      const ref = collection.doc(id);
      const existing = await ref.get();
      if (!existing.exists) return res.status(404).json({ error: "lead_not_found" });
      await ref.update({ status, notes, updatedAt: Date.now(), updatedBy: decoded.uid });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "invalid_action" });
  } catch (e) {
    console.error("master-leads error", e?.message || "unknown");
    return res.status(500).json({ error: "internal_error" });
  }
}
