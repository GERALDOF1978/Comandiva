import React, { useState } from "react";
import { ArrowRight, Check, QrCode, ShoppingBag, Utensils, Truck } from "lucide-react";
import "./dishy-segment-showcase.css";

const TYPES = [
  {name:"Restaurantes",emoji:"🍽️",shop:"Sabor da Praça",category:"Pratos",product:"Marmita especial",detail:"Arroz, feijão, proteína e guarnição",price:"R$ 29,90"},
  {name:"Lanchonetes",emoji:"🍔",shop:"Bistrô do Bairro",category:"Lanches",product:"X-Burger artesanal",detail:"Pão, queijo e adicionais",price:"R$ 28,90"},
  {name:"Pizzarias",emoji:"🍕",shop:"Pizza da Vila",category:"Pizzas",product:"Pizza grande",detail:"Sabores, borda e adicionais",price:"A partir de R$ 49,90"},
  {name:"Açaí",emoji:"🥣",shop:"Açaí da Praça",category:"Açaí",product:"Açaí 500 ml",detail:"Escolha complementos e coberturas",price:"R$ 22,00"},
  {name:"Cafés",emoji:"☕",shop:"Café Central",category:"Cafés",product:"Cappuccino cremoso",detail:"Tamanhos e acompanhamentos",price:"R$ 14,90"},
  {name:"Bares",emoji:"🍹",shop:"Bar do Pátio",category:"Porções",product:"Porção da casa",detail:"Atendimento no salão e comanda",price:"R$ 34,90"},
  {name:"Marmitarias",emoji:"🍱",shop:"Marmita Boa",category:"Marmitas",product:"Marmita grande",detail:"Proteínas e guarnições à escolha",price:"R$ 32,00"},
  {name:"Food trucks",emoji:"🚚",shop:"Truck do Sabor",category:"Combos",product:"Combo especial",detail:"Pedido no balcão ou retirada",price:"R$ 35,90"}
];

export default function DishySegmentShowcase({variant="commercial", signupHref="/cadastro"}) {
  const [selected, setSelected] = useState(0);
  const item = TYPES[selected];
  return <section className={"ds-showcase ds-"+variant} id="tipos-de-estabelecimento" aria-labelledby="ds-showcase-title">
    <div className="ds-wrap">
      <div className="ds-head">
        <span className="ds-kicker">O DISHY PARA SEU NEGÓCIO</span>
        <h2 id="ds-showcase-title">Um sistema para cada tipo de estabelecimento.</h2>
        <p>Escolha um segmento para visualizar como pode ficar o cardápio de uma loja no Dishy.</p>
      </div>
      <div className="ds-types" role="group" aria-label="Selecione o tipo de estabelecimento">
        {TYPES.map((type,i)=><button type="button" key={type.name} className={"ds-type"+(i===selected?" ds-active":"")} onClick={()=>setSelected(i)} aria-pressed={i===selected}>
          <span className="ds-type-emoji" aria-hidden="true">{type.emoji}</span>
          <strong>{type.name}</strong>
        </button>)}
      </div>
      <div className="ds-preview" aria-live="polite">
        <div className="ds-phone" aria-label={"Demonstração ilustrativa do cardápio de "+item.shop}>
          <div className="ds-phone-top"><span>● ● ●</span><b>Cardápio digital</b></div>
          <div className="ds-shop-banner"><span className="ds-shop-logo" aria-hidden="true">{item.emoji}</span><div><strong>{item.shop}</strong><small>Seu cardápio, sua identidade</small></div></div>
          <div className="ds-tabs"><span>{item.category}</span><span>Mais pedidos</span><span>Bebidas</span></div>
          <div className="ds-product"><span className="ds-product-emoji" aria-hidden="true">{item.emoji}</span><div><strong>{item.product}</strong><small>{item.detail}</small><b>{item.price}</b></div><span className="ds-plus">+</span></div>
          <div className="ds-demo-note">Exemplo fictício • valores ilustrativos</div>
        </div>
        <div className="ds-preview-copy"><span className="ds-kicker">EXPERIMENTE NA SUA LOJA</span><h3>Veja o Dishy funcionando em uma {item.name.toLowerCase()}.</h3><p>A demonstração mostra como o estabelecimento pode apresentar produtos, categorias e personalização. O visual é ilustrativo; sua loja terá seus próprios dados.</p>
          <div className="ds-check"><Check size={20}/> Logo, banner e cores do estabelecimento</div>
          <div className="ds-check"><QrCode size={20}/> Cardápio acessível por link ou QR Code</div>
          <div className="ds-check"><ShoppingBag size={20}/> Produtos, preços e complementos</div>
          <div className="ds-check"><Utensils size={20}/> Mesa e comanda, se habilitadas</div>
          <div className="ds-check"><Truck size={20}/> Entrega ou retirada conforme a loja</div>
          <a href={signupHref} className="ds-action">Criar minha loja grátis <ArrowRight size={20}/></a>
          <small>37 dias grátis • Sem cartão no cadastro</small>
        </div>
      </div>
    </div>
  </section>;
}
