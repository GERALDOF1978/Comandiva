import React, { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft, CreditCard, Eye, EyeOff, LockKeyhole, Mail, MapPin, ShieldCheck, Utensils, Wallet } from "lucide-react";
import "./dishy-ads-signup.css";

const TRACK_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];

function keepAdOrigin() {
  try {
    const params = new URLSearchParams(window.location.search);
    const saved = JSON.parse(sessionStorage.getItem("dishy-campaign") || "{}");
    const next = { ...saved, origem: "anuncio" };
    TRACK_KEYS.forEach(key => {
      if (params.has(key)) next[key] = params.get(key)?.slice(0, 255) || "";
    });
    sessionStorage.setItem("dishy-campaign", JSON.stringify(next));
  } catch { /* não impedir cadastro se o armazenamento estiver bloqueado */ }
}

export default function DishyAdsSignup({
  email, setEmail, password, setPassword, confirm, setConfirm,
  error, busy, onSubmit, onGoogle
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  useEffect(() => {
    keepAdOrigin();
    const prior = document.title;
    document.title = "Comece com o Dishy | 37 dias grátis";
    return () => { document.title = prior; };
  }, []);

  const passwordOk = password.length >= 6;
  const match = password.length > 0 && confirm.length > 0 && password === confirm;

  return <div className="dar-page">
    <header className="dar-header">
      <a href="/anuncio" className="dar-brand" aria-label="Dishy — conhecer a plataforma">
        <img src="/dishy-logo-oficial.png" alt="Dishy" />
      </a>
      <span className="dar-origin"><MapPin size={15} /> Criado em Rio Claro, SP</span>
      <a className="dar-login" href="/login">Já tenho conta <ArrowRight size={15}/></a>
    </header>

    <main className="dar-main">
      <aside className="dar-presentation">
        <div className="dar-local"><MapPin size={15} /> LANÇAMENTO EM RIO CLARO E REGIÃO</div>
        <h1>Seu restaurante mais <em>digital.</em> Seu atendimento mais <em>inteligente.</em></h1>
        <p>Comece a organizar seus pedidos, receber pagamentos e oferecer autonomia aos clientes com o Dishy.</p>
        <div className="dar-offer"><strong>37</strong><span><b>dias grátis</b><small>para conhecer o Dishy na sua loja</small></span></div>
        <div className="dar-highlights">
          <span><Wallet size={17}/> PIX integrado ao pedido</span>
          <span><CreditCard size={17}/> Celular como maquininha NFC</span>
          <span><Utensils size={17}/> Cliente fecha a conta na mesa</span>
          <span><Check size={17}/> Cardápio, delivery, PDV e comanda</span>
        </div>
        <div className="dar-visual">
          <img src="/marketing/poster-conta-mesa.webp" alt="Demonstração ilustrativa da autonomia do cliente para fechar a conta na mesa usando o Dishy" loading="lazy" />
          <span>Um sistema completo para seu restaurante</span>
        </div>
      </aside>

      <section className="dar-form-panel" aria-labelledby="dar-form-title">
        <div className="dar-card">
          <div className="dar-step"><span>PASSO 1 DE 2</span><span><ShieldCheck size={15}/> Cadastro seguro</span></div>
          <h2 id="dar-form-title">Crie sua conta grátis</h2>
          <p className="dar-description">Em seguida, você cadastra seu estabelecimento e configura o atendimento. Não precisa informar cartão de crédito.</p>

          <form onSubmit={onSubmit} className="dar-form">
            <label htmlFor="dar-email">Seu e-mail</label>
            <div className="dar-field"><Mail size={20}/><input id="dar-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="voce@restaurante.com.br" required disabled={busy}/></div>

            <label htmlFor="dar-password">Crie uma senha</label>
            <div className="dar-field"><LockKeyhole size={20}/><input id="dar-password" type={showPassword?"text":"password"} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="Pelo menos 6 caracteres" required disabled={busy}/><button type="button" disabled={busy} onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Ocultar senha":"Mostrar senha"} aria-pressed={showPassword}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div>
            {password.length>0&&<small className={passwordOk?"dar-hint good":"dar-hint"}>{passwordOk?"✓ Senha com tamanho mínimo":"Use pelo menos 6 caracteres"}</small>}

            <label htmlFor="dar-confirm">Confirme sua senha</label>
            <div className="dar-field"><LockKeyhole size={20}/><input id="dar-confirm" type={showConfirm?"text":"password"} minLength={6} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repita sua senha" required disabled={busy}/><button type="button" disabled={busy} onClick={()=>setShowConfirm(v=>!v)} aria-label={showConfirm?"Ocultar confirmação":"Mostrar confirmação"} aria-pressed={showConfirm}>{showConfirm?<EyeOff size={19}/>:<Eye size={19}/>}</button></div>
            {confirm.length>0&&<small className={match?"dar-hint good":"dar-hint"}>{match?"✓ As senhas coincidem":"As senhas devem ser iguais"}</small>}

            {error&&<div className="dar-error" role="alert">{error}</div>}
            <button type="submit" className="dar-submit" disabled={busy||!!password&&!passwordOk||!!confirm&&!match}>
              {busy?"Criando sua conta...":"Criar conta e cadastrar minha loja"} <ArrowRight size={20}/>
            </button>
          </form>

          <div className="dar-divider"><span>ou continue com</span></div>
          <button className="dar-google" type="button" onClick={onGoogle} disabled={busy}>
            <span className="dar-google-letter" aria-hidden="true">G</span> Continuar com Google
          </button>
          <p className="dar-assurance"><ShieldCheck size={16}/> Sem cartão de crédito e sem cobrança automática ao final do teste.</p>
          <p className="dar-smallprint">Eventuais tarifas de transações dependem do provedor de pagamento configurado.</p>
          <div className="dar-links"><a href="/login">Já tenho conta</a><a href="/anuncio"><ChevronLeft size={16}/> Voltar e conhecer o Dishy</a></div>
        </div>
      </section>
    </main>
    <footer className="dar-footer"><span>Dishy — desenvolvido em Rio Claro, SP</span><a href="/">Conhecer o site comercial</a></footer>
  </div>;
}
