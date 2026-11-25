import {createHmac, timingSafeEqual} from "node:crypto";
import {WHATSAPP_ASSISTANT_MODULE} from "../src/lib/planModules.js";
import {subscriptionAccess} from "../src/lib/subscriptionAccess.js";

const quietPeriod = 24 * 60 * 60 * 1000;
const webhookOrigin = "https://dishy.com.br";

function signature(key, purpose, value) {
 return createHmac("sha256", key).update(purpose + ":" + value).digest("hex");
}

function menuImage(value) {
 if (typeof value !== "string" || value.length > 4096) return null;
 let url;
 try { url = new URL(value); } catch { return null; }
 if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
 const imgbb = url.hostname === "i.ibb.co" || url.hostname === "i.ibb.co.com";
 const firebase = url.hostname === "firebasestorage.googleapis.com"
  && url.pathname.startsWith("/v0/b/saas-delivery-551a4.firebasestorage.app/o/")
  && url.searchParams.get("alt") === "media";
 if (!imgbb && !firebase) return null;
 const extension = /\.(png|jpe?g|webp)$/i.exec(url.pathname)?.[1]?.toLowerCase();
 if (!extension) return null;
 const format = extension === "jpg" ? "jpeg" : extension;
 return {media:url.href, mimetype:"image/" + format, fileName:"cardapio." + extension};
}

export async function sendMenuLink({request, instance, number, menu, link}) {
 const route = encodeURIComponent(instance);
 const title = String(menu.name || "").trim().slice(0, 80);
 const caption = "Olá! 👋 Aqui está o cardápio" + (title ? " de " + title : " digital") + ":\n" + link;
 const image = menuImage(menu.bannerUrl) || menuImage(menu.logoUrl);
 if (image) {
  const result = await request("POST", "/message/sendMedia/" + route, {number, mediatype:"image", caption, ...image});
  if (result.ok || ![400, 404, 415, 422].includes(result.status)) return result;
 }
 return request("POST", "/message/sendText/" + route, {number, text:caption});
}

export async function assistantEntitlement(db, restaurantId) {
 const subscription = (await db.collection("subscriptions").doc(restaurantId).get()).data();
 if (!subscriptionAccess(subscription).allowed) return false;
 const plan = (await db.collection("plans").doc(subscription.planId).get()).data();
 return Boolean(plan && plan.active !== false && Array.isArray(plan.modules) && plan.modules.includes(WHATSAPP_ASSISTANT_MODULE));
}

export async function configureAssistant({db, base, restaurant, instance, enabled, config, request}) {
 const path = encodeURIComponent(instance);
 const url = new URL("/api/whatsapp-connection", webhookOrigin);
 url.searchParams.set("assistantRestaurant", base.id);
 url.searchParams.set("signature", signature(config.apiKey, "webhook", base.id + ":" + instance));
 if (!enabled) {
  await base.update({whatsappMenuAssistantEnabled: false});
  if (restaurant.whatsappInstance !== instance) return {};
  const webhook = await request("GET", "/webhook/find/" + path);
  const current = webhook.data?.webhook || webhook.data;
  if (webhook.ok && current?.url === url.href && current.enabled) {
   await request("POST", "/webhook/set/" + path, {webhook:{
    enabled:false, url:url.href, byEvents:false, base64:false, events:["MESSAGES_UPSERT"]
   }});
  }
  return {};
 }
 if (restaurant.status !== "active" || !await assistantEntitlement(db, base.id)) return {error:"assistant_plan_required", status:403};
 if (restaurant.whatsappInstance !== instance) return {error:"assistant_whatsapp_required", status:409};
 const connection = await request("GET", "/instance/connectionState/" + path);
 if (!connection.ok || (connection.data?.instance?.state ?? connection.data?.state) !== "open") return {error:"assistant_whatsapp_required", status:409};

 const webhook = await request("GET", "/webhook/find/" + path);
 if (!webhook.ok && webhook.status !== 404) return {error:"assistant_webhook_unavailable", status:502};
 const existing = webhook.data?.webhook || webhook.data;
 if (existing?.url && existing.url !== url.href) return {error:"assistant_existing_webhook", status:409};
 if (!existing?.enabled) {
  const result = await request("POST", "/webhook/set/" + path, {webhook:{
   enabled:true, url:url.href, byEvents:false, base64:false, events:["MESSAGES_UPSERT"]
  }});
  if (!result.ok) return {error:"assistant_webhook_unavailable", status:502};
 }
 await base.update({whatsappMenuAssistantEnabled: true});
 return {};
}

export async function handleAssistantEvent({db, restaurantId, token, payload, config, request, res}) {
 const instance = typeof payload?.instance === "string" ? payload.instance : "";
 if (!/^[a-zA-Z0-9_-]{1,80}$/.test(instance) || !/^[a-f0-9]{64}$/.test(token)) return res.status(401).end();
 const expected = signature(config.apiKey, "webhook", restaurantId + ":" + instance);
 if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return res.status(401).end();
 if (String(payload.event).toUpperCase().replace(/\./g,"_") !== "MESSAGES_UPSERT") return res.status(204).end();

 const data = payload.data;
 const key = data?.key;
 const number = /^([1-9]\d{7,14})@s\.whatsapp\.net$/.exec(key?.remoteJid)?.[1]
  || (/^\d+@lid$/.test(key?.remoteJid) ? /^([1-9]\d{7,14})@s\.whatsapp\.net$/.exec(key?.remoteJidAlt)?.[1] : null);
 const now = Date.now();
 const time = Number(data?.messageTimestamp) * 1000;
 if (!number || key.fromMe !== false || !data?.message || !Number.isFinite(time) || time < now - 5 * 60 * 1000 || time > now + 60 * 1000) return res.status(204).end();

 const base = db.collection("restaurants").doc(restaurantId);
 const restaurant = (await base.get()).data();
 if (!restaurant?.whatsappMenuAssistantEnabled || restaurant.status !== "active" || restaurant.whatsappInstance !== instance
   || !/^[a-z0-9-]{1,90}$/.test(restaurant.slug) || !await assistantEntitlement(db, restaurantId)) return res.status(204).end();
 const menu = (await base.collection("settings").doc("public").get()).data();
 if (menu?.published !== true) return res.status(204).end();

 const contact = base.collection("whatsappAssistantContacts").doc(signature(config.apiKey, "contact", restaurantId + ":" + number));
 const reply = await db.runTransaction(async tx => {
  const last = (await tx.get(contact)).data()?.lastMessageAt ?? 0;
  if (time <= last) return false;
  tx.set(contact, {lastMessageAt:time});
  return time - last >= quietPeriod;
 });
 if (!reply) return res.status(204).end();
 const link = new URL("/", webhookOrigin);
 link.searchParams.set("loja", restaurant.slug);
 const result = await sendMenuLink({request, instance, number, menu, link:link.href});
 if (!result.ok) return res.status(502).end();
 return res.status(204).end();
}
