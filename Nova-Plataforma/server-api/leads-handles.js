import { normalizeBusinessHandle, collectPublicHandles, parseInstagram } from "../src/lib/instagramHandles.js";

// Executado SOMENTE após verifyIdToken + platformAdmins.active no handler Master.
export async function handleInstagramAction({ action, body, db, uid, method, res }) {
  const collection = db.collection("platformSocialHandles");
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
