// Busca pública de pequenos lotes no OpenStreetMap. Nenhum dado é inventado.
// O modo automático usa somente localidades já conhecidas ou geocodificadas sob demanda.
// Overpass é um serviço comunitário: disponibilidade não é garantida.
export const CITY_CENTERS_SP = Object.freeze({
  "rio claro": [-22.41139, -47.56139],
  "limeira": [-22.56797, -47.40833],
  "piracicaba": [-22.70833, -47.63361],
  "araras": [-22.35694, -47.38417],
});
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const HEADERS = {
  "User-Agent": "DishyLeads/0.2 (https://dishy.com.br; uso administrativo sob demanda)",
  "Accept": "application/json",
};
export function getKnownCityCenter(city, state) {
  if (String(state).toUpperCase() !== "SP") return null;
  const normalized = String(city).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return CITY_CENTERS_SP[normalized] ?? null;
}
export async function requestJson(url, options = {}, { fetcher = fetch, timeoutMs = 8500 } = {}) {
  const response = await fetcher(url, {
    ...options,
    headers: { ...HEADERS, ...options.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw Error("upstream_http_" + response.status);
  return response.json();
}
export async function geocodeCity(city, state, { fetcher = fetch } = {}) {
  const known = getKnownCityCenter(city, state);
  if (known) return known;
  const query = city + ", " + state + ", Brasil";
  const url = "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=" + encodeURIComponent(query);
  const items = await requestJson(url, {}, { fetcher, timeoutMs: 6000 });
  if (!Array.isArray(items) || !items.length) return null;
  const lat = Number(items[0].lat), lon = Number(items[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}
function determineSegment(tags = {}) {
  const amenity = tags.amenity || "", shop = tags.shop || "", name = String(tags.name || "");
  const cuisine = String(tags.cuisine || "");
  if (/pizza|pizzaria/i.test(name + " " + cuisine) && ["restaurant", "fast_food"].includes(amenity)) return "pizzaria";
  if (/burger|hamb[uú]rg/i.test(name + " " + cuisine) && ["restaurant", "fast_food"].includes(amenity)) return "hamburgueria";
  if (/marmit/i.test(name) && ["restaurant", "fast_food"].includes(amenity)) return "marmitaria";
  if (/a[çc]a[ií]/i.test(name + " " + cuisine) && ["ice_cream", "cafe", "fast_food"].includes(amenity)) return "acaiteria";
  if (amenity === "restaurant") return "restaurante";
  if (amenity === "fast_food" || amenity === "food_court") return "lanchonete";
  if (amenity === "cafe") return "cafeteria";
  if (shop === "bakery") return "padaria";
  if (shop === "confectionery" || shop === "pastry") return "cafeteria";
  if (amenity === "ice_cream") return "sorveteria";
  return "outro";
}
function distanceKm(a, b, c, d) {
  const rad = n => n * Math.PI / 180;
  const dl = rad(c - a), dn = rad(d - b);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dn / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function localScore(lead) {
  const reasons = ["Estabelecimento identificado no setor de alimentação."];
  let score = 30;
  if (lead.phone) { score += 15; reasons.push("Contato comercial público disponível."); }
  if (lead.website) { score += 5; reasons.push("Site comercial identificado."); }
  if (lead.segment !== "outro") { score += 10; reasons.push("Segmento atendido pelo Dishy."); }
  return { score, reasons };
}
export function buildOverpassQuery(center, radiusKm) {
  const radius = Math.round(Number(radiusKm) * 1000);
  const [lat, lon] = center;
  // Filtro por name antes do out evita resposta gigante e reduz custos do serviço público.
  return '[out:json][timeout:10];(nwr(around:' + radius + ',' + lat + ',' + lon + ')["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream)$"]["name"];nwr(around:' + radius + ',' + lat + ',' + lon + ')["shop"~"^(bakery|pastry|confectionery)$"]["name"];);out center 100;';
}
export function parseOsmElements(elements, { city, state, center, radiusKm, segment }) {
  const [lat, lon] = center, seen = new Set(), found = [];
  for (const item of Array.isArray(elements) ? elements : []) {
    const tags = item.tags || {};
    const name = String(tags.name || "").trim().slice(0, 120);
    if (!name) continue;
    const kind = determineSegment(tags);
    if (segment !== "todos" && segment !== kind) continue;
    const la = Number(item.lat ?? item.center?.lat), lo = Number(item.lon ?? item.center?.lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    const km = distanceKm(lat, lon, la, lo);
    if (km > radiusKm) continue;
    const sourceId = "osm:" + item.type + ":" + item.id;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    const link = "https://www.openstreetmap.org/" + item.type + "/" + item.id;
    const lead = {
      name, city, state, segment: kind, sourceId, sourceUrl: link,
      phone: String(tags["contact:phone"] || tags.phone || "").slice(0, 40),
      website: String(tags["contact:website"] || tags.website || "").slice(0, 500),
      address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"]].filter(Boolean).join(", ").slice(0, 250),
      distanceKm: Math.round(km * 10) / 10,
    };
    found.push({ ...lead, ...localScore(lead) });
  }
  return found.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 50);
}
export async function discoverFromOsm({ city, state, radiusKm, segment, center }, { fetcher = fetch, endpoints = OVERPASS_ENDPOINTS } = {}) {
  if (!center || center.length !== 2) throw Error("city_not_found");
  const body = new URLSearchParams({ data: buildOverpassQuery(center, radiusKm) });
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      const data = await requestJson(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }, { fetcher, timeoutMs: 10000 });
      if (!Array.isArray(data?.elements)) throw Error("invalid_osm_response");
      return parseOsmElements(data.elements, { city, state, center, radiusKm, segment });
    } catch (error) {
      errors.push(endpoint + ": " + (error?.message || "failure"));
    }
  }
  console.error("master-leads upstream exhausted", errors.join(" | "));
  throw Error("search_provider_unavailable");
}
