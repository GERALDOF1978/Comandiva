import { normalizeBusinessHandle, collectPublicHandles, parseInstagram } from "../src/lib/instagramHandles.js";
import { createHash } from "node:crypto";
import { getKnownCityCenter, geocodeCity, discoverInstagramFromOsm } from "./leads-discovery.js";

// Executado SOMENTE após verifyIdToken + platformAdmins.active no handler Master.
export async function handleInstagramAction({ action, body, db, uid, method, res }) {
  const collection = db.collection("platformSocialHandles");
  if (action === "handle_discover" && method === "POST") {
    const city = String(body.city || "").trim().slice(0, 64);
    const state = String(body.state || "SP").trim().toUpperCase();
    const radiusKm = Number(body.radiusKm || 10);
    const segment = String(body.segment || "todos").trim();
    const sectors = new Set(["todos","restaurante","pizzaria","hamburgueria","lanchonete","acaiteria","marmitaria","cafeteria","padaria"]);
    if (!/^[\p{L}\s.'-]{2,64}$/u.test(city) || !/^[A-Z]{2}$/.test(state) ||
      ![5,10,20,30].includes(radiusKm) || !sectors.has(segment)) {
      return res.status(400).json({ error: "invalid_search" });
    }
    const now = Date.now();
    const cacheId = createHash("sha256").update(JSON.stringify(["handles",city.toLocaleLowerCase("pt-BR"),state,radiusKm,segment])).digest("hex").slice(0,40);
    const cacheRef = db.collection("platformInstagramSearchCache").doc(cacheId);
    const cacheSnap = await cacheRef.get();
    const cache = cacheSnap.data() || {};
    if (Array.isArray(cache.items) && Number(cache.expiresAt) > now) {
      return res.status(200).json({ items: cache.items, cached: true, attribution: "© OpenStreetMap contributors — ODbL" });
    }
    const limitRef = db.collection("platformLeadSearchLimits").doc("instagram-" + uid);
    const permitted = await db.runTransaction(async tx => {
      const previous = await tx.get(limitRef);
      if (now - Number(previous.data()?.lastRequestAt || 0) < 60000) return false;
      tx.set(limitRef, { lastRequestAt: now, uid });
      return true;
    });
    if (!permitted) return res.status(429).json({ error: "too_many_requests" });
    try {
      let center = getKnownCityCenter(city, state);
      if (!center) {
        const geoId = createHash("sha256").update(city.toLocaleLowerCase("pt-BR") + "|" + state).digest("hex").slice(0,40);
        const geoRef = db.collection("platformLeadGeocodes").doc(geoId);
        const geoSnap = await geoRef.get();
        const geo = geoSnap.data() || {};
        if (Array.isArray(geo.center) && Number(geo.expiresAt) > now) center = geo.center;
        else {
          const globalRef = db.collection("platformLeadSearchLimits").doc("nominatim-global");
          const allowed = await db.runTransaction(async tx => {
            const existing = await tx.get(globalRef);
            if (now - Number(existing.data()?.lastRequestAt || 0) < 1200) return false;
            tx.set(globalRef, { lastRequestAt: now });
            return true;
          });
          if (!allowed) return res.status(429).json({ error: "geocoder_busy" });
          center = await geocodeCity(city, state);
          if (center) await geoRef.set({ center, expiresAt: Date.now() + 30 * 86400000 });
        }
      }
      if (!center) return res.status(404).json({ error: "city_not_found" });
      const items = await discoverInstagramFromOsm({ city, state, radiusKm, segment, center });
      await cacheRef.set({ items, updatedAt: Date.now(), expiresAt: Date.now() + 4 * 3600000 });
      return res.status(200).json({ items, attribution: "© OpenStreetMap contributors — ODbL" });
    } catch (e) {
      console.error("master-leads Instagram search failed", e?.message || "unknown");
      if (Array.isArray(cache.items)) return res.status(200).json({ items: cache.items, cached: true, stale: true });
      return res.status(502).json({ error: "search_provider_unavailable" });
    }
  }
  if (action === "handles" && method === "GET") {
    const snap = await collection.orderBy("addedAt", "desc").limit(500).get();
    return res.status(200).json({
      items: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      limit: 500,
      attribution: "Perfis informados em fontes públicas ou adicionados manualmente; existência e titularidade não validadas pela API do Instagram."
    });
  }
  if (action === "handle_import" && method === "POST") {
    if (!Array.isArray(body.items) || body.items.length > 50) {
      return res.status(400).json({ error: "invalid_handles" });
    }
    const cleaned = collectPublicHandles(body.items);
    if (body.items.length && !cleaned.length) return res.status(400).json({ error: "invalid_handles" });
    if (!cleaned.length) return res.status(200).json({ created: 0, ignored: 0 });
    const refs = cleaned.map(item => collection.doc(item.username));
    const existing = await db.getAll(...refs);
    const batch = db.batch();
    const now = Date.now();
    let created = 0;
    cleaned.forEach((item, i) => {
      if (existing[i].exists) return;
      batch.create(refs[i], {
        ...item, status: "sugerida", origin: item.sourceUrl.includes("openstreetmap.org/") ? "openstreetmap" : "fonte_publica",
        addedAt: now, updatedAt: now, addedBy: uid
      });
      created++;
    });
    if (created) await batch.commit();
    return res.status(200).json({ created, ignored: body.items.length - created });
  }
  if (action === "handle_add" && method === "POST") {
    const item = normalizeBusinessHandle(body.item);
    if (!item) return res.status(400).json({ error: "invalid_handles" });
    const ref = collection.doc(item.username);
    const now = Date.now();
    try {
      await ref.create({ ...item, status: "sugerida", origin: "manual", addedAt: now, updatedAt: now, addedBy: uid });
    } catch (e) {
      if (e?.code === 6 || /already exists/i.test(String(e?.message || ""))) {
        return res.status(409).json({ error: "handle_exists" });
      }
      throw e;
    }
    return res.status(201).json({ ok: true });
  }
  if (action === "handle_review" && method === "POST") {
    const parsed = parseInstagram(body.username);
    const status = String(body.status || "");
    if (!parsed || !["sugerida", "revisada", "nao_mencionar"].includes(status)) {
      return res.status(400).json({ error: "invalid_handles" });
    }
    const ref = collection.doc(parsed.username);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: "handle_not_found" });
    await ref.update({ status, updatedAt: Date.now(), updatedBy: uid });
    return res.status(200).json({ ok: true });
  }
  return res.status(400).json({ error: "invalid_action" });
}
