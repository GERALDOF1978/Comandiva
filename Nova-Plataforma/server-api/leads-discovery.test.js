import test from "node:test";
import assert from "node:assert/strict";
import { getKnownCityCenter, geocodeCity, buildOverpassQuery, parseOsmElements, discoverFromOsm } from "./leads-discovery.js";

const base = { city: "Rio Claro", state: "SP", radiusKm: 10, segment: "todos", center: [-22.41139, -47.56139] };
const restaurant = { type: "node", id: 123, lat: -22.412, lon: -47.562, tags: { amenity: "restaurant", name: "Exemplo Restaurante", phone: "19999990000" } };

test("Rio Claro tem centro conhecido e não consulta geocodificador", async () => {
  assert.deepEqual(getKnownCityCenter("Rio Claro", "SP"), base.center);
  assert.equal(getKnownCityCenter("Rio Claro", "RJ"), null);
  const center = await geocodeCity("Rio Claro", "SP", { fetcher: () => { throw Error("Não deveria acessar Nominatim"); } });
  assert.deepEqual(center, base.center);
});

test("Consulta Overpass pequena exige nome e limita resposta", () => {
  const q = buildOverpassQuery(base.center, 10);
  assert.match(q, /\["name"\]/);
  assert.match(q, /out center 100/);
});

test("Resultados OSM são filtrados por distância, categoria e fonte real", () => {
  const items = parseOsmElements([
    restaurant,
    { ...restaurant, id: 124, tags: { amenity: "fast_food", name: "Outra Pizzaria", cuisine: "pizza" } },
    { ...restaurant, id: 125, lat: -23.3, lon: -48.3 },
    { ...restaurant, id: 123 },
  ], base);
  assert.equal(items.length, 2);
  assert.equal(items[0].sourceUrl.startsWith("https://www.openstreetmap.org/node/"), true);
  assert.equal(items[0].score, 55);
  assert.equal(parseOsmElements([restaurant], { ...base, segment: "pizzaria" }).length, 0);
});

test("Fonte secundária é acionada após falha da primeira", async () => {
  const urls = [];
  const fetcher = async (url) => {
    urls.push(url);
    if (url.includes("falha")) throw Error("timeout");
    return { ok: true, json: async () => ({ elements: [restaurant] }) };
  };
  const items = await discoverFromOsm(base, { fetcher, endpoints: ["https://falha.test/api", "https://ok.test/api"] });
  assert.equal(urls.length, 2);
  assert.equal(items.length, 1);
});

test("Falha nas duas fontes não inventa dados", async () => {
  const fetcher = async () => { throw Error("Indisponível"); };
  const oldError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(discoverFromOsm(base, { fetcher, endpoints: ["https://falha1.test", "https://falha2.test"] }), /search_provider_unavailable/);
  } finally { console.error = oldError; }
});

test("captura somente URLs de cardápio e pedidos explicitamente informadas no OSM", () => {
  const tagged = {
    ...restaurant, id: 221,
    tags: {
      amenity: "restaurant", name: "Restaurante com canais",
      "contact:website": "https://restaurante.exemplo",
      "website:menu": "https://restaurante.exemplo/cardapio",
      "website:orders": "https://restaurante.exemplo/pedir",
      "contact:instagram": "https://instagram.com/restaurante",
    },
  };
  const [lead] = parseOsmElements([tagged], base);
  assert.equal(lead.menuUrl, "https://restaurante.exemplo/cardapio");
  assert.equal(lead.orderUrl, "https://restaurante.exemplo/pedir");
  assert.equal(lead.instagramUrl, "https://instagram.com/restaurante");
  const [withoutTags] = parseOsmElements([restaurant], base);
  assert.equal(withoutTags.menuUrl, "");
  assert.equal(withoutTags.orderUrl, "");
});
