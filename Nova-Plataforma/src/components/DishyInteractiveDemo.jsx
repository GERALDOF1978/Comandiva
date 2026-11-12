import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ChefHat, ClipboardList, CreditCard, Monitor, Minus, Plus, RotateCcw, ShoppingBag, ShoppingCart, Store, Table2, Truck } from "lucide-react";
import "./DishyInteractiveDemo.css";

// Demonstração local e independente: não acessa Firebase, API, gateway ou pedidos reais.
const PRODUCTS = [
  { id: "burger", name: "X-Burger Especial", category: "Lanches", description: "Hambúrguer, queijo, alface e molho da casa.", price: 2690, emoji: "🍔" },
  { id: "duplo", name: "X-Tudo Duplo", category: "Lanches", description: "Dois hambúrgueres, queijo, bacon e salada.", price: 3590, emoji: "🍔" },
  { id: "pizza", name: "Pizza Grande", category: "Pizzas", description: "Pizza grande, até quatro sabores na versão completa.", price: 5990, emoji: "🍕" },
  { id: "marmita", name: "Marmita Caseira", category: "Marmitas", description: "Arroz, feijão, proteína e guarnições.", price: 2890, emoji: "🍱" },
  { id: "acai", name: "Açaí 500 ml", category: "Açaí", description: "Com banana e granola.", price: 2290, emoji: "🍧" },
  { id: "refri", name: "Refrigerante Lata", category: "Bebidas", description: "350 ml geladinho.", price: 690, emoji: "🥤" },
];
const INITIAL_ORDERS = [
  { id: 1041, channel: "Delivery", items: [{ id: "burger", qty: 2 }, { id: "refri", qty: 1 }], status: "Em preparo" },
  { id: 1042, channel: "Mesa 03", items: [{ id: "pizza", qty: 1 }], status: "Novo" },
];
const STATUS_STEPS = ["Novo", "Aceito", "Em preparo", "Pronto", "Concluído"];
const NAV_ITEMS = [
  { key: "cardapio", label: "Cardápio digital", Icon: Store },
  { key: "pedidos", label: "Pedidos", Icon: ClipboardList },
  { key: "pdv", label: "PDV", Icon: Monitor },
  { key: "mesas", label: "Mesas", Icon: Table2 },
];
function currency(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function totalFor(items) {
  return items.reduce((sum, item) => sum + (PRODUCTS.find(p => p.id === item.id)?.price || 0) * item.qty, 0);
}
function ItemsSummary({ items }) {
  return <ul className="dishyTryOrderItems">{items.map(item => {
    const product = PRODUCTS.find(p => p.id === item.id);
    return product ? <li key={item.id}><span>{item.qty}× {product.name}</span><b>{currency(product.price * item.qty)}</b></li> : null;
  })}</ul>;
}

export default function DishyInteractiveDemo() {
  const [view, setView] = useState("cardapio");
  const [category, setCategory] = useState("Todos");
  const [channel, setChannel] = useState("Delivery");
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState(INITIAL_ORDERS);
  const [nextId, setNextId] = useState(1043);
  const [table, setTable] = useState("02");
  const [notice, setNotice] = useState("");
  const [customerMode, setCustomerMode] = useState(false);
  const categories = useMemo(() => ["Todos", ...new Set(PRODUCTS.map(p => p.category))], []);
  const visible = category === "Todos" ? PRODUCTS : PRODUCTS.filter(p => p.category === category);
  const total = totalFor(cart);
  useEffect(() => {
    document.title = "Demonstração interativa | Dishy";
    return () => { document.title = "Dishy"; };
  }, []);
  const add = (id) => {
    setNotice("");
    setCart(previous => {
      const found = previous.find(item => item.id === id);
      return found ? previous.map(item => item.id === id ? { ...item, qty: item.qty + 1 } : item) : [...previous, { id, qty: 1 }];
    });
  };
  const adjust = (id, delta) => setCart(previous => previous.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item).filter(item => item.qty > 0));
  const submit = (orderChannel) => {
    if (!cart.length) return;
    const id = nextId;
    setNextId(value => value + 1);
    setOrders(previous => [{ id, items: cart.map(item => ({ ...item })), channel: orderChannel, status: "Novo" }, ...previous]);
    setCart([]);
    setView("pedidos");
    setCustomerMode(false);
    setNotice("Pedido fictício #" + id + " enviado! Veja como ele aparece na central de pedidos.");
  };
  const advance = (id) => setOrders(previous => previous.map(order => {
    if (order.id !== id) return order;
    const step = STATUS_STEPS.indexOf(order.status);
    return { ...order, status: STATUS_STEPS[Math.min(step + 1, STATUS_STEPS.length - 1)] };
  }));
  const reset = () => {
    setOrders(INITIAL_ORDERS);
    setCart([]);
    setNextId(1043);
    setView("cardapio");
    setNotice("Demonstração reiniciada.");
  };
  return <div className="dishyTry">
    <header className="dishyTryTop">
      <a href="/" className="dishyTryBrand" aria-label="Voltar para o site Dishy">
        <img src="/dishy-logo-oficial.png" alt="Dishy" />
      </a>
      <span className="dishyTryTag">AMBIENTE DE DEMONSTRAÇÃO</span>
      <a className="dishyTrySign" href="/cadastro">37 dias grátis <ArrowRight size={17} /></a>
    </header>
    <main className="dishyTryMain">
      <div className="dishyTryIntro">
        <a className="dishyTryBack" href="/"><ArrowLeft size={16} /> Voltar ao site comercial</a>
        <h1>Experimente o <span>Dishy</span> antes de se cadastrar.</h1>
        <p>Conheça o cardápio, crie um pedido fictício e acompanhe o fluxo entre atendimento, PDV e mesas. Clique à vontade: nada aqui gera cobrança ou pedido real.</p>
        <div className="dishyTryFacts"><span><CheckCircle2 size={16} /> Sem cadastro</span><span><CheckCircle2 size={16} /> Sem pagamentos reais</span><span><CheckCircle2 size={16} /> Funciona no celular</span></div>
      </div>
      <div className="dishyTryShell">
        <div className="dishyTrySidebar">
          <div className="dishyTrySample"><div className="dishyTrySampleIcon">🍔</div><div><b>Sabor da Praça</b><small>Restaurante fictício</small></div></div>
          <nav className="dishyTryNav" aria-label="Áreas da demonstração">
            {NAV_ITEMS.map(({key,label,Icon}) => <button type="button" key={key} className={view === key ? "active" : ""} onClick={() => { setView(key); setNotice(""); setCategory("Todos"); }}><Icon size={19} />{label}</button>)}
          </nav>
          <div className="dishyTryHint">Teste o fluxo de um restaurante sem acessar dados de estabelecimentos verdadeiros.</div>
          <button className="dishyTryReset" onClick={reset} type="button"><RotateCcw size={15} /> Reiniciar simulação</button>
        </div>
        <div className="dishyTryWorkspace">
          {notice && <div role="status" className="dishyTryNotice"><CheckCircle2 size={18} /> {notice}</div>}
          {view === "cardapio" && <>
            <div className="dishyTrySectionHead"><div><small>VISÃO DO CLIENTE</small><h2>Cardápio digital</h2><p>Escolha uma modalidade e monte um pedido para acompanhar o atendimento.</p></div><ShoppingBag size={28}/></div>
            <div className="dishyTryBanner"><span>🍔</span><div><strong>Seu sabor favorito a um clique!</strong><small>Sabor da Praça • Cardápio de demonstração</small></div></div>
            <div className="dishyTryChoice" aria-label="Modalidade do pedido">{["Delivery", "Retirada", "Mesa 02"].map(mode => <button type="button" key={mode} className={channel === mode ? "selected" : ""} onClick={() => setChannel(mode)}>{mode === "Delivery" ? "🚚" : mode === "Retirada" ? "🛍️" : "🍽️"} {mode}</button>)}</div>
            <ProductList products={visible} categories={categories} category={category} onCategory={setCategory} onAdd={add}/>
          </>}
          {view === "pdv" && <>
            <div className="dishyTrySectionHead"><div><small>VISÃO DO ATENDENTE</small><h2>Ponto de venda (PDV)</h2><p>Adicione produtos e simule o registro de uma venda no balcão.</p></div><CreditCard size={27}/></div>
            <ProductList products={visible} categories={categories} category={category} onCategory={setCategory} onAdd={add} compact/>
          </>}
          {view === "pedidos" && <>
            <div className="dishyTrySectionHead"><div><small>PAINEL OPERACIONAL</small><h2>Central de pedidos</h2><p>Aceite pedidos, mande para preparo e marque como pronto, sem afetar pedidos reais.</p></div><ChefHat size={28}/></div>
            <div className="dishyTryStats"><span><b>{orders.filter(o => o.status === "Novo").length}</b> Novos</span><span><b>{orders.filter(o => ["Aceito", "Em preparo"].includes(o.status)).length}</b> Em andamento</span><span><b>{orders.filter(o => o.status === "Pronto").length}</b> Prontos</span></div>
            <div className="dishyTryOrderGrid">{orders.map(order => <article className="dishyTryOrder" key={order.id}>
              <div className="dishyTryOrderHead"><strong>Pedido #{order.id}</strong><span className={"dishyTryStatus status-" + STATUS_STEPS.indexOf(order.status)}>{order.status}</span></div>
              <small>{order.channel} • Demonstração</small>
              <ItemsSummary items={order.items}/>
              <div className="dishyTryOrderFoot"><strong>{currency(totalFor(order.items))}</strong>{order.status !== "Concluído" && <button type="button" onClick={() => advance(order.id)}>{order.status === "Novo" ? "Aceitar pedido" : order.status === "Aceito" ? "Iniciar preparo" : order.status === "Em preparo" ? "Marcar pronto" : "Concluir"} <ArrowRight size={15}/></button>}</div>
            </article>)}</div>
            <button className="dishyTryInline" type="button" onClick={() => setView("cardapio")}><Plus size={15}/> Criar outro pedido</button>
          </>}
          {view === "mesas" && <>
            <div className="dishyTrySectionHead"><div><small>ATENDIMENTO NO SALÃO</small><h2>Mesas e comandas</h2><p>Selecione uma mesa, inclua produtos e veja o pedido na central.</p></div><Table2 size={27}/></div>
            <div className="dishyTryTables">{["01", "02", "03", "04", "05", "06"].map(number => <button type="button" key={number} onClick={() => setTable(number)} className={table === number ? "selected" : ""}><Table2 size={26}/><strong>Mesa {number}</strong><small>{number === "03" ? "Em atendimento" : number === table ? "Selecionada" : "Disponível"}</small></button>)}</div>
            <div className="dishyTryTableProducts"><h3>Adicionar à Mesa {table}</h3><p>Escolha um produto abaixo. Você poderá lançar os itens na comanda fictícia.</p><div>{PRODUCTS.slice(0, 4).map(product => <button type="button" key={product.id} onClick={() => add(product.id)}><span>{product.emoji}</span><b>{product.name}</b><small>{currency(product.price)}</small><Plus size={15}/></button>)}</div></div>
          </>}
        </div>
        <aside className="dishyTryCart">
          <h3><ShoppingCart size={20} /> {view === "mesas" ? "Comanda • Mesa " + table : view === "pdv" ? "Venda no caixa" : "Seu pedido"}</h3>
          {cart.length ? <>
            <ul>{cart.map(item => {
              const product = PRODUCTS.find(p => p.id === item.id);
              return product ? <li key={item.id}><span className="dishyTryCartEmoji">{product.emoji}</span><div><b>{product.name}</b><small>{currency(product.price * item.qty)}</small><div className="dishyTryQty"><button type="button" aria-label={"Diminuir " + product.name} onClick={() => adjust(item.id, -1)}><Minus size={13}/></button><span>{item.qty}</span><button type="button" aria-label={"Aumentar " + product.name} onClick={() => adjust(item.id, 1)}><Plus size={13}/></button></div></div></li> : null;
            })}</ul>
            <div className="dishyTryTotal"><span>Total simulado</span><strong>{currency(total)}</strong></div>
            <button type="button" className="dishyTrySubmit" onClick={() => submit(view === "mesas" ? "Mesa " + table : view === "pdv" ? "PDV • Balcão" : channel)}>{view === "pdv" ? "Simular venda" : view === "mesas" ? "Adicionar à comanda" : "Simular pedido"} <ArrowRight size={17}/></button>
          </> : <div className="dishyTryEmpty"><ShoppingCart size={28}/><p>Adicione produtos para simular um pedido.</p></div>}
          <p className="dishyTrySafety">Esta é uma simulação visual. Nenhuma transação, cobrança ou gravação no sistema real é realizada.</p>
        </aside>
      </div>
      <section className="dishyTryFinal"><h2>Gostou do que viu?</h2><p>Crie seu estabelecimento e aproveite 37 dias grátis para testar o Dishy no seu próprio negócio.</p><a href="/cadastro">Criar conta grátis <ArrowRight size={18}/></a></section>
    </main>
  </div>;
}
function ProductList({ products, categories, category, onCategory, onAdd, compact = false }) {
  return <>
    <div className="dishyTryCategories" aria-label="Categorias de produtos">{categories.map(name => <button type="button" key={name} onClick={() => onCategory(name)} className={category === name ? "selected" : ""}>{name}</button>)}</div>
    <div className={"dishyTryProducts" + (compact ? " compact" : "")}>{products.map(product => <article key={product.id} className="dishyTryProduct"><div className="dishyTryProductEmoji">{product.emoji}</div><div className="dishyTryProductInfo"><h3>{product.name}</h3><p>{product.description}</p><div><strong>{currency(product.price)}</strong><button type="button" onClick={() => onAdd(product.id)} aria-label={"Adicionar " + product.name}><Plus size={16}/> Adicionar</button></div></div></article>)}</div>
  </>;
}
