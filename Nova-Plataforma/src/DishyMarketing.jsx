import React, { useEffect } from "react";
import { ArrowRight, Check, ChefHat, CreditCard, MapPin, Menu as MenuIcon, QrCode, ShieldCheck, Smartphone, Store, Truck, Utensils, Wallet, X } from "lucide-react";
import "./dishy-marketing.css";
import DishyGallery from "./DishyGallery.jsx";

const SIGNUP_PATH = "/cadastro-anuncio";
const BENEFITS = [
  { Icon: QrCode, name: "Cardápio digital e QR Code", description: "Seu cardápio com a identidade da sua loja, pronto para compartilhar e receber pedidos." },
  { Icon: Wallet, name: "PIX integrado", description: "Pagamento associado ao pedido, com confirmação conforme a integração configurada." },
  { Icon: CreditCard, name: "Celular como maquininha", description: "Recebimento por aproximação NFC em aparelhos compatíveis e com a integração habilitada." },
  { Icon: Utensils, name: "Conta fechada na mesa", description: "O cliente consulta, fecha e paga a própria conta, direto do celular, sem precisar esperar o atendente." },
  { Icon: Truck, name: "Delivery, retirada e salão", description: "Cada estabelecimento ativa somente as modalidades de atendimento que utiliza." },
  { Icon: ChefHat, name: "Pedidos e cozinha conectados", description: "Organize o caminho do pedido até a entrega com PDV, comandas e status atualizados." },
];

function preserveCampaign() {
  const params = new URLSearchParams(window.location.search);
  try {
    const saved = JSON.parse(sessionStorage.getItem("dishy-campaign") || "{}");
    const next = { ...saved, origem: "anuncio" };
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"].forEach(key => {
      if (params.has(key)) next[key] = params.get(key);
    });
    sessionStorage.setItem("dishy-campaign", JSON.stringify(next));
    params.set("origem", "anuncio");
    return SIGNUP_PATH + "?" + params.toString();
  } catch { return SIGNUP_PATH + "?origem=anuncio"; }
}

function Logo({ dark = false }) {
  return <a className="dm-brand" href="/" aria-label="Dishy — site inicial">
    <img src="/dishy-logo-oficial.png" alt="Dishy" className={dark ? "dm-logo dm-logo-dark" : "dm-logo"} />
  </a>;
}

export default function DishyAdsLanding() {
  const signupUrl = preserveCampaign();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Dishy | Sistema para restaurantes criado em Rio Claro";
    const meta = document.querySelector('meta[name="description"]');
    const oldDescription = meta?.getAttribute("content");
    if (meta) meta.setAttribute("content", "Dishy: cardápio digital, pedidos, PIX integrado, pagamento por NFC e conta na mesa. Tecnologia criada em Rio Claro, SP.");
    return () => {
      document.title = previousTitle;
      if (meta && oldDescription !== null && oldDescription !== undefined) meta.setAttribute("content", oldDescription);
    };
  }, []);
  return <div className="dm-page">
    <header className="dm-header">
      <div className="dm-container dm-header-inner">
        <Logo />
        <span className="dm-local-label"><MapPin size={15}/> Criado em Rio Claro • SP</span>
        <a href={signupUrl} className="dm-header-cta">Começar grátis <ArrowRight size={17}/></a>
      </div>
    </header>
    <main>
      <section className="dm-hero">
        <div className="dm-hero-glow" aria-hidden="true"/>
        <div className="dm-container dm-hero-grid">
          <div className="dm-hero-copy">
            <span className="dm-eyebrow"><span className="dm-dot"/> LANÇAMENTO EM RIO CLARO E REGIÃO</span>
            <h1>Seu restaurante mais <em>digital.</em> Seu atendimento mais <em>inteligente.</em></h1>
            <p>Cardápio digital, pedidos online, PIX integrado, pagamento por aproximação no celular e clientes fechando a própria conta na mesa. Tudo conectado no Dishy.</p>
            <div className="dm-chips"><span><Check size={16}/> 37 dias grátis</span><span><Check size={16}/> Sem cartão para começar</span><span><Check size={16}/> Atendimento no seu ritmo</span></div>
            <a className="dm-cta" href={signupUrl}>Criar minha conta grátis <ArrowRight size={20}/></a>
            <small className="dm-hero-fine">Teste sem cobrança automática ao final. Taxas de serviços financeiros, quando aplicáveis, dependem do provedor.</small>
          </div>
          <div className="dm-stage" aria-label="Arte publicitária com cardápio digital e alimentos"><img className="dm-hero-poster" src="/marketing/poster-apresentacao.webp" alt="Dishy: restaurante mais digital e lucrativo, com cardápio pelo celular" width="600" height="750" decoding="async" fetchPriority="high"/>
            <div className="dm-stage-shape" aria-hidden="true"/>
            <div className="dm-phone"><div className="dm-phone-screen"><div className="dm-phone-brand"><img src="/dishy-logo-oficial.png" alt="Dishy"/><span>Cardápio digital</span></div><div className="dm-food-art">🍔</div><div className="dm-phone-title">Seu pedido, do seu jeito</div><div className="dm-phone-row"><span>🍕 Pizza personalizada</span><b>›</b></div><div className="dm-phone-row"><span>🥗 Marmitas e pratos</span><b>›</b></div><div className="dm-phone-row"><span>🥤 Bebidas e adicionais</span><b>›</b></div><div className="dm-phone-pay">Finalizar pedido</div></div></div>
            <div className="dm-floating dm-floating-pix"><Wallet size={21}/><span><strong>PIX integrado</strong><small>Pagamento no pedido</small></span></div>
            <div className="dm-floating dm-floating-table"><Utensils size={21}/><span><strong>Conta da mesa</strong><small>Feche e pague pelo celular</small></span></div>
            <span className="dm-mock-note">Prévia ilustrativa</span>
          </div>
        </div>
      </section>
      <div className="dm-strip"><div className="dm-container"><span><QrCode/> Cardápio e QR Code</span><span><CreditCard/> NFC por aproximação</span><span><Wallet/> PIX integrado</span><span><Utensils/> Mesa e comanda</span></div></div>
      <section className="dm-section dm-container" id="vantagens"><div className="dm-heading"><span className="dm-section-kicker">UM SISTEMA, MUITAS POSSIBILIDADES</span><h2>Tecnologia que resolve o dia a dia de quem vende comida.</h2><p>Escolha o que seu restaurante precisa. O Dishy conecta atendimento, pagamentos e gestão sem obrigar sua equipe a usar todos os módulos.</p></div><div className="dm-benefit-grid">{BENEFITS.map(({Icon,name,description})=><article className="dm-benefit" key={name}><span className="dm-benefit-icon"><Icon size={25}/></span><h3>{name}</h3><p>{description}</p></article>)}</div></section>
      <DishyGallery variant="ads"/>
      <section className="dm-showcase" id="pagamentos"><div className="dm-container dm-showcase-grid"><div className="dm-pay-preview"><div className="dm-pay-card"><span>CONTA DA MESA</span><strong>Seu cliente tem autonomia</strong><p>Consulte os itens, feche a conta e pague pelo celular.</p><div className="dm-pay-line"><span>Mesa 07</span><strong>Conta aberta</strong></div><div className="dm-pay-line"><span>Pagamento</span><strong>PIX integrado</strong></div><div className="dm-pay-done"><ShieldCheck/> Fechar conta com segurança</div></div><span className="dm-nfc-corner"><Smartphone size={17}/> NFC validado</span></div><div className="dm-showcase-copy"><span className="dm-section-kicker">MAIS CONVENIÊNCIA</span><h2>O cliente pode pagar sem precisar chamar ninguém.</h2><p>Na mesa, o cliente acompanha o consumo e pode fechar sua própria conta. No atendimento presencial, o celular compatível também pode funcionar como maquininha NFC.</p><p>Para o dono, o PIX fica integrado ao pedido e às confirmações de pagamento, conforme o provedor configurado.</p><a href={signupUrl} className="dm-secondary-cta">Quero conhecer na minha loja <ArrowRight size={18}/></a></div></div></section>
      <section className="dm-section dm-container"><div className="dm-heading"><span className="dm-section-kicker">FEITO PERTO DE VOCÊ</span><h2>O Dishy nasceu em Rio Claro, São Paulo.</h2><p>Estamos começando a apresentar a plataforma aos restaurantes de Rio Claro e região. Uma tecnologia criada aqui, para atender quem conhece de perto a rotina de um negócio de alimentação.</p></div><div className="dm-local-banner"><div><MapPin size={28}/><h3>Rio Claro é nosso ponto de partida.</h3><p>Restaurantes, pizzarias, lanchonetes, marmitarias, açaí e muito mais. Queremos ouvir os estabelecimentos da região e evoluir com quem usa o Dishy no dia a dia.</p></div><a href={signupUrl} className="dm-cta dm-local-cta">Participar do lançamento <ArrowRight size={17}/></a></div></section>
      <section className="dm-section dm-steps-section"><div className="dm-container"><div className="dm-heading"><span className="dm-section-kicker">COMECE SEM COMPLICAÇÃO</span><h2>Três passos para começar.</h2></div><div className="dm-steps"><article><b>01</b><h3>Crie sua conta</h3><p>Faça o cadastro com seu e-mail ou Google.</p></article><article><b>02</b><h3>Configure sua loja</h3><p>Escolha modalidades, produtos, identidade visual e meios de pagamento.</p></article><article><b>03</b><h3>Divulgue seu cardápio</h3><p>Compartilhe o link ou QR Code e comece a receber pedidos.</p></article></div></div></section>
      <section className="dm-final"><div className="dm-container"><span className="dm-section-kicker">OFERTA DE INAUGURAÇÃO</span><h2>Experimente o Dishy por 37 dias grátis.</h2><p>Conheça os recursos no seu próprio estabelecimento. Nenhum cartão é exigido no cadastro e não há cobrança automática ao final do período.</p><a href={signupUrl} className="dm-cta">Começar meus 37 dias <ArrowRight size={19}/></a><small>Depois do período grátis, a continuidade depende das condições comerciais informadas antes da contratação.</small></div></section>
    </main>
    <footer className="dm-footer"><div className="dm-container"><Logo/><span>Desenvolvido em Rio Claro, SP • <a href="https://dishy.com.br">dishy.com.br</a></span><a href="/">Conhecer o site completo</a></div></footer>
    <a href={signupUrl} className="dm-mobile-cta">Começar grátis <ArrowRight size={18}/></a>
  </div>;
}