import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

const DEFAULTS = { active: true, maxRadiusKm: 8, baseFeeCents: 500, perKmCents: 150, minimumOrderCents: 0 };
const brl = cents => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const money = cents => (cents / 100).toFixed(2).replace(".", ",");
function cents(value) {
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Informe valores monetários válidos e não negativos.");
  return Math.round(n * 100);
}
export function calculateStraightLineKm(lat1, lon1, lat2, lon2) {
  const numbers = [lat1, lon1, lat2, lon2].map(Number);
  if (numbers.some(n => !Number.isFinite(n))) throw new Error("Coordenadas inválidas.");
  if (Math.abs(numbers[0]) > 90 || Math.abs(numbers[2]) > 90 || Math.abs(numbers[1]) > 180 || Math.abs(numbers[3]) > 180) throw new Error("Coordenadas fora dos limites.");
  const rad = n => n * Math.PI / 180;
  const [a,b,c,d] = numbers;
  const h = Math.sin(rad(c-a)/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0,1-h)));
}
export function quoteDelivery(config, distanceKm, subtotalCents) {
  if (!config.active) return { available:false, reason:"Delivery desativado" };
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return { available:false, reason:"Localização inválida" };
  if (distanceKm > config.maxRadiusKm) return { available:false, reason:"Fora da área de entrega" };
  if (subtotalCents < config.minimumOrderCents) return { available:false, reason:"Pedido abaixo do mínimo" };
  return { available:true, feeCents:config.baseFeeCents + Math.round(distanceKm * config.perKmCents) };
}
export default function DeliverySettings() {
  const [user, setUser] = useState(undefined);
  const [restaurantId, setRestaurantId] = useState("");
  const [form, setForm] = useState(DEFAULTS);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);
  async function load() {
    if (!user || !restaurantId.trim()) return setMessage("Entre na conta e informe o ID do estabelecimento.");
    setBusy(true); setMessage(""); setLoaded(false);
    try {
      const snap = await getDoc(doc(db, "restaurants", restaurantId.trim(), "settings", "delivery"));
      setForm({ ...DEFAULTS, ...(snap.exists() ? snap.data() : {}) });
      setLoaded(true);
      setMessage(snap.exists() ? "Configuração carregada." : "Sem configuração anterior. Valores sugeridos carregados.");
    } catch (e) { setMessage("Não foi possível carregar. Verifique seu acesso ao estabelecimento."); }
    finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault();
    if (!user || !restaurantId.trim() || !loaded) return setMessage("Carregue primeiro um estabelecimento autorizado.");
    if (!Number.isFinite(form.maxRadiusKm) || form.maxRadiusKm <= 0 || form.maxRadiusKm > 100) return setMessage("Informe um raio entre 0 e 100 km.");
    setBusy(true); setMessage("");
    try {
      await setDoc(doc(db, "restaurants", restaurantId.trim(), "settings", "delivery"), {
        ...form, updatedAt: serverTimestamp(), updatedBy: user.uid
      }, { merge:true });
      setMessage("Configuração salva no Firestore.");
    } catch (e) { setMessage("Não foi possível salvar. É necessário ser dono ou gerente deste restaurante."); }
    finally { setBusy(false); }
  }
  const setMoney = (field, value) => {
    try { setForm(f => ({...f,[field]:cents(value)})); setMessage(""); }
    catch { setMessage("Valor inválido."); }
  };
  return <section className="panel delivery-settings">
    <div className="panelhead"><div><h3>Configuração de delivery</h3><p>Distância em linha reta; taxa base + valor por km</p></div></div>
    {user === undefined ? <p>Verificando acesso...</p> : !user ? <p>Faça login para configurar o delivery.</p> : <>
      <div className="delivery-field"><label htmlFor="restaurant-id">ID do estabelecimento</label><div className="delivery-inline"><input id="restaurant-id" value={restaurantId} onChange={e=>{setRestaurantId(e.target.value);setLoaded(false);}} placeholder="ID no Firestore"/><button type="button" disabled={busy} onClick={load}>Carregar</button></div></div>
      {loaded && <form onSubmit={save} className="delivery-form">
        <label className="delivery-check"><input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/> Aceitar entregas</label>
        <div className="delivery-field"><label>Raio máximo (km)</label><input type="number" min="0.1" max="100" step="0.1" value={form.maxRadiusKm} onChange={e=>setForm(f=>({...f,maxRadiusKm:Number(e.target.value)}))}/></div>
        {[[ "Taxa base (R$)","baseFeeCents"],["Valor por km (R$)","perKmCents"],["Pedido mínimo (R$)","minimumOrderCents"]].map(([label,field])=><MoneyInput key={field} label={label} centsValue={form[field]} onCommit={value=>setMoney(field,value)}/>)}
        <p>Exemplo para 4 km: {brl(form.baseFeeCents + Math.round(4*form.perKmCents))} {form.maxRadiusKm < 4 || !form.active ? "(entrega indisponível)" : ""}</p>
        <button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar configuração"}</button>
      </form>}
      {message && <p role="status" className="delivery-message">{message}</p>}
    </>}
  </section>;
}
function MoneyInput({label,centsValue,onCommit}) {
  const [value,setValue]=useState(money(centsValue));
  useEffect(()=>setValue(money(centsValue)),[centsValue]);
  return <div className="delivery-field"><label>{label}</label><input inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)} onBlur={()=>onCommit(value)}/></div>;
}
