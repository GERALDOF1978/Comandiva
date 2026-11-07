import React from 'react';
import {ArrowRight, ChefHat, ClipboardList, CreditCard, LayoutDashboard, Monitor, Pizza, QrCode, ShoppingCart, Utensils, CheckCircle2} from 'lucide-react';
import './dishy-gallery.css';

const screens = [
  {Icon:Pizza,title:'Montagem inteligente de pizza',description:'Tamanhos, quatro sabores, bordas e adicionais selecionados pelo próprio cliente.',image:'pizza'},
  {Icon:ShoppingCart,title:'Carrinho do cliente',description:'Itens, sabores e valor total organizados antes de finalizar o pedido.',image:'carrinho'},
  {Icon:CreditCard,title:'Formas de pagamento',description:'O cliente escolhe entre as formas de pagamento habilitadas pela loja.',image:'pagamento'},
  {Icon:ClipboardList,title:'Pedidos em tempo real',description:'A central reúne pedidos por modalidade e situação para a equipe acompanhar.',image:'pedidos'},
  {Icon:ChefHat,title:'Fila de produção da cozinha',description:'Pedidos em preparo e prontos, com os detalhes de cada item.',image:'cozinha'},
  {Icon:Utensils,title:'Mesas e comandas',description:'Consumo e total acumulado em contas abertas, com opção de QR Code.',image:'mesas'},
  {Icon:Monitor,title:'PDV do restaurante',description:'Categorias, produtos e pedido atual lado a lado, para operação no caixa.',image:'pdv'},
  {Icon:LayoutDashboard,title:'Painel de gestão',description:'Indicadores de pedidos, produção e faturamento do estabelecimento.',image:'painel'}
];
const highlights=[
  {Icon:QrCode,title:'QR Code e cardápio',description:'Acesso pelo celular, com a identidade do estabelecimento.'},
  {Icon:CheckCircle2,title:'Atendimento flexível',description:'Entrega, retirada, mesas e comandas conforme cada loja.'},
  {Icon:CreditCard,title:'PIX e pagamentos',description:'Formas de recebimento conforme as integrações configuradas.'},
  {Icon:ChefHat,title:'Equipe conectada',description:'Da central de pedidos à cozinha e aos entregadores.'}
];
export default function DishyGallery({variant='commercial'}) {
  const ads=variant==='ads';
  const signup=ads?'/cadastro-anuncio?origem=anuncio':'/cadastro';
  return <section className={'dishy-gallery dishy-gallery--'+variant} id="demonstracao" aria-labelledby={'dishy-gallery-title-'+variant}>
    <div className="dishy-gallery__inner">
      <div className="dishy-gallery__intro">
        <span className="dishy-gallery__eyebrow">TELAS REAIS DO DISHY</span>
        <h2 id={'dishy-gallery-title-'+variant}>Veja o sistema por dentro.</h2>
        <p>São capturas de uma loja configurada no Dishy. Veja como o cliente monta o pedido e como o restaurante acompanha a operação.</p>
      </div>
      <div className="dishy-gallery__journey">
        {screens.map(({Icon,title,description,image},i)=><article className="dishy-gallery__step" key={image}>
          <a className="dishy-gallery__visual" href={'/marketing/real-'+image+'.webp'} target="_blank" rel="noopener noreferrer" aria-label={'Ampliar print real: '+title}>
            <img src={'/marketing/real-'+image+'.webp'} alt={'Captura real do Dishy: '+title} loading="lazy" decoding="async"/>
            <span className="dishy-gallery__step-num">{String(i+1).padStart(2,'0')}</span>
            <span className="dishy-gallery__zoom">Toque para ampliar ↗</span>
          </a>
          <div className="dishy-gallery__step-copy"><span className="dishy-gallery__step-icon"><Icon size={26}/></span><h3>{title}</h3><p>{description}</p></div>
        </article>)}
      </div>
      <p className="dishy-gallery__note">Capturas reais de demonstração, com informações sensíveis ocultadas. A aparência e as opções podem variar conforme a configuração de cada estabelecimento. As imagens não comprovam transações financeiras concluídas.</p>
      <div className="dishy-gallery__extras">
        <div className="dishy-gallery__extras-heading"><span className="dishy-gallery__eyebrow">MAIS DO QUE UM CARDÁPIO</span><h3>Seu restaurante organizado em um só lugar.</h3></div>
        <div className="dishy-gallery__highlights">{highlights.map(({Icon,title,description})=><article key={title}><span><Icon size={25}/></span><h4>{title}</h4><p>{description}</p></article>)}</div>
      </div>
      <div className="dishy-gallery__action"><div><strong>Experimente o Dishy no seu negócio.</strong><p>37 dias grátis para conhecer as ferramentas, sem cartão no cadastro.</p></div><a href={signup}>Começar agora <ArrowRight size={19}/></a></div>
    </div>
  </section>;
}