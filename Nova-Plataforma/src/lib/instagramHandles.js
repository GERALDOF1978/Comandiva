// Perfis públicos comerciais do Instagram, sem scraping nem mensagens em massa.
// Um link/arroba ausente NÃO significa que a empresa não tem Instagram.
const RESERVED = new Set([
  "p","reel","reels","stories","explore","accounts","direct","about","developer",
  "developers","help","privacy","legal","tags","locations","hashtag","hashtags",
  "challenge","channels","api","graphql","directory","_u","tv"
]);
const HANDLE_RE = /^[a-z0-9._]{1,30}$/i;
export function parseInstagram(value) {
  if (typeof value !== "string") return null;
  let text = value.trim();
  if (!text || text.length > 500) return null;
  let username = "";
  if (/^@/u.test(text)) username = text.slice(1);
  else if (text.startsWith("https://") || text.startsWith("http://") || /^www\.instagram\.com\//i.test(text) || /^instagram\.com\//i.test(text)) {
    if (!/^https?:\/\//i.test(text)) text = "https://" + text;
    let url;
    try { url = new URL(text); } catch { return null; }
    if (!["instagram.com","www.instagram.com","m.instagram.com"].includes(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || !["http:","https:"].includes(url.protocol)) return null;
    const parts = url.pathname.replace(/^\/+|\/+$/g,"").split("/");
    if (parts.length !== 1) return null;
    username = parts[0];
  } else username = text;
  username = username.toLowerCase();
  if (!HANDLE_RE.test(username) || RESERVED.has(username) || /^\.|\.$/.test(username) || username.includes("..")) return null;
  return { username, handle: "@" + username, url: "https://www.instagram.com/" + username + "/" };
}
const SEGMENTS = new Set(["restaurante","pizzaria","hamburgueria","lanchonete","acaiteria","marmitaria","cafeteria","padaria"]);
export function normalizeBusinessHandle(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const parsed = parseInstagram(raw.instagramUrl || raw.handle || raw.username || "");
  const businessName = String(raw.businessName || raw.name || "").trim().slice(0,120);
  const city = String(raw.city || "").trim().slice(0,80);
  const state = String(raw.state || "SP").trim().toUpperCase().slice(0,2);
  const segment = String(raw.segment || "").trim();
  if (!parsed || businessName.length < 2 || city.length < 2 || !/^[A-Z]{2}$/.test(state) || !SEGMENTS.has(segment)) return null;
  const sourceUrl = String(raw.sourceUrl || parsed.url).trim().slice(0,500);
  let safeSource;
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!["www.openstreetmap.org","openstreetmap.org","www.instagram.com","instagram.com"].includes(url.hostname.toLowerCase())) return null;
    safeSource = url.href;
  } catch { return null; }
  return { ...parsed, businessName, city, state, segment, sourceUrl: safeSource };
}
export function collectPublicHandles(items) {
  const result = [], seen = new Set();
  for (const raw of Array.isArray(items) ? items : []) {
    if (raw?.status === "nao_contatar") continue;
    const normalized = normalizeBusinessHandle(raw);
    if (!normalized || seen.has(normalized.username)) continue;
    seen.add(normalized.username);
    result.push(normalized);
  }
  return result;
}
export function reviewedForCaption(items, selectedNames, max = 5) {
  const set = new Set(Array.isArray(selectedNames) ? selectedNames : []);
  return (Array.isArray(items) ? items : [])
    .filter(v => v.status === "revisada" && set.has(v.username))
    .slice(0,Math.min(5,Math.max(0,max)))
    .map(v => "@" + v.username)
    .join(" ");
}
