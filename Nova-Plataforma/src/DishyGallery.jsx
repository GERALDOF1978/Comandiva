import React from 'react';
import { ArrowRight } from 'lucide-react';
import './dishy-gallery.css';

const illustrations = [
  { filename: 'poster-conta-mesa.webp', title: 'Fechamento da conta na mesa', alt: 'Arte Dishy: cliente utilizando o próprio celular para fechar a conta no restaurante.' },
  { filename: 'poster-qr-mesa.webp', title: 'Pedidos pelo QR Code', alt: 'Arte Dishy: QR Code de mesa e cardápio no celular.' },
  { filename: 'poster-pdv.webp', title: 'PDV e gestão do restaurante', alt: 'Arte Dishy: interface ilustrativa de caixa e gestão de pedidos.' },
  { filename: 'poster-montagem.webp', title: 'Montagem inteligente', alt: 'Arte Dishy: montagem personalizada de pizzas, marmitas e açaí.' },
  { filename: 'poster-delivery.webp', title: 'Delivery e retirada', alt: 'Arte Dishy: entregador recebendo pedido e retirada no balcão.' },
  { filename: 'poster-cozinha.webp', title: 'Cozinha e entregadores', alt: 'Arte Dishy: pedidos acompanhados da preparação até a saída para entrega.' },
];

export default function DishyGallery({ variant = 'commercial' }) {
  const ads = variant === 'ads';
  const images = ads ? illustrations.slice(0, 3) : illustrations;
  return (
    <section className={'dishy-gallery dishy-gallery--' + variant} aria-labelledby={'dishy-gallery-title-' + variant}>
      <div className="dishy-gallery__inner">
        <div className="dishy-gallery__intro">
          <span className="dishy-gallery__eyebrow">VEJA OS DIFERENCIAIS EM IMAGENS</span>
          <h2 id={'dishy-gallery-title-' + variant}>{ads ? 'Tecnologia que você vê. Praticidade que você sente.' : 'Veja como o Dishy facilita a rotina do seu restaurante.'}</h2>
          <p>{ads ? 'Conheça o atendimento por QR Code, a autonomia do cliente e o controle de pedidos.' : 'Uma visão dos recursos que tornam o atendimento e a gestão mais simples, da mesa à entrega.'}</p>
        </div>
        <div className="dishy-gallery__grid">
          {images.map(({ filename, title, alt }) => (
            <figure className="dishy-gallery__item" key={filename}>
              <img src={'/marketing/' + filename} alt={alt} width="600" height="750" loading="lazy" decoding="async" />
              <figcaption>{title}</figcaption>
            </figure>
          ))}
        </div>
        <p className="dishy-gallery__note">Artes ilustrativas. A aparência de telas e produtos pode variar conforme a configuração da loja.</p>
        {ads && <a className="dishy-gallery__link" href="/cadastro-anuncio?origem=anuncio">Quero começar com o Dishy <ArrowRight size={18}/></a>}
      </div>
    </section>
  );
}