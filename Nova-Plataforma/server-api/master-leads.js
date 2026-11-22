import { createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { leadScore } from "../src/lib/leadScoring.js";
import { analyzeOpportunity, normalizeDigitalAudit, safePublicUrl, validFollowUpDate } from "../src/lib/leadIntelligence.js";
import { getKnownCityCenter, geocodeCity, discoverFromOsm } from "./leads-discovery.js";
import { handleInstagramAction } from "./leads-handles.js";

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
function normalizeLead(raw) {
  const lead = {
    name: safe(raw?.name, 120),
    city: safe(raw?.city, 80),
    state: safe(raw?.state || "SP", 2).toUpperCase(),
    segment: safe(raw?.segment || "outro", 40),
    address: safe(raw?.address, 250),
    phone: safe(raw?.phone, 40),
    website: urlText(raw?.website),
    menuUrl: safePublicUrl(raw?.menuUrl),
    orderUrl: safePublicUrl(raw?.orderUrl),
    instagramUrl: safePublicUrl(raw?.instagramUrl),
    facebookUrl: safePublicUrl(raw?.facebookUrl),
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
    const providedAction = req.method === "GET" ? safe(req.query?.action || "lead_list", 30) : safe(body.action, 30);
    const action = providedAction.startsWith("lead_") ? providedAction.slice(5) : providedAction;
    if (action === "handles" || action.startsWith("handle_")) {
      return handleInstagramAction({ action, body, db, uid: decoded.uid, method: req.method, res });
    }
    const collection = db.collection("platformLeads");
    if (req.method === "GET" && action === "list") {
      const snap = await collection.orderBy("updatedAt", "desc").limit(250).get();
      return res.status(200).json({ items: snap.docs.map(doc => { const data = doc.data(); return { id: doc.id, ...data, ...analyzeOpportunity(data) }; }) });
    }
    if (req.method === "POST" && action === "discover") {
      const city = safe(body.city, 64), state = safe(body.state || "SP", 2).toUpperCase();
      const radiusKm = Number(body.radiusKm || 10), segment = safe(body.segment || "todos", 30);
      if (!/^[\p{L}\s.'-]{2,64}$/u.test(city) || !/^[A-Z]{2}$/.test(state) || ![5, 10, 20, 30].includes(radiusKm) || !segments.has(segment)) return res.status(400).json({ error: "invalid_search" });
      const now = Date.now();
      const key = createHash("sha256").update(JSON.stringify([city.toLocaleLowerCase("pt-BR"), state, radiusKm, segment])).digest("hex").slice(0, 40);
      const cacheRef = db.collection("platformLeadSearchCache").doc(key);
      const cacheSnap = await cacheRef.get();
      const cache = cacheSnap.data() || {};
      const attribution = "© OpenStreetMap contributors — ODbL";
      if (Array.isArray(cache.items) && Number(cache.expiresAt) > now) {
        return res.status(200).json({ items: cache.items, attribution, cached: true });
      }
      const rateRef = db.collection("platformLeadSearchLimits").doc(decoded.uid);
      const allowed = await db.runTransaction(async tx => {
        const previous = await tx.get(rateRef);
        if (now - Number(previous.data()?.lastSearchAt || 0) < 30000) return false;
        tx.set(rateRef, { lastSearchAt: now, uid: decoded.uid });
        return true;
      });
      if (!allowed) return res.status(429).json({ error: "too_many_requests" });
      try {
        // Cidades comuns da região são resolvidas localmente para evitar timeout
        // e requisições desnecessárias ao serviço público de geocodificação.
        let center = getKnownCityCenter(city, state);
        if (!center) {
          const geoKey = createHash("sha256").update(city.toLocaleLowerCase("pt-BR") + "|" + state).digest("hex").slice(0, 40);
          const geoRef = db.collection("platformLeadGeocodes").doc(geoKey);
          const geoSnap = await geoRef.get(), geo = geoSnap.data();
          if (geo && Number(geo.expiresAt) > now && Array.isArray(geo.center)) {
            center = geo.center;
          } else {
            // Nominatim público: uma única geocodificação sob demanda por segundo
            // em toda a plataforma, com cache persistente por 30 dias.
            const globalRef = db.collection("platformLeadSearchLimits").doc("nominatim-global");
            const canGeocode = await db.runTransaction(async tx => {
              const previous = await tx.get(globalRef);
              if (now - Number(previous.data()?.lastRequestAt || 0) < 1200) return false;
              tx.set(globalRef, { lastRequestAt: now });
              return true;
            });
            if (!canGeocode) return res.status(429).json({ error: "geocoder_busy" });
            center = await geocodeCity(city, state);
            if (center) await geoRef.set({ center, expiresAt: now + 30 * 86400000 });
          }
        }
        if (!center) return res.status(404).json({ error: "city_not_found" });
        const items = await discoverFromOsm({ city, state, radiusKm, segment, center });
        // OpenStreetMap recomenda reutilizar resultados; cache apenas da busca
        // pública de empresas (nunca de credenciais ou dados de clientes).
        await cacheRef.set({ items, lastFetchedAt: Date.now(), expiresAt: Date.now() + 3 * 3600000 });
        return res.status(200).json({ items, attribution });
      } catch (e) {
        console.error("master-leads discovery provider", e?.message || "unknown");
        if (Array.isArray(cache.items)) {
          return res.status(200).json({ items: cache.items, attribution, cached: true, stale: true });
        }
        return res.status(502).json({ error: "search_provider_unavailable" });
      }
    }
    if (req.method === "POST" && action === "create") {
      const lead = normalizeLead(body.lead);
      if (!lead) return res.status(400).json({ error: "invalid_lead" });
      const ref = collection.doc(idFor(lead));
      const now = Date.now();
      const doc = { ...lead, ...analyzeOpportunity(lead), digitalAudit: normalizeDigitalAudit({}, lead), status: "novo", followUpOn: "", createdAt: now, updatedAt: now, createdBy: decoded.uid };
      try { await ref.create(doc); } catch (e) { if (e?.code === 6 || String(e?.message).includes("ALREADY_EXISTS")) return res.status(409).json({ error: "lead_already_exists" }); throw e; }
      return res.status(201).json({ item: { id: ref.id, ...doc } });
    }
    if (req.method === "POST" && action === "assess") {
      const id = safe(body.id, 64);
      const rawAudit = body.digitalAudit;
      if (!/^[a-f0-9]{40}$/.test(id) || !rawAudit || typeof rawAudit !== "object" || Array.isArray(rawAudit)) {
        return res.status(400).json({ error: "invalid_assessment" });
      }
      if (Object.keys(rawAudit).some(key => !["site", "menu", "orders"].includes(key)) ||
        ["site", "menu", "orders"].some(key => !["sim", "nao", "desconhecido"].includes(rawAudit[key])) ||
        !validFollowUpDate(body.followUpOn) || typeof body.notes !== "string" || body.notes.length > 2000) {
        return res.status(400).json({ error: "invalid_assessment" });
      }
      const ref = collection.doc(id);
      const existing = await ref.get();
      if (!existing.exists) return res.status(404).json({ error: "lead_not_found" });
      const current = existing.data() || {};
      const digitalAudit = normalizeDigitalAudit(rawAudit, current);
      const next = {
        digitalAudit, auditUpdatedAt: Date.now(), auditUpdatedBy: decoded.uid,
        followUpOn: body.followUpOn || "", notes: body.notes, updatedAt: Date.now(), updatedBy: decoded.uid,
      };
      const analysis = analyzeOpportunity({ ...current, ...next });
      await ref.update({ ...next, score: analysis.score, reasons: analysis.reasons });
      return res.status(200).json({ ok: true, analysis });
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
