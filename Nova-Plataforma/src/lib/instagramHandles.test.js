import test from "node:test";
import assert from "node:assert/strict";
import { parseInstagram, normalizeBusinessHandle, collectPublicHandles, reviewedForCaption } from "./instagramHandles.js";

test("normaliza @, nome simples e links públicos válidos", () => {
  assert.equal(parseInstagram("@Pizzaria.Exemplo")?.handle, "@pizzaria.exemplo");
  assert.equal(parseInstagram("https://www.instagram.com/Pizzaria_Exemplo/?hl=pt-br")?.username, "pizzaria_exemplo");
  assert.equal(parseInstagram("instagram.com/Acai.Exemplo/")?.url, "https://www.instagram.com/acai.exemplo/");
});
test("rejeita páginas especiais, hosts falsos, perfis inválidos e URLs suspeitas", () => {
  for (const value of [
    "https://instagram.com/explore/", "https://instagram.com/p/abc", "https://instagram.com/reel/abc",
    "https://instagram.com/stories/abc", "https://instagram.com.evil.test/certo",
    "https://evil.test/instagram.com/certo", "@nome ruim", "@invalid..handle",
    "javascript:alert(1)", "https://usuario:senha@instagram.com/pizzaria",
    "https://instagram.com/@pizzaria",
  ]) assert.equal(parseInstagram(value), null, value);
});
test("a importação exige negócio, nicho e fonte pública válida", () => {
  const base = { name:"Restaurante Demo",city:"Rio Claro",state:"SP",segment:"restaurante",instagramUrl:"@restaurante_demo",sourceUrl:"https://www.openstreetmap.org/node/12345" };
  assert.equal(normalizeBusinessHandle(base)?.username, "restaurante_demo");
  assert.equal(normalizeBusinessHandle({...base,sourceUrl:"https://tracker.example.com/foo"}), null);
  assert.equal(normalizeBusinessHandle({...base,segment:"outro"}), null);
});
test("desduplica e respeita bloqueio de contato", () => {
  const a = {name:"Restaurante A", city:"Rio Claro",segment:"restaurante",instagramUrl:"@exemplo",sourceUrl:"https://www.openstreetmap.org/node/1"};
  assert.equal(collectPublicHandles([a,{...a, instagramUrl:"https://instagram.com/EXEMPLO"},{...a,instagramUrl:"@outro",status:"nao_contatar"}]).length,1);
});
test("cópia para legenda só considera perfis revisados, limitados a cinco", () => {
  const all=Array.from({length:8},(_,i)=>({username:"perfil"+i,status:i===3?"sugerida":"revisada"}));
  const selected=all.map(x=>x.username);
  const result=reviewedForCaption(all,selected,8);
  assert.equal(result.split(" ").length,5);
  assert.equal(result.includes("@perfil3"),false);
  assert.equal(reviewedForCaption(all,["perfil3"]), "");
});
