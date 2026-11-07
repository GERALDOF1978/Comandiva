import React from 'react';
import { ArrowRight, CheckCircle2, ChefHat, ClipboardList, CreditCard, Monitor, QrCode, ShoppingCart, Smartphone, Truck, Utensils } from 'lucide-react';
import './dishy-gallery.css';

const journey = [
  { Icon: Smartphone, step: '01', title: 'Cardápio da loja', description: 'O cliente escolhe entrega, retirada ou mesa e navega pelos produtos.', image: 'poster-apresentacao.webp' },
  { Icon: ShoppingCart, step: '02', title: 'Monte seu pedido', description: 'Pizzas com tamanhos, sabores, bordas e adicionais. O carrinho mostra tudo antes de confirmar.', image: 'poster-montagem.webp' },
  { Icon: CreditCard, step: '03', title: 'Finalização e PIX', description: 'O cliente escolhe a forma de pagamento e acompanha o status do pedido.', image: 'poster-conta-mesa.webp' },
  { Icon: ClipboardList, step: '04', title: 'Pedidos em tempo real', description: 'A central organiza os pedidos por situação e modalidade de atendimento.', image: 'poster-pdv.webp' },
  { Icon: ChefHat, step: '05', title: 'Cozinha conectada', description: 'A equipe visualiza a fila de produção e marca os pedidos prontos.', image: 'poster-cozinha.webp' },
  { Icon: Truck, step: '06', title: 'Entrega e retirada', description: 'O pedido segue até a retirada ou entrega, com acompanhamento por status.', image: 'poster-delivery.webp' },
];
const highlights = [
  { Icon: QrCode, title: 'QR Code nas mesas', description: 'Acesso ao cardápio e autoatendimento.' },
  { Icon: Utensils, title: 'Mesas e comandas', description: 'Consumo, fechamento de conta e PIX.' },
  { Icon: Monitor, title: 'PDV integrado', description: 'Produtos, adicionais e pedidos no caixa.' },
  { Icon: CheckCircle2, title: 'Sua marca', description: 'Logo, banner, cores e cardápio próprios.' },
];
export default function DishyGallery({ variant = 'commercial' }) {
  const ads = variant === 'ads';
  const signup = ads ? '/cadastro-anuncio?origem=anuncio' : '/cadastro';
  return <section className={'dishy-gallery dishy-gallery--' + variant} id="demonstracao" aria-labelledby={'dishy-gallery-title-' + variant}>
    <div className="dishy-gallery__inner">
      <div className="dishy-gallery__intro">
        <span className="dishy-gallery__eyebrow">CONHEÇA O DISHY EM AÇÃO</span>
        <h2 id={'dishy-gallery-title-' + variant}>Veja o Dishy funcionando, etapa por etapa.</h2>
        <p>Conheça o cardápio, a montagem de produtos, os pagamentos, a central de pedidos, a cozinha e a entrega. No celular, cada demonstração aparece inteira, uma abaixo da outra.</p>
      </div>
      <div className="dishy-gallery__journey">
        {journey.map(({ Icon, step, title, description, image }) => <article className="dishy-gallery__step" key={step}>
          <div className="dishy-gallery__visual"><img src={'/marketing/' + image} alt={'Ilustração do recurso: ' + title} loading="lazy" decoding="async" /><span className="dishy-gallery__step-num">{step}</span></div>
          <div className="dishy-gallery__step-copy"><span className="dishy-gallery__step-icon"><Icon size={21}/></span><h3>{title}</h3><p>{description}</p></div>
        </article>)}
      </div>
      <p className="dishy-gallery__note">Demonstrações visuais ilustrativas. Para conhecer o funcionamento real, acesse a demonstração do estabelecimento. A aparência varia conforme a configuração de cada loja.</p>
      <div className="dishy-gallery__extras">
        <div className="dishy-gallery__extras-heading"><span className="dishy-gallery__eyebrow">ALÉM DO DELIVERY</span><h3>Uma operação completa em um só lugar.</h3></div>
        <div className="dishy-gallery__highlights">{highlights.map(({Icon,title,description}) => <article key={title}><span><Icon size={24}/></span><h4>{title}</h4><p>{description}</p></article>)}</div>
      </div>
      <div className="dishy-gallery__action"><div><strong>Pronto para conhecer o Dishy na sua loja?</strong><p>Experimente por 37 dias grátis, sem cartão para começar.</p></div><a href={signup}>Começar agora <ArrowRight size={19}/></a></div>
    </div>
  </section>;
}